import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Utensils, 
  Scale, 
  Plus, 
  Target, 
  Zap, 
  History,
  Trash2,
  Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const RAGA_WEBHOOK = import.meta.env.VITE_N8N_RAGA_WEBHOOK_URL;

interface RagaLog {
  id: string;
  meal_name: string;
  calories: number;
  logged_at: string;
}

interface Biometrics {
  height_cm: number;
  weight_kg: number;
  target_calories: number;
}

export function RagaScreen() {
  const { session } = useOutletContext<{ session: Session }>();
  const user = session.user;

  const [logs, setLogs] = useState<RagaLog[]>([]);
  const [biometrics, setBiometrics] = useState<Biometrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form States
  const [mealName, setMealName] = useState("");
  const [calories, setCalories] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Pure n8n Flow: All data via Webhook
      const response = await fetch(RAGA_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get_data",
          user_id: user.id
        })
      });

      const text = await response.text();
      if (!text) throw new Error("Empty response from NARA bridge");
      
      const result = JSON.parse(text);
      console.log("[RAGA] Raw n8n response:", result);
      const data = Array.isArray(result) ? result[0] : result;
      console.log("[RAGA] Parsed data:", data);

      if (data) {
        if (data.logs) setLogs(data.logs);
        if (data.biometrics && data.biometrics.user_id) {
          const b = data.biometrics;
          setBiometrics({
            height_cm: parseFloat(b.height_cm) || 0,
            weight_kg: parseFloat(b.weight_kg) || 0,
            target_calories: parseInt(b.target_calories) || 2000,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching RAGA via n8n:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealName || !calories) return;

    setIsAdding(true);
    try {
      const response = await fetch(RAGA_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_log",
          user_id: user.id,
          data: {
            meal_name: mealName,
            calories: parseInt(calories),
          }
        })
      });

      if (response.ok) {
        toast.success(`${mealName} Logged`, {
          description: `Successfully synchronized to NARA via n8n.`,
        });
        setMealName("");
        setCalories("");
        fetchData();
      } else {
        throw new Error("Webhook commitment failed");
      }
    } catch (error: any) {
      toast.error("Failed to Log Meal", {
        description: error.message,
      });
    } finally {
      setIsAdding(false);
    }
  };

  const deleteLog = async (id: string) => {
    try {
      const response = await fetch(RAGA_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_log",
          user_id: user.id,
          id: id
        })
      });
      if (response.ok) fetchData();
    } catch (error) {
      console.error("Delete failed via n8n", error);
    }
  };

  // Calculations
  const totalCalories = logs.reduce((sum, log) => sum + log.calories, 0);
  const target = biometrics?.target_calories || 2000;
  const progress = Math.min((totalCalories / target) * 100, 100);
  
  const bmi = biometrics?.height_cm && biometrics?.weight_kg
    ? (biometrics.weight_kg / Math.pow(biometrics.height_cm / 100, 2)).toFixed(1)
    : "N/A";

  const idealWeight = biometrics?.height_cm 
    ? (22 * Math.pow(biometrics.height_cm / 100, 2)).toFixed(1)
    : "N/A";

  const getBMICategory = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "N/A";
    if (num < 18.5) return "Underweight";
    if (num < 25) return "Healthy";
    if (num < 30) return "Overweight";
    return "Obese";
  };

  if (isLoading && logs.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--raga-accent)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Utensils className="w-8 h-8 text-[var(--raga-accent)] neon-glow" />
          RAGA Module
        </h1>
        <p className="text-muted-foreground italic">Record Asupan Gizi Anda • Pure n8n Orchestration Architecture.</p>
      </header>

      {/* RAGA OVERVIEW GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Calorie Ring Card */}
        <Card className="lg:col-span-1 bg-[var(--glass-bg)] border-[var(--glass-border)] backdrop-blur-[var(--glass-blur)] relative overflow-hidden">
          <CardHeader className="pb-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              Daily Calories
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-8">
             <div className="relative w-48 h-48 flex items-center justify-center">
                {/* SVG Progress Ring */}
                <svg className="w-full h-full -rotate-90">
                  <circle 
                    cx="96" cy="96" r="80" 
                    fill="transparent" 
                    stroke="currentColor" 
                    strokeWidth="12" 
                    className="text-muted/30"
                  />
                  <motion.circle 
                    cx="96" cy="96" r="80" 
                    fill="transparent" 
                    stroke="currentColor" 
                    strokeWidth="12" 
                    strokeDasharray={502.4}
                    initial={{ strokeDashoffset: 502.4 }}
                    animate={{ strokeDashoffset: 502.4 - (502.4 * progress) / 100 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="text-[var(--raga-accent)] neon-glow"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-4xl font-bold tracking-tighter">{totalCalories}</span>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Daily Goal</h3>
                </div>
             </div>
             <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">Target: <span className="text-foreground font-medium">{target} kcal</span></p>
                <p className="text-xs text-muted-foreground mt-1 italic">{target - totalCalories > 0 ? `${target - totalCalories} left for today` : "Limit reached!"}</p>
             </div>
          </CardContent>
        </Card>

        {/* BMI & Biometrics Card */}
        <Card className="lg:col-span-1 bg-[var(--glass-bg)] border-[var(--glass-border)] backdrop-blur-[var(--glass-blur)] relative overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Scale className="w-4 h-4 text-muted-foreground" />
              Body Assessment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <span className="text-5xl font-bold bg-gradient-to-br from-white to-zinc-600 bg-clip-text text-transparent">
                {bmi}
              </span>
              <p className="text-xs text-zinc-500 mt-1 font-medium uppercase tracking-widest text-emerald-500/80">BMI Score</p>
            </div>
            
            {/* BMI INFOGRAPHIC SCALE 2.0 */}
            <div className="space-y-3">
              <div className="flex justify-between text-[9px] text-zinc-500 uppercase font-black px-1 relative">
                <span className="w-14 text-center">Under</span>
                <span className="w-14 text-center">Healthy</span>
                <span className="w-14 text-center">Over</span>
                <span className="w-14 text-center">Obese</span>
              </div>
              <div className="relative h-4 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                <div className="h-full bg-cyan-500/80 w-[14%]" title="Underweight" />
                <div className="h-full bg-emerald-500/80 w-[26%]" title="Healthy" />
                <div className="h-full bg-amber-500/80 w-[20%]" title="Overweight" />
                <div className="h-full bg-red-500/80 w-[40%]" title="Obese" />
                
                {/* Visual Markers for Thresholds */}
                <div className="absolute left-[14%] top-0 bottom-0 w-0.5 bg-black/40 z-0" />
                <div className="absolute left-[40%] top-0 bottom-0 w-0.5 bg-black/40 z-0" />
                <div className="absolute left-[60%] top-0 bottom-0 w-0.5 bg-black/40 z-0" />

                {/* Pointer / Marker */}
                {bmi !== "N/A" && (
                  <motion.div 
                    initial={{ left: 0 }}
                    animate={{ left: `${Math.min(Math.max((parseFloat(bmi) - 15) / 25 * 100, 0), 100)}%` }}
                    className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)] z-10"
                    transition={{ type: "spring", stiffness: 50, damping: 10 }}
                  />
                )}
              </div>
              <div className="flex justify-between text-[10px] text-zinc-600 font-mono px-1">
                <span className="ml-[12%]">18.5</span>
                <span className="ml-[12%]">25.0</span>
                <span className="ml-[10%]">30.0</span>
              </div>
              
              {/* Contextual Diagnosis & Ideal Weight */}
              {bmi !== "N/A" && (
                <div className="space-y-3">
                  <div className="bg-muted/40 p-4 rounded-xl border border-border relative group">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className={cn(
                        "w-4 h-4",
                        parseFloat(bmi) >= 25 ? "text-amber-500" : "text-emerald-500"
                      )} />
                      <span className="text-[11px] font-black text-white uppercase tracking-widest">NARA Health Advisor</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                      You are in the <span className="font-bold">{getBMICategory(bmi)}</span> category.
                      {parseFloat(bmi) >= 25 && parseFloat(bmi) < 30 && (
                        <span className="block mt-2">
                          You're <span className="text-amber-400 font-bold">{(30 - parseFloat(bmi)).toFixed(1)} points</span> away from the <span className="text-red-400 font-bold">Obese</span> threshold.
                        </span>
                      )}
                      {parseFloat(bmi) >= 18.5 && parseFloat(bmi) < 25 && (
                        <span className="block mt-2 text-emerald-400 font-bold">
                          Optimal! You are within the healthy zone.
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-[var(--raga-accent)]/5 border border-[var(--raga-accent)]/20 rounded-xl">
                      <div className="p-2 rounded-lg bg-[var(--raga-accent)]/10 text-[var(--raga-accent)]">
                        <Scale className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Ideal Weight Target</p>
                        <p className="text-sm font-bold">
                          {idealWeight} kg <span className="text-[10px] text-muted-foreground font-normal lowercase ml-1">(based on BMI 22.0)</span>
                        </p>
                      </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-secondary border border-border rounded-lg group hover:border-accent transition-colors">
                <p className="text-xs text-muted-foreground">Height</p>
                <p className="text-sm font-medium">{biometrics?.height_cm || "--"} cm</p>
              </div>
              <div className="p-3 bg-secondary border border-border rounded-lg group hover:border-accent transition-colors">
                <p className="text-xs text-muted-foreground">Weight</p>
                <p className="text-sm font-medium">{biometrics?.weight_kg || "--"} kg</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Log Form Card */}
        <Card className="lg:col-span-1 bg-[var(--glass-bg)] border-[var(--raga-accent)]/20 shadow-[0_0_30px_rgba(245,158,11,0.05)] backdrop-blur-[var(--glass-blur)] border-2">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-500" />
              Quick Nutrition Log
            </CardTitle>
            <CardDescription className="text-muted-foreground">Direct n8n sync • Automatic health indexing.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddLog} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Meal Name</Label>
                <Input 
                  id="meal"
                  placeholder="e.g. Nasi Goreng Gila" 
                  value={mealName}
                  onChange={(e) => setMealName(e.target.value)}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground focus:ring-amber-500/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Calories (kcal)</Label>
                <Input 
                  id="kcal"
                  type="number"
                  placeholder="e.g. 450" 
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground focus:ring-amber-500/50"
                />
              </div>
              <Button 
                type="submit" 
                disabled={isAdding}
                className="w-full bg-[var(--raga-accent)] hover:opacity-90 text-[var(--primary-foreground)] font-bold h-12 transition-transform active:scale-95 shadow-[0_4px_15px_rgba(245,158,11,0.3)]"
              >
                {isAdding ? "Orchestrating..." : "Commit via n8n"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* TODAY'S HISTORY */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <History className="w-5 h-5 text-muted-foreground" />
          Today's History
        </h3>
        
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {logs.length > 0 ? (
              logs.map((log) => (
                <motion.div 
                  key={log.id} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative flex items-center justify-between p-4 bg-card/50 border border-border rounded-xl hover:bg-card hover:border-accent transition-all cursor-default"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-secondary text-[var(--raga-accent)] shadow-inner">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">{log.meal_name}</h4>
                      <p className="text-xs text-muted-foreground">Logged via n8n at {new Date(log.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-lg font-bold text-foreground tracking-tight">+{log.calories} <span className="text-xs text-muted-foreground font-normal">kcal</span></span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => deleteLog(log.id)}
                      className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-500 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="py-12 text-center border-2 border-dashed border-border rounded-2xl text-muted-foreground flex flex-col items-center gap-3">
                <Info className="w-8 h-8 opacity-20" />
                <p className="text-sm font-medium">No logs recorded yet today.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
