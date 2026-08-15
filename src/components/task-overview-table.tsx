import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TaskSummary } from "@/hooks/use-tasks";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";

interface TaskOverviewTableProps {
  tasks: TaskSummary[];
}

const getStatusColor = (status: string) => {
  const statusLower = status.toLowerCase();
  if (statusLower.includes("complete") || statusLower.includes("done")) {
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
  }
  if (statusLower.includes("progress") || statusLower.includes("active")) {
    return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
  }
  if (statusLower.includes("todo") || statusLower.includes("open")) {
    return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  }
  return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
};

const formatDueDate = (dueDate: string | null) => {
  if (!dueDate) return "-";

  try {
    // ClickUp timestamps are in milliseconds
    const date = new Date(parseInt(dueDate));
    return format(date, "MMM dd, yyyy");
  } catch {
    return "Invalid date";
  }
};

const isOverdue = (dueDate: string | null) => {
  if (!dueDate) return false;

  try {
    const date = new Date(parseInt(dueDate));
    return date < new Date();
  } catch {
    return false;
  }
};

const getInitials = (username: string) => {
  return username
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
};

export function TaskOverviewTable({ tasks }: TaskOverviewTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Task Overview</CardTitle>
        <p className="text-sm text-muted-foreground">
          Recent tasks with assignees and due dates
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border max-h-96 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[200px]">Task Name</TableHead>
                {/* <TableHead>Project</TableHead> */}
                <TableHead>Status</TableHead>
                <TableHead>Assignees</TableHead>
                <TableHead>Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-2 text-muted-foreground"
                  >
                    No tasks available
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">
                      <div className=" truncate" title={task.name}>
                        {task.name}
                      </div>
                    </TableCell>
                    {/* <TableCell>
                      <div
                        className="max-w-[120px] truncate text-sm text-muted-foreground"
                        title={task.projectName}
                      >
                        {task.projectName}
                      </div>
                    </TableCell> */}
                    <TableCell className="text-center text-xs">
                      <Badge
                        variant="secondary"
                        className={`${getStatusColor(task.status)} border-0`}
                      >
                        {task.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.assignees.length === 0 ? (
                        <span className="text-sm text-muted-foreground">
                          Unassigned
                        </span>
                      ) : task.assignees.length === 1 ? (
                        <div className="flex flex-wrap gap-1">
                          {task?.assignees?.map((assignee) => (
                            <div
                              key={assignee.id}
                              className="flex items-center gap-2 bg-muted px-2 py-1 rounded-md"
                              title={assignee.email}
                            >
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={undefined} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(assignee.username)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs font-medium">
                                {assignee.username}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : task.assignees.length === 2 ? (
                        <div className="flex items-center gap-2">
                          {task.assignees.map((assignee) => (
                            <Avatar
                              key={assignee.id}
                              className="h-7 w-7 ring-2 ring-background"
                              title={`${assignee.username} (${assignee.email})`}
                            >
                              <AvatarImage src={undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(assignee.username)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                        </div>
                      ) : (
                        <div className="flex -space-x-2">
                          {task?.assignees?.slice(0, 3).map((assignee) => (
                            <Avatar
                              key={assignee.id}
                              className="h-8 w-8 ring-2 ring-background"
                              title={`${assignee.username} (${assignee.email})`}
                            >
                              <AvatarImage src={undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(assignee.username)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {task.assignees.length > 3 && (
                            <Avatar className="h-8 w-8 ring-2 ring-background bg-muted">
                              <AvatarFallback className="text-xs">
                                +{task.assignees.length - 3}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-sm ${
                          isOverdue(task.dueDate)
                            ? "text-red-600 dark:text-red-400 font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        {formatDueDate(task.dueDate)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
