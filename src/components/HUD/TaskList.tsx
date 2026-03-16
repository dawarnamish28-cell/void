import { useGameStore } from '../../store/gameStore';

export default function TaskList() {
  const myTasks = useGameStore(s => s.myTasks);
  const taskProgress = useGameStore(s => s.taskProgress);
  const totalTasks = useGameStore(s => s.totalTasks);
  const myRole = useGameStore(s => s.myRole);

  const progressPercent = totalTasks > 0 ? (taskProgress / totalTasks) * 100 : 0;

  return (
    <div className="h-full flex flex-col p-3 bg-void-panel/50">
      <h3 className="text-xs font-mono text-void-muted uppercase tracking-wider mb-3">
        📋 Tasks
      </h3>

      {/* Group task bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-void-muted mb-1">
          <span>Group Progress</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <div className="w-full bg-void-bg rounded-full h-2 border border-void-border">
          <div
            className="bg-void-success h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-auto space-y-1.5">
        {myTasks.map(task => (
          <div
            key={task.id}
            className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all ${
              task.completed
                ? 'bg-void-success/10 text-void-success/60 line-through'
                : 'bg-void-bg/50 text-void-text'
            }`}
          >
            <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
              task.completed
                ? 'bg-void-success border-void-success text-white'
                : 'border-void-border'
            }`}>
              {task.completed && '✓'}
            </span>
            <div className="min-w-0">
              <div className="truncate font-medium">{task.label}</div>
              <div className="text-[10px] text-void-muted">{task.room}</div>
            </div>
          </div>
        ))}
      </div>

      {myRole === 'impostor' && (
        <div className="mt-2 text-xs text-void-danger/50 font-mono text-center">
          (Fake tasks)
        </div>
      )}
    </div>
  );
}
