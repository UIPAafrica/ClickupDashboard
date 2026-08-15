import { isWithinInterval, startOfWeek, endOfWeek } from 'date-fns';

// Shared ClickUp fetching and status classification.
//
// Both the dashboard API (/api/tasks) and the Supabase sync (/api/sync) read
// from here so the numbers on screen and the numbers in the ERP are derived by
// exactly the same rules. Duplicating this logic is how the two drift apart.

export interface ClickUpUser {
  id: string;
  username: string;
  email: string;
}

export interface ClickUpTask {
  id: string;
  name: string;
  status: {
    status: string;
    type: string;
  };
  url?: string;
  date_done?: string | null;
  due_date?: string | null;
  assignees?: ClickUpUser[];
  group_assignees?: ClickUpUser[];
  project?: { id: string; name: string };
  folder?: { id: string; name: string };
  list?: { id: string; name: string };
}

export interface ClickUpResponse {
  tasks: ClickUpTask[];
  // ClickUp sets this on the final page of a paginated task listing.
  last_page?: boolean;
}

export type TaskBucket = 'todo' | 'in_progress' | 'review' | 'complete' | 'other';

export type ProjectSource = 'project' | 'folder' | 'list' | 'unknown';

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

// ClickUp returns at most 100 tasks per page, so a single request silently
// truncates any workspace larger than that. Walk the pages until ClickUp says
// it is done, bounded so a misbehaving response cannot loop forever.
const CLICKUP_PAGE_SIZE = 100;
const MAX_TASK_PAGES = 50;

export function getProjectInfo(task: ClickUpTask): { id: string; name: string; source: ProjectSource } {
  // Priority: project > folder > list
  if (task.project) {
    return { id: task.project.id, name: task.project.name, source: 'project' };
  }
  if (task.folder) {
    return { id: task.folder.id, name: task.folder.name, source: 'folder' };
  }
  if (task.list) {
    return { id: task.list.id, name: task.list.name, source: 'list' };
  }
  return { id: 'unknown', name: 'Unknown Project', source: 'unknown' };
}

export function isTaskCompleted(task: ClickUpTask): boolean {
  return task.status.type === 'closed' || task.status.status.toLowerCase().includes('complete');
}

export function isTaskInProgress(task: ClickUpTask): boolean {
  const statusLower = task.status.status.toLowerCase();
  return !isTaskCompleted(task) && (
    statusLower.includes('progress') ||
    statusLower.includes('in progress') ||
    statusLower.includes('doing') ||
    statusLower.includes('active')
  );
}

export function isTaskInReview(task: ClickUpTask): boolean {
  const statusLower = task.status.status.toLowerCase();
  return !isTaskCompleted(task) && statusLower.includes('review');
}

export function isTaskTodo(task: ClickUpTask): boolean {
  const statusLower = task.status.status.toLowerCase();
  return !isTaskCompleted(task) && !isTaskInProgress(task) && (
    statusLower.includes('todo') ||
    statusLower.includes('to do') ||
    statusLower.includes('open') ||
    statusLower.includes('new') ||
    statusLower.includes('backlog') ||
    task.status.type === 'open' // Default open tasks to todo
  );
}

export function isTaskUnassigned(task: ClickUpTask): boolean {
  // Check if task has no assignees or assignees array is empty
  return !task.assignees || (Array.isArray(task.assignees) && task.assignees.length === 0);
}

/**
 * Collapse a task into a single bucket. Review is checked before todo because a
 * "review" status can also carry ClickUp's `open` type, which would otherwise
 * swallow it into todo.
 */
export function getTaskBucket(task: ClickUpTask): TaskBucket {
  if (isTaskCompleted(task)) return 'complete';
  if (isTaskInReview(task)) return 'review';
  if (isTaskInProgress(task)) return 'in_progress';
  if (isTaskTodo(task)) return 'todo';
  return 'other';
}

export function isDateThisWeek(dateString: string | null | undefined): boolean {
  if (!dateString) return false;

  try {
    // ClickUp timestamps are in milliseconds
    const date = new Date(parseInt(dateString));
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    return isWithinInterval(date, { start: weekStart, end: weekEnd });
  } catch {
    return false;
  }
}

export function getClickUpConfig() {
  const apiKey = process.env.CLICKUP_API_KEY;
  const teamId = process.env.CLICKUP_TEAM_ID;
  const spaceId = process.env.CLICKUP_SPACE_ID || '90125160522';

  return { apiKey, teamId, spaceId };
}

async function clickUpFetch(path: string, apiKey: string): Promise<Response> {
  const response = await fetch(`${CLICKUP_API_BASE}${path}`, {
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `ClickUp API error: ${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`
    );
  }

  return response;
}

export async function fetchAllTasks(teamId: string, apiKey: string): Promise<ClickUpTask[]> {
  const tasks: ClickUpTask[] = [];

  for (let page = 0; page < MAX_TASK_PAGES; page++) {
    const response = await clickUpFetch(
      `/team/${teamId}/task?include_closed=true&page=${page}`,
      apiKey
    );

    const data: ClickUpResponse = await response.json();
    const pageTasks = data.tasks || [];
    tasks.push(...pageTasks);

    // Prefer ClickUp's own flag, but fall back to a short page so we still
    // terminate if `last_page` is absent.
    if (data.last_page === true || pageTasks.length < CLICKUP_PAGE_SIZE) {
      return tasks;
    }
  }

  console.warn(
    `Reached the ${MAX_TASK_PAGES}-page cap while fetching ClickUp tasks; results may be truncated.`
  );
  return tasks;
}

export interface ClickUpFolder {
  id: string;
  name: string;
  hidden?: boolean;
  access?: boolean;
}

/**
 * Folders in the configured space. Returns null when the call fails so callers
 * can tell "no folders" apart from "could not ask" — the dashboard's Active
 * Projects count silently read 0 for both before this distinction existed.
 */
export async function fetchSpaceFolders(
  spaceId: string,
  apiKey: string
): Promise<ClickUpFolder[] | null> {
  try {
    const response = await fetch(`${CLICKUP_API_BASE}/space/${spaceId}/folder`, {
      headers: {
        Authorization: apiKey,
        Accept: 'application/json',
      },
    });

    if (!response.ok) return null;

    const json = await response.json();
    const folders: ClickUpFolder[] = json?.folders ?? [];
    return folders.filter(
      f => (f.hidden === false || f.hidden === undefined) && f.access !== false
    );
  } catch {
    return null;
  }
}
