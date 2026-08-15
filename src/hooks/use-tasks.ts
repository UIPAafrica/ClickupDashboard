import { useQuery } from '@tanstack/react-query';

export interface ProjectData {
  id: string;
  name: string;
  progress: number;
  counters: {
    todo: number;
    inProgress: number;
    review: number;
    completed: number;
    completedThisWeek: number;
    dueThisWeek: number;
  };
}

export interface DashboardStats {
  unassigned: number;
  inProgress: number;
  completed: number;
  completedThisWeek: number;
  totalTasks: number;
  activeProjects: number;
}

export interface TaskSummary {
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

interface TasksResponse {
  stats: DashboardStats;
  projects: ProjectData[];
  tasks: TaskSummary[];
  reviewTasks: TaskSummary[];
  openTasksByAssignee: Array<{ id: string; username: string; email: string; count: number }>;
}

const fetchTasks = async (): Promise<TasksResponse> => {
  const response = await fetch('/api/tasks');

  if (!response.ok) {
    const message = await response
      .json()
      .then((body) => [body?.error, body?.details].filter(Boolean).join(': '))
      .catch(() => '');

    throw new Error(
      message || `Failed to fetch tasks: ${response.status}`
    );
  }

  return response.json();
};

/**
 * How often the dashboard refetches, in seconds. The header label is derived
 * from this rather than hard-coded, so the two cannot drift apart again — the
 * UI claimed "every 30s" while this was set to three hours.
 */
export const REFRESH_INTERVAL_SECONDS = 10800;

/** Human-readable form of REFRESH_INTERVAL_SECONDS, e.g. "3h" or "30s". */
export function formatRefreshInterval(seconds = REFRESH_INTERVAL_SECONDS): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round((seconds / 3600) * 10) / 10}h`;
}

export const useTasks = () => {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
    refetchInterval: REFRESH_INTERVAL_SECONDS * 1000,
    staleTime: REFRESH_INTERVAL_SECONDS * 1000,
  });
};
