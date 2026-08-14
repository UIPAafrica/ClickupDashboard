import { NextResponse } from 'next/server';
import {
  ClickUpTask,
  fetchAllTasks,
  fetchSpaceFolders,
  getClickUpConfig,
  getProjectInfo,
  isDateThisWeek,
  isTaskCompleted,
  isTaskInProgress,
  isTaskInReview,
  isTaskTodo,
  isTaskUnassigned,
} from '@/lib/clickup';

interface ProjectData {
  id: string;
  name: string;
  progress: number;
  counters: {
    todo: number;
    inProgress: number;
    completed: number;
    completedThisWeek: number;
    dueThisWeek: number;
  };
}

interface DashboardStats {
  unassigned: number;
  inProgress: number;
  completed: number;
  completedThisWeek: number;
  totalTasks: number;
  activeProjects: number;
}

interface AssigneeOpenStatsItem {
  id: string;
  username: string;
  email: string;
  count: number;
}

interface TaskSummary {
  id: string;
  name: string;
  status: string;
  assignees: Array<{
    id: string;
    username: string;
    email: string;
  }>;
  dueDate: string | null;
  projectName: string;
}

export async function GET() {
  try {
    const { apiKey, teamId, spaceId } = getClickUpConfig();

    if (!apiKey || !teamId) {
      return NextResponse.json(
        { error: 'Missing CLICKUP_API_KEY or CLICKUP_TEAM_ID environment variables' },
        { status: 500 }
      );
    }

    // Fetch tasks from ClickUp API (all pages)
    const tasks = await fetchAllTasks(teamId, apiKey);

    // Group tasks by project
    const projectsMap = new Map<string, {
      id: string;
      name: string;
      tasks: ClickUpTask[];
    }>();

    tasks.forEach(task => {
      const projectInfo = getProjectInfo(task);
      const projectKey = projectInfo.id;

      if (!projectsMap.has(projectKey)) {
        projectsMap.set(projectKey, {
          id: projectInfo.id,
          name: projectInfo.name,
          tasks: [],
        });
      }

      projectsMap.get(projectKey)!.tasks.push(task);
    });

    // Calculate dashboard statistics
    const totalTasks = tasks.length;
    const unassignedTasks = tasks.filter(isTaskUnassigned);
    const inProgressTasks = tasks.filter(isTaskInProgress);
    const completedTasks = tasks.filter(isTaskCompleted);
    const completedThisWeekTasks = completedTasks.filter(task =>
      isDateThisWeek(task.date_done)
    );

    // Fetch folders (projects) for Active Projects count
    const folders = await fetchSpaceFolders(spaceId, apiKey);
    const activeProjects = folders?.length ?? 0;

    const dashboardStats: DashboardStats = {
      unassigned: unassignedTasks.length,
      inProgress: inProgressTasks.length,
      completed: completedTasks.length,
      completedThisWeek: completedThisWeekTasks.length,
      totalTasks: totalTasks,
      activeProjects,
    };

    // Calculate projects data with proper progress calculation
    const projects: ProjectData[] = Array.from(projectsMap.values()).map(project => {
      const { tasks: projectTasks } = project;

      // Separate tasks by status
      const todoProjectTasks = projectTasks.filter(isTaskTodo);
      const inProgressProjectTasks = projectTasks.filter(isTaskInProgress);
      const completedProjectTasks = projectTasks.filter(isTaskCompleted);

      // Total tasks = Todo + In Progress + Completed (all tasks in the project)
      const totalProjectTasks = todoProjectTasks.length + inProgressProjectTasks.length + completedProjectTasks.length;

      // Tasks completed this week
      const completedThisWeekProjectTasks = completedProjectTasks.filter(task =>
        isDateThisWeek(task.date_done)
      );

      // Tasks due this week
      const dueThisWeekTasks = projectTasks.filter(task =>
        isDateThisWeek(task.due_date)
      );

      // Calculate progress: completed tasks / (todo + in progress + completed) * 100
      const progress = totalProjectTasks > 0
        ? Math.round((completedProjectTasks.length / totalProjectTasks) * 100)
        : 0;

      return {
        id: project.id,
        name: project.name,
        progress,
        counters: {
          todo: todoProjectTasks.length,
          inProgress: inProgressProjectTasks.length,
          completed: completedProjectTasks.length,
          completedThisWeek: completedThisWeekProjectTasks.length,
          dueThisWeek: dueThisWeekTasks.length,
        },
      };
    });

    // Prepare task summaries for the table (limit to recent/important tasks)
    const taskSummaries: TaskSummary[] = tasks
      .slice(0, 50) // Limit to 50 most recent tasks
      .map(task => {
        const projectInfo = getProjectInfo(task);
        return {
          id: task.id,
          name: task.name,
          status: task.status.status,
          assignees: task.assignees || [],
          dueDate: task.due_date || null,
          projectName: projectInfo.name,
        };
      });

    // Prepare review tasks (all tasks currently in a review state)
    const reviewTasks: TaskSummary[] = tasks
      .filter(isTaskInReview)
      .map(task => {
        const projectInfo = getProjectInfo(task);
        return {
          id: task.id,
          name: task.name,
          status: task.status.status,
          assignees: task.assignees || [],
          dueDate: task.due_date || null,
          projectName: projectInfo.name,
        };
      });

    // Compute open tasks by assignee (group by assignee id)
    const assigneeOpenMap = new Map<string, AssigneeOpenStatsItem>();
    tasks.forEach(task => {
      if (!isTaskCompleted(task)) {
        // Merge assignees and group_assignees, dedupe within the task by user id
        const merged = [...(task.assignees || []), ...(task.group_assignees || [])];
        const uniqueById = Array.from(
          new Map(merged.map(u => [String(u.id), u])).values()
        );

        uniqueById.forEach(a => {
          const key = String(a.id);
          if (!assigneeOpenMap.has(key)) {
            assigneeOpenMap.set(key, {
              id: key,
              username: a.username,
              email: a.email,
              count: 0,
            });
          }
          assigneeOpenMap.get(key)!.count += 1;
        });
      }
    });
    const openTasksByAssignee = Array.from(assigneeOpenMap.values());

    return NextResponse.json({
      stats: dashboardStats,
      projects: projects,
      tasks: taskSummaries,
      reviewTasks,
      openTasksByAssignee,
    });

  } catch (error) {
    console.error('Error fetching ClickUp tasks:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch tasks from ClickUp',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
