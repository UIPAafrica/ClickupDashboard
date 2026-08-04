import { useQuery } from '@tanstack/react-query';

export interface ProjectData {
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

export const useTasks = () => {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
    refetchInterval: 10800 * 1000, // Refetch every 30 seconds
    staleTime: 10800 * 1000, // Consider data stale after 30 seconds
  });
};
