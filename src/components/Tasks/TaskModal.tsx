import { useGameStore } from '../../store/gameStore';
import { socketClient } from '../../socket/socketClient';
import { SocketEvents, TaskType } from '@shared/constants';
import WireTask from './WireTask';
import FuelTask from './FuelTask';
import DownloadTask from './DownloadTask';
import GenericTask from './GenericTask';

export default function TaskModal() {
  const activeTask = useGameStore(s => s.activeTask);
  const setActiveTask = useGameStore(s => s.setActiveTask);

  if (!activeTask) return null;

  const handleComplete = () => {
    socketClient.emit(SocketEvents.COMPLETE_TASK, { taskId: activeTask.id });
    setActiveTask(null);
  };

  const handleClose = () => {
    setActiveTask(null);
  };

  const renderTask = () => {
    switch (activeTask.type) {
      case TaskType.WIRE_FIX:
        return <WireTask onComplete={handleComplete} />;
      case TaskType.FUEL_UP:
        return <FuelTask onComplete={handleComplete} />;
      case TaskType.DOWNLOAD_DATA:
        return <DownloadTask onComplete={handleComplete} />;
      default:
        return <GenericTask onComplete={handleComplete} taskType={activeTask.type} label={activeTask.label} />;
    }
  };

  return (
    <div className="absolute inset-0 task-backdrop flex items-center justify-center z-50 animate-fade-in">
      <div className="glass-panel rounded-2xl p-6 max-w-lg w-full mx-4 neon-glow animate-float-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold font-mono">{activeTask.label}</h2>
          <button
            onClick={handleClose}
            className="text-void-muted hover:text-void-text transition-colors text-xl"
          >
            ✕
          </button>
        </div>
        <div className="text-xs text-void-muted mb-4 font-mono">
          📍 {activeTask.room} • Press ESC to close
        </div>
        {renderTask()}
      </div>
    </div>
  );
}
