import { useState, useEffect, useCallback, useMemo } from "react";
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
  Info,
  BarChart3,
  Calendar,
  TrendingUp,
  ChevronRight
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  AreaChart,
  Area,
  CartesianGrid
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

type ReportPeriod = "daily" | "weekly" | "monthly";

export function RagaScreen() {
  const { session } = useOutletContext<{ session: Session }>();
  const user = session.user;

  const [allLogs, setAllLogs] = useState<RagaLog[]>([]);
  const [biometrics, setBiometrics] = useState<Biometrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("weekly");
  
  // Form States
  const [mealName, setMealName] = useState("");
  const [calories, setCalories] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
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
      const data = Array.isArray(result) ? result[0] : result;

      if (data) {
        if (data.logs) setAllLogs(data.logs);
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

  // Filtering Logic
  const todayLogs = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return allLogs
      .filter(log => log.logged_at.split("T")[0] === today)
      .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());
  }, [allLogs]);

  const totalCaloriesToday = useMemo(() => 
    todayLogs.reduce((sum, log) => sum + log.calories, 0)
  , [todayLogs]);

  const target = biometrics?.target_calories || 2000;
  const progress = Math.min((totalCaloriesToday / target) * 100, 100);

  // Report Data Processing
  const chartData = useMemo(() => {
    const now = new Date();
    const data: any[] = [];
    
    if (reportPeriod === "daily") {
        // Show hourly breakdown for today
        const hours = Array.from({length: 24}, (_, i) => i);
        hours.forEach(hour => {
            const label = `${hour}:00`;
            const value = todayLogs
                .filter(l => new Date(l.logged_at).getHours() === hour)
                .reduce((s, l) => s + l.calories, 0);
            data.push({ name: label, value });
        });
    } else if (reportPeriod === "weekly") {
        // Last 7 days
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            const dateStr = d.toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
            const label = d.toLocaleDateString("id-ID", { weekday: "short" });
            const value = allLogs
                .filter(l => new Date(l.logged_at).toLocaleDateString("en-CA") === dateStr)
                .reduce((s, l) => s + l.calories, 0);
            data.push({ name: label, value, fullDate: dateStr });
        }
    } else {
        // Last 30 days
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            const dateStr = d.toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
            const label = d.getDate().toString();
            const value = allLogs
                .filter(l => new Date(l.logged_at).toLocaleDateString("en-CA") === dateStr)
                .reduce((s, l) => s + l.calories, 0);
            data.push({ name: label, value, fullDate: dateStr });
        }
    }
    return data;
  }, [allLogs, todayLogs, reportPeriod]);

  const stats = useMemo(() => {
    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    const avg = Math.round(total / chartData.length);
    const max = Math.max(...chartData.map(item => item.value));
    return { total, avg, max };
  }, [chartData]);

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
          description: `Successfully synchronized to NARA.`,
        });
        setMealName("");
        setCalories("");
        fetchData();
      } else {
        throw new Error("Webhook placement failed");
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
      console.error("Delete failed", error);
    }
  };

  const bmi = biometrics?.height_cm && biometrics?.weight_kg
    ? (biometrics.weight_kg / Math.pow(biometrics.height_cm / 100, 2)).toFixed(1)
    : "N/A";

  const getBMICategory = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "N/A";
    if (num < 18.5) return "Underweight";
    if (num < 25) return "Healthy";
    if (num < 30) return "Overweight";
    return "Obese";
  };

  if (isLoading && allLogs.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header with Glass Gradient */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative p-8 rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-500/10 to-transparent border border-white/10"
      >
        <div className="absolute top-0 right-0 p-8 opacity-10">
            <Utensils className="w-32 h-32 text-emerald-500" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight flex items-center gap-4">
          <Utensils className="w-10 h-10 text-emerald-500 neon-glow" />
          RAGA <span className="text-muted-foreground font-light text-2xl">| Nutrition Hub</span>
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl font-medium italic">
          Record Asupan Gizi Anda: Daily monitoring, weekly trends, and monthly health analysis powered by NARA.
        </p>
      </motion.header>

      {/* MAIN OVERVIEW SECTION */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* PROGRESS RING CARD */}
        <Card className="xl:col-span-1 bg-card/40 backdrop-blur-xl border-white/5 relative group transition-all duration-500 hover:border-emerald-500/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-500" />
                Daily Calories
              </span>
              <span className="text-xs font-mono px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500">Live</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-8">
             <div className="relative w-56 h-56 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle 
                    cx="112" cy="112" r="95" 
                    fill="transparent" 
                    stroke="currentColor" 
                    strokeWidth="14" 
                    className="text-white/5"
                  />
                  <motion.circle 
                    cx="112" cy="112" r="95" 
                    fill="transparent" 
                    stroke="currentColor" 
                    strokeWidth="14" 
                    strokeDasharray={596.6}
                    initial={{ strokeDashoffset: 596.6 }}
                    animate={{ strokeDashoffset: 596.6 - (596.6 * progress) / 100 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="text-emerald-500 neon-glow"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute text-center">
                  <motion.span 
                    key={totalCaloriesToday}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="text-5xl font-black tracking-tighter"
                  >
                    {totalCaloriesToday}
                  </motion.span>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">kcal logged</p>
                </div>
             </div>
             <div className="mt-8 grid grid-cols-2 gap-8 w-full">
                <div className="text-center p-3 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-[10px] text-muted-foreground uppercase font-black">Target</p>
                    <p className="text-lg font-bold">{target}</p>
                </div>
                <div className="text-center p-3 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-[10px] text-muted-foreground uppercase font-black">Remaining</p>
                    <p className={cn(
                        "text-lg font-bold",
                        target - totalCaloriesToday < 0 ? "text-rose-500" : "text-emerald-500"
                    )}>
                        {Math.max(0, target - totalCaloriesToday)}
                    </p>
                </div>
             </div>
          </CardContent>
        </Card>

        {/* COMPREHENSIVE ANALYSIS CARD */}
        <Card className="xl:col-span-2 bg-card/40 backdrop-blur-xl border-white/5 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-0">
                <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-emerald-500" />
                        Analysis & Reports
                    </CardTitle>
                    <CardDescription>Historical review of your nutritional intake</CardDescription>
                </div>
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                    {(["daily", "weekly", "monthly"] as ReportPeriod[]).map((p) => (
                        <button
                            key={p}
                            onClick={() => setReportPeriod(p)}
                            className={cn(
                                "px-4 py-1.5 text-xs font-bold rounded-lg transition-all capitalize",
                                reportPeriod === p 
                                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {/* Stats Summary Bar */}
                <div className="grid grid-cols-3 gap-4 px-6 pt-6 mb-4">
                    <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Period Total</p>
                        <p className="text-2xl font-bold">{stats.total} <span className="text-xs font-normal text-muted-foreground">kcal</span></p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Daily Avg</p>
                        <p className="text-2xl font-bold text-emerald-400">{stats.avg} <span className="text-xs font-normal text-muted-foreground">kcal</span></p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Peak Intake</p>
                        <p className="text-2xl font-bold">{stats.max} <span className="text-xs font-normal text-muted-foreground">kcal</span></p>
                    </div>
                </div>

                {/* Main Graph */}
                <div className="h-[280px] w-full mt-4 pr-4">
                    <ResponsiveContainer width="100%" height="100%">
                        {reportPeriod === "daily" ? (
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fontSize: 10, fill: '#71717a'}} 
                                    interval={2}
                                />
                                <YAxis hide />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    itemStyle={{ color: '#10b981' }}
                                />
                                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                            </AreaChart>
                        ) : (
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis 
                                    dataKey="fullDate" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tickFormatter={(str) => {
                                        if (!str) return "";
                                        const d = new Date(str);
                                        return reportPeriod === "weekly" 
                                            ? d.toLocaleDateString("id-ID", { weekday: "short" })
                                            : d.getDate().toString();
                                    }}
                                    tick={{fontSize: 10, fill: '#71717a'}} 
                                />
                                <YAxis hide />
                                <Tooltip 
                                    key={`tooltip-${reportPeriod}`}
                                    cursor={{fill: 'rgba(255,255,255,0.03)'}}
                                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    itemStyle={{ color: '#10b981' }}
                                    labelFormatter={(label) => {
                                        const d = new Date(label);
                                        return d.toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' });
                                    }}
                                />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={entry.value > target ? '#f43f5e' : '#10b981'} 
                                            fillOpacity={0.8}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* QUICK LOG FORM - REDESIGNED */}
        <Card className="bg-gradient-to-br from-emerald-500/5 to-transparent border-emerald-500/20 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-xl font-black flex items-center gap-3">
              <Plus className="w-6 h-6 text-emerald-500" />
              Quick Nutrition Log
            </CardTitle>
            <CardDescription>Instant synchronization to your NARA profile.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddLog} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <Label className="text-muted-foreground text-[10px] font-black uppercase tracking-widest px-1">Meal Discovery</Label>
                    <div className="relative">
                        <Input 
                            placeholder="Lunch: Nasi Hainan..." 
                            value={mealName}
                            onChange={(e) => setMealName(e.target.value)}
                            className="bg-white/5 border-white/5 h-14 rounded-2xl focus:ring-emerald-500/40 focus:border-emerald-500/40 text-lg transition-all"
                        />
                        <div className="absolute right-4 top-4 opacity-20">
                            <Utensils className="w-6 h-6" />
                        </div>
                    </div>
                </div>
                <div className="space-y-3">
                    <Label className="text-muted-foreground text-[10px] font-black uppercase tracking-widest px-1">Calorie Count</Label>
                    <div className="relative">
                        <Input 
                            type="number"
                            placeholder="650" 
                            value={calories}
                            onChange={(e) => setCalories(e.target.value)}
                            className="bg-white/5 border-white/5 h-14 rounded-2xl focus:ring-emerald-500/40 focus:border-emerald-500/40 text-lg transition-all"
                        />
                        <div className="absolute right-4 top-4 opacity-20">
                            <Zap className="w-6 h-6" />
                        </div>
                    </div>
                </div>
              </div>
              <Button 
                type="submit" 
                disabled={isAdding}
                className="w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-lg transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/25"
              >
                {isAdding ? (
                    <div className="flex items-center gap-2">
                         <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                         Syncing...
                    </div>
                ) : "Create Log Entry"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* LOG HISTORY - CLEANER LIST */}
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-black flex items-center gap-3">
                    <History className="w-5 h-5 text-emerald-500" />
                    Today's Activity
                </h3>
                <span className="text-[10px] font-bold px-2 py-1 bg-white/5 rounded-lg border border-white/5">
                    {todayLogs.length} Entries
                </span>
            </div>
            
            <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                <AnimatePresence initial={false} mode="popLayout">
                    {todayLogs.length > 0 ? (
                    todayLogs.map((log) => (
                        <motion.div 
                            key={log.id} 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="group relative flex items-center justify-between p-5 bg-card/30 border border-white/5 rounded-3xl hover:bg-white/5 hover:border-emerald-500/20 transition-all"
                        >
                            <div className="flex items-center gap-5">
                                <div className="p-4 rounded-2xl bg-emerald-500/5 text-emerald-500 shadow-inner group-hover:scale-110 transition-transform">
                                    <Zap className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg leading-tight">{log.meal_name}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Calendar className="w-3 h-3 text-muted-foreground" />
                                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">
                                            {new Date(log.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <span className="text-2xl font-black text-emerald-500 tracking-tighter">+{log.calories}</span>
                                    <p className="text-[8px] font-black uppercase text-muted-foreground -mt-1">Kcal</p>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => deleteLog(log.id)}
                                    className="opacity-0 group-hover:opacity-100 rounded-full hover:bg-rose-500/10 hover:text-rose-500 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </motion.div>
                    ))
                    ) : (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="py-16 text-center border-2 border-dashed border-white/5 rounded-[32px] text-muted-foreground flex flex-col items-center gap-4"
                    >
                        <div className="p-5 rounded-full bg-white/5">
                            <Info className="w-10 h-10 opacity-20" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-black uppercase tracking-widest">No Logs Yet</p>
                            <p className="text-xs opacity-60">Record your first meal to start your daily health index.</p>
                        </div>
                    </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
      </div>

      {/* FOOTER SECTION: BIOMETRIC BRAIN */}
      <Card className="bg-card/40 backdrop-blur-xl border-white/5 overflow-hidden">
          <CardContent className="p-0">
              <div className="flex flex-col md:flex-row items-stretch">
                  <div className="p-8 border-b md:border-b-0 md:border-r border-white/5 flex-1 space-y-4">
                        <div className="flex items-center gap-3">
                            <Scale className="w-5 h-5 text-emerald-500" />
                            <h3 className="font-black text-lg uppercase tracking-wider">Body Assessment</h3>
                        </div>
                        <div className="flex items-end gap-3">
                            <span className="text-6xl font-black text-white leading-none">{bmi}</span>
                            <div className="mb-1 space-y-0.5">
                                <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">BMI Points</p>
                                <p className="text-xs font-bold text-muted-foreground">{getBMICategory(bmi)}</p>
                            </div>
                        </div>
                        <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden mt-6">
                            <div className="absolute inset-0 flex">
                                <div className="h-full bg-cyan-500/40 w-[14%]" />
                                <div className="h-full bg-emerald-500/40 w-[26%]" />
                                <div className="h-full bg-amber-500/40 w-[20%]" />
                                <div className="h-full bg-rose-500/40 w-[40%]" />
                            </div>
                            {bmi !== "N/A" && (
                                <motion.div 
                                    initial={{ left: 0 }}
                                    animate={{ left: `${Math.min(Math.max((parseFloat(bmi) - 15) / 25 * 100, 0), 100)}%` }}
                                    className="absolute top-0 bottom-0 w-1.5 bg-white shadow-[0_0_15px_white] z-10"
                                />
                            )}
                        </div>
                  </div>
                  <div className="p-8 flex-1 bg-white/5 space-y-6">
                        <div className="space-y-2">
                             <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-emerald-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Premium Insights</span>
                             </div>
                             <p className="text-sm font-medium leading-relaxed">
                                You are tracking <span className="text-emerald-400 font-bold">{totalCaloriesToday} kcal</span> today. 
                                Based on your biometrics ({biometrics?.weight_kg}kg, {biometrics?.height_cm}cm), your ideal target is <span className="font-bold underline decoration-emerald-500">{target} kcal</span>.
                             </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black/20 p-4 rounded-2xl flex items-center justify-between group cursor-default border border-white/5 hover:border-emerald-500/30 transition-colors">
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter">Ideal Body Weight</p>
                                    <p className="font-bold">{(22 * Math.pow((biometrics?.height_cm || 0) / 100, 2)).toFixed(1)} <span className="text-[10px] font-normal opacity-50">kg</span></p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                            </div>
                            <div className="bg-black/20 p-4 rounded-2xl flex items-center justify-between group cursor-default border border-white/5 hover:border-emerald-500/30 transition-colors">
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter">BMR Index</p>
                                    <p className="font-bold">{Math.round((biometrics?.target_calories || 0) * 0.7)} <span className="text-[10px] font-normal opacity-50">kcal/day</span></p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                            </div>
                        </div>
                  </div>
              </div>
          </CardContent>
      </Card>
    </div>
  );
}
