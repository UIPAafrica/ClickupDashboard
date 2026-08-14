import { NextRequest, NextResponse } from 'next/server';
import {
  ClickUpTask,
  fetchAllTasks,
  fetchSpaceFolders,
  getClickUpConfig,
  getProjectInfo,
  getTaskBucket,
  isDateThisWeek,
  toIsoDate,
} from '@/lib/clickup';
import { getSupabaseAdmin } from '@/lib/supabase';

// Pushes the ClickUp workspace into the ERP database (uip-execs).
//
// Reads the same CLICKUP_* credentials the dashboard uses, so it sees exactly
// the workspace shown on screen. Writes only into the clickup_* mirror tables;
// public.projects is curated ERP data and is never touched here.

export const maxDuration = 60;

// Supabase rejects very large single payloads, and a workspace can run to
// thousands of tasks, so upserts go up in chunks.
const UPSERT_CHUNK_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * The sync writes to the ERP database, so it must not be publicly triggerable.
 * Accepts either a Vercel Cron request or an explicit bearer token.
 */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.SYNC_SECRET;

  // Vercel signs its cron invocations with this header.
  if (request.headers.get('x-vercel-cron')) return true;

  if (!secret) return false;

  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  return runSync(request);
}

// Vercel Cron issues GET requests.
export async function GET(request: NextRequest) {
  return runSync(request);
}

async function runSync(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { apiKey, teamId, spaceId } = getClickUpConfig();
  if (!apiKey || !teamId) {
    return NextResponse.json(
      { error: 'Missing CLICKUP_API_KEY or CLICKUP_TEAM_ID environment variables' },
      { status: 500 }
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables' },
      { status: 500 }
    );
  }

  // Open a run row first so a sync that dies mid-flight is still visible as
  // 'running' rather than leaving no trace at all.
  const { data: run } = await supabase
    .from('clickup_sync_runs')
    .insert({ status: 'running' })
    .select('id')
    .single();

  const runId: string | undefined = run?.id;

  try {
    const tasks = await fetchAllTasks(teamId, apiKey);
    const folders = await fetchSpaceFolders(spaceId, apiKey);

    // Group tasks by their owning project, exactly as the dashboard does.
    const projects = new Map<
      string,
      { id: string; name: string; source: string; tasks: ClickUpTask[] }
    >();

    for (const task of tasks) {
      const info = getProjectInfo(task);
      if (!projects.has(info.id)) {
        projects.set(info.id, { id: info.id, name: info.name, source: info.source, tasks: [] });
      }
      projects.get(info.id)!.tasks.push(task);
    }

    // Folders with no tasks never appear in the task listing, but they are still
    // real projects — carry them through so counts match the dashboard.
    for (const folder of folders ?? []) {
      if (!projects.has(folder.id)) {
        projects.set(folder.id, { id: folder.id, name: folder.name, source: 'folder', tasks: [] });
      }
    }

    const syncedAt = new Date().toISOString();

    const projectRows = Array.from(projects.values()).map(project => {
      const buckets = project.tasks.map(getTaskBucket);
      const todo = buckets.filter(b => b === 'todo').length;
      const inProgress = buckets.filter(b => b === 'in_progress').length;
      const review = buckets.filter(b => b === 'review').length;
      const completed = buckets.filter(b => b === 'complete').length;

      // Progress denominator counts every open bucket, review included. The
      // dashboard omits review here, which overstates progress; the ERP mirror
      // deliberately does not repeat that.
      const total = todo + inProgress + review + completed;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        clickup_id: project.id,
        name: project.name,
        source: project.source,
        progress,
        todo_count: todo,
        in_progress_count: inProgress,
        review_count: review,
        completed_count: completed,
        due_this_week_count: project.tasks.filter(t => isDateThisWeek(t.due_date)).length,
        synced_at: syncedAt,
        updated_at: syncedAt,
      };
    });

    // Projects first — clickup_tasks carries an FK onto this table.
    for (const batch of chunk(projectRows, UPSERT_CHUNK_SIZE)) {
      const { error } = await supabase
        .from('clickup_projects')
        .upsert(batch, { onConflict: 'clickup_id' });
      if (error) throw new Error(`clickup_projects upsert failed: ${error.message}`);
    }

    const taskRows = tasks.map(task => {
      const info = getProjectInfo(task);
      return {
        clickup_id: task.id,
        name: task.name,
        status: task.status.status,
        status_type: task.status.type,
        bucket: getTaskBucket(task),
        clickup_project_id: info.id,
        assignees: task.assignees ?? [],
        url: task.url ?? null,
        due_date: toIsoDate(task.due_date),
        date_done: toIsoDate(task.date_done),
        synced_at: syncedAt,
        updated_at: syncedAt,
      };
    });

    for (const batch of chunk(taskRows, UPSERT_CHUNK_SIZE)) {
      const { error } = await supabase
        .from('clickup_tasks')
        .upsert(batch, { onConflict: 'clickup_id' });
      if (error) throw new Error(`clickup_tasks upsert failed: ${error.message}`);
    }

    // Tasks deleted in ClickUp would otherwise linger in the mirror forever.
    const seenIds = new Set(tasks.map(t => t.id));
    const { data: storedIds } = await supabase.from('clickup_tasks').select('clickup_id');
    const staleIds = (storedIds ?? [])
      .map(row => row.clickup_id as string)
      .filter(id => !seenIds.has(id));

    for (const batch of chunk(staleIds, UPSERT_CHUNK_SIZE)) {
      const { error } = await supabase.from('clickup_tasks').delete().in('clickup_id', batch);
      if (error) throw new Error(`stale task cleanup failed: ${error.message}`);
    }

    // One snapshot per project per day. Re-running the sync overwrites today's
    // row rather than accumulating duplicates, so history stays one-per-day.
    const snapshotRows = projectRows.map(p => ({
      clickup_project_id: p.clickup_id,
      captured_on: syncedAt.slice(0, 10),
      progress: p.progress,
      todo_count: p.todo_count,
      in_progress_count: p.in_progress_count,
      review_count: p.review_count,
      completed_count: p.completed_count,
    }));

    for (const batch of chunk(snapshotRows, UPSERT_CHUNK_SIZE)) {
      const { error } = await supabase
        .from('clickup_project_snapshots')
        .upsert(batch, { onConflict: 'clickup_project_id,captured_on' });
      if (error) throw new Error(`snapshot upsert failed: ${error.message}`);
    }

    if (runId) {
      await supabase
        .from('clickup_sync_runs')
        .update({
          status: 'success',
          finished_at: new Date().toISOString(),
          tasks_synced: taskRows.length,
          projects_synced: projectRows.length,
        })
        .eq('id', runId);
    }

    return NextResponse.json({
      status: 'success',
      projectsSynced: projectRows.length,
      tasksSynced: taskRows.length,
      staleTasksRemoved: staleIds.length,
      syncedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('ClickUp -> Supabase sync failed:', message);

    if (runId) {
      await supabase
        .from('clickup_sync_runs')
        .update({ status: 'error', finished_at: new Date().toISOString(), error: message })
        .eq('id', runId);
    }

    return NextResponse.json(
      { error: 'Sync failed', details: message },
      { status: 500 }
    );
  }
}
