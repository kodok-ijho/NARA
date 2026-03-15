import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { 
  Calendar, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  MoreVertical,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
}

interface Routine {
  id: string;
  title: string;
  time: string;
  days: string[];
  is_active: boolean;
}

export function MasaScreen() {
  const { session } = useOutletContext<{ session: Session }>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);

  // n8n Webhook URL (To be filled by user or configured via .env)
  const MASA_WEBHOOK_URL = (import.meta as any).env.VITE_N8N_MASA_WEBHOOK_URL || "";

  const fetchData = async () => {
    if (!MASA_WEBHOOK_URL) {
      return;
    }

    try {
      const response = await fetch(MASA_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get_data",
          user_id: session.user.id
        })
      });
      const data = await response.json();
      if (data) {
        if (data.tasks) setTasks(data.tasks);
        if (data.routines) setRoutines(data.routines);
      }
    } catch (error) {
      console.error("Error fetching MASA data:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [session.user.id]);

  const toggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === 'pending' ? 'completed' : 'pending';
    
    // Optimistic Update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

    try {
      await fetch(MASA_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_task",
          user_id: session.user.id,
          id: task.id,
          status: newStatus
        })
      });
      toast.success(`Task marked as ${newStatus}`);
    } catch (error) {
      toast.error("Failed to update task");
      fetchData(); // Rollback
    }
  };

  if (!MASA_WEBHOOK_URL) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-6">
          <Calendar className="w-8 h-8 text-blue-500" />
        </div>
        <h2 className="text-2xl font-bold mb-2">MASA Webhook Required</h2>
        <p className="text-zinc-500 max-w-md mb-8">
          Please configure <code>VITE_N8N_MASA_WEBHOOK_URL</code> in your <code>.env</code> file to activate the Agenda module.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Agenda</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500 neon-glow" />
            Manage your tasks and daily rituals efficiently.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl border-border bg-secondary/50 backdrop-blur-sm">
            Manage Routines
          </Button>
          <Button className="rounded-xl bg-[var(--masa-accent)] hover:opacity-90 transition-opacity gap-2 neon-border-glow">
            <Plus className="w-4 h-4 neon-glow" /> New Task
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Today's Rituals (Routines) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Today's Rituals</h3>
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{routines.length}</span>
          </div>

          <div className="space-y-4">
            {routines.length === 0 ? (
              <div className="p-8 border border-dashed border-border rounded-2xl text-center text-muted-foreground text-sm">
                No rituals scheduled for today.
              </div>
            ) : (
              routines.map((routine) => (
                <motion.div
                  key={routine.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="group relative p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] hover:border-[var(--masa-accent)] transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-foreground">{routine.title}</h4>
                      <p className="text-xs text-muted-foreground">{routine.time}</p>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Tasks Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pending Tasks</h3>
            <div className="flex gap-4 text-xs">
              <span className="text-muted-foreground">Total: {tasks.length}</span>
              <span className="text-green-500">Done: {tasks.filter(t => t.status === 'completed').length}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {tasks.length === 0 ? (
              <div className="p-12 border border-dashed border-border rounded-3xl text-center">
                <p className="text-muted-foreground mb-4 text-sm">All clear! No tasks for now.</p>
                <Button variant="ghost" className="text-xs gap-2 text-muted-foreground">
                  <Plus className="w-4 h-4" /> Add your first task
                </Button>
              </div>
            ) : (
              tasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  className={cn(
                    "group flex items-center gap-4 p-4 rounded-2xl transition-all",
                    "bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)]",
                    task.status === 'completed' ? "opacity-60" : "hover:border-[var(--masa-accent)]"
                  )}
                >
                  <button 
                    onClick={() => toggleTaskStatus(task)}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                      task.status === 'completed' 
                        ? "bg-green-500 border-green-500 text-white" 
                        : "border-border hover:border-[var(--masa-accent)] text-transparent"
                    )}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>

                  <div className="flex-1 min-w-0">
                    <h4 className={cn(
                      "font-medium text-sm truncate",
                      task.status === 'completed' && "line-through text-zinc-500"
                    )}>
                      {task.title}
                    </h4>
                    {task.due_date && (
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(task.due_date).toLocaleDateString()}
                        </span>
                        {task.priority === 'high' && (
                          <span className="flex items-center gap-1 text-[10px] text-red-400 font-medium ml-2">
                            <AlertCircle className="w-3 h-3" /> Priority
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 rounded-full h-8 w-8 text-zinc-500">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper for conditional classes
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
