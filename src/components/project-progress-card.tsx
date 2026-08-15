import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectData } from "@/hooks/use-tasks";

interface ProjectProgressCardProps {
  project: ProjectData;
}

export function ProjectProgressCard({ project }: ProjectProgressCardProps) {
  console.log("project from the project progress card", project);

  const totalTasks =
    project.counters.todo +
    project.counters.inProgress +
    project.counters.completed;
  console.log("totalTasks", totalTasks);
  console.log("project", project);
  const progressColor =
    project.progress >= 80
      ? "bg-green-500"
      : project.progress >= 50
      ? "bg-blue-500"
      : project.progress >= 25
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold truncate">
          {project.name}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          ID: {project.id} • {totalTasks} total tasks
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Section */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm font-semibold">
              {project.counters.completed}/{totalTasks} ({project.progress}%)
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${progressColor}`}
              style={{ width: `${Math.min(project.progress, 100)}%` }}
            />
          </div>
        </div>

        {/* Task Summary */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Todo:</span>
            <span className="font-medium text-gray-600">
              {project.counters.todo}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">In Progress:</span>
            <span className="font-medium text-blue-600">
              {project.counters.inProgress}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Completed:</span>
            <span className="font-medium text-green-600">
              {project.counters.completed}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">This Week:</span>
            <span className="font-medium text-emerald-600">
              {project.counters.completedThisWeek}
            </span>
          </div>
        </div>

        {/* Progress Status */}
        <div className="pt-2 border-t">
          <div className="text-xs text-center text-muted-foreground">
            {project.progress === 100
              ? "✅ Complete"
              : project.progress >= 75
              ? "🔥 Almost Done"
              : project.progress >= 50
              ? "⚡ Good Progress"
              : project.progress >= 25
              ? "📈 Getting Started"
              : "🚀 Just Started"}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
