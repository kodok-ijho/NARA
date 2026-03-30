import { useState, useEffect, useCallback, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { useLanguage } from "@/lib/i18n.tsx";
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
  Sparkles,
  BarChart3,
  Clock,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  Activity
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
  CartesianGrid,
  ReferenceLine
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Tooltip as ShadTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const RAGA_WEBHOOK = import.meta.env.VITE_N8N_RAGA_WEBHOOK_URL;

interface RagaLog {
  id: string;
  meal_name: string;
  calories: number;
  logged_at: string;
  logged_on?: string;
}

interface Biometrics {
  height_cm: number;
  weight_kg: number;
  target_calories: number;
}

type ReportPeriod = "daily" | "weekly" | "monthly";

function useNutritionGamification(allLogs: RagaLog[], biometrics: Biometrics | null) {
  return useMemo(() => {
    if (!biometrics) return { monthlyScore: 0, todayPoints: 0, rank: "Novice", direction: "stable" };

    const bmi = biometrics.height_cm && biometrics.weight_kg
      ? biometrics.weight_kg / Math.pow(biometrics.height_cm / 100, 2)
      : 22;

    // Determine target direction based on BMI or Goal
    // For now, let's assume BMI > 25 is 'loss' mode, BMI < 18.5 is 'gain' mode
    // Or if we have a target weight, we could use that. Let's stick to BMI for now.
    const isLossMode = bmi > 24;
    const isGainMode = bmi < 19;

    const calculatePointsForDay = (dayLogs: RagaLog[], targetKcal: number) => {
      const total = dayLogs.reduce((s, l) => s + l.calories, 0);
      if (total === 0) return 0;
      if (targetKcal === 0) return 0;

      let points = 0;
      if (isLossMode) {
        if (total <= targetKcal) {
          points = 100;
          if (Math.abs(total - targetKcal) < 100) points += 50; 
        } else {
          points = -Math.floor((total - targetKcal) / 10);
        }
      } else if (isGainMode) {
        if (total >= targetKcal) {
          points = 100;
          if (Math.abs(total - targetKcal) < 100) points += 50;
        } else {
          points = -Math.floor((targetKcal - total) / 10);
        }
      } else {
        if (Math.abs(total - targetKcal) < 200) points = 100;
        else points = -Math.floor(Math.abs(total - targetKcal) / 20);
      }
      return points;
    };

    // Calculate Today's Points
    const todayStr = new Date().toLocaleDateString("en-CA");
    const todayLogs = allLogs.filter(l => (l.logged_on || l.logged_at).split(/[T ]/)[0] === todayStr);
    const todayPoints = calculatePointsForDay(todayLogs, biometrics.target_calories);

    // Calculate Monthly Total
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const daysMap: Record<string, RagaLog[]> = {};
    allLogs.forEach(l => {
      const d = (l.logged_on || l.logged_at).split(/[T ]/)[0];
      const lgDate = new Date(d);
      if (lgDate >= startOfMonth) {
        if (!daysMap[d]) daysMap[d] = [];
        daysMap[d].push(l);
      }
    });

    const monthlyScore = Object.values(daysMap).reduce((acc, logs) =>
      acc + calculatePointsForDay(logs, biometrics.target_calories), 0);

    let rank = "Novice";
    if (monthlyScore > 3000) rank = "Legendary Health";
    else if (monthlyScore > 1500) rank = "Nutrition Master";
    else if (monthlyScore > 500) rank = "Disciplined";

    return { monthlyScore, todayPoints, rank, calculatePointsForDay };
  }, [allLogs, biometrics]);
}

export function RagaScreen() {
  const { session } = useOutletContext<{ session: Session }>();
  const { t } = useLanguage();
  const user = session.user;

  const [allLogs, setAllLogs] = useState<RagaLog[]>([]);
  const [biometrics, setBiometrics] = useState<Biometrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("weekly");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toLocaleDateString("en-CA"));
  const [chartOffset, setChartOffset] = useState(0);

  const { monthlyScore, todayPoints, rank, calculatePointsForDay } = useNutritionGamification(allLogs, biometrics) || { monthlyScore: 0, todayPoints: 0, rank: "Novice", calculatePointsForDay: () => 0 };

  // Form States
  const [mealName, setMealName] = useState("");
  const [calories, setCalories] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);

  // Helper for datetime-local input (YYYY-MM-DDTHH:mm)
  const getLocalISOString = (date: Date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const [logDate, setLogDate] = useState(getLocalISOString(new Date()));

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
  
  const handleAIEstimate = async () => {
    if (!mealName.trim() || isEstimating) return;
    
    setIsEstimating(true);
    try {
      const response = await fetch(RAGA_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "estimate_calories",
          user_id: user.id,
          meal_name: mealName
        })
      });

      const text = await response.text();
      const result = JSON.parse(text);
      const data = Array.isArray(result) ? result[0] : result;

      if (data) {
        // Handle n8n output structure (sometimes wrapped in markdown or 'output' field)
        const rawContent = data.output || data;
        let finalData = rawContent;

        if (typeof rawContent === 'string') {
          try {
            const cleanJson = rawContent.replace(/```json|```/g, '').trim();
            finalData = JSON.parse(cleanJson);
          } catch (e) {
            console.warn("Could not parse nested JSON, using raw value if number", e);
          }
        }

        const calorieValue = finalData.calories || finalData.estimated_calories || (typeof finalData === 'number' ? finalData : null);
        
        if (calorieValue) {
          setCalories(calorieValue.toString());
        } else {
          console.warn("No calorie value found in response:", finalData);
        }
      }
    } catch (error) {
      console.error("AI Estimation Error:", error);
    } finally {
      setIsEstimating(false);
    }
  };

  // Filtering Logic
  const todayLogs = useMemo(() => {
    return allLogs
      .filter(log => (log.logged_on || log.logged_at).split(/[T ]/)[0] === selectedDate)
      .sort((a, b) => new Date(b.logged_on || b.logged_at).getTime() - new Date(a.logged_on || a.logged_at).getTime());
  }, [allLogs, selectedDate]);

  const totalCaloriesToday = useMemo(() =>
    todayLogs.reduce((sum, log) => sum + log.calories, 0)
    , [todayLogs]);

  const target = biometrics?.target_calories || 2000;
  const progress = Math.min((totalCaloriesToday / target) * 100, 100);

  // Report Data Processing
  const chartData = useMemo(() => {
    const now = new Date();
    const data: any[] = [];
    const targetKcal = target;

    if (reportPeriod === "daily") {
      // Show hourly breakdown for today
      const hours = Array.from({ length: 24 }, (_, i) => i);
      hours.forEach(hour => {
        const label = `${hour}:00`;
        const value = todayLogs
          .filter(l => {
            const dateStr = l.logged_on || l.logged_at || "";
            if (!dateStr) return false;
            try {
              const d = new Date(dateStr.replace(" ", "T"));
              const localHour = parseInt(d.toLocaleTimeString("id-ID", { 
                hour: "2-digit", 
                hour12: false
              }));
              return localHour === hour;
            } catch (e) {
              return false;
            }
          })
          .reduce((s, l) => s + l.calories, 0);
        data.push({ name: label, value });
      });
    } else if (reportPeriod === "weekly") {
      // 7 days window with offset
      const startDay = chartOffset * 7;
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (i + startDay));
        const dateStr = d.toLocaleDateString("en-CA");
        const label = d.toLocaleDateString("id-ID", { weekday: "short" });
        const dayLogs = allLogs.filter(l => (l.logged_on || l.logged_at).split(/[T ]/)[0] === dateStr);
        const value = dayLogs.reduce((s, l) => s + l.calories, 0);
        const points = calculatePointsForDay ? calculatePointsForDay(dayLogs, targetKcal) : 0;
        data.push({ name: label, value, fullDate: dateStr, points });
      }
    } else {
      // 30 days window with offset
      const startDay = chartOffset * 30;
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (i + startDay));
        const dateStr = d.toLocaleDateString("en-CA");
        const label = d.getDate().toString();
        const dayLogs = allLogs.filter(l => (l.logged_on || l.logged_at).split(/[T ]/)[0] === dateStr);
        const value = dayLogs.reduce((s, l) => s + l.calories, 0);
        const points = calculatePointsForDay ? calculatePointsForDay(dayLogs, targetKcal) : 0;
        data.push({ name: label, value, fullDate: dateStr, points });
      }
    }
    return data;
  }, [allLogs, todayLogs, reportPeriod, chartOffset, target, calculatePointsForDay]);

  const stats = useMemo(() => {
    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    const avg = Math.round(total / chartData.length);
    const max = Math.max(...chartData.map(item => item.value));
    return { total, avg, max };
  }, [chartData]);

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealName || !calories) return;

    // Future date validation
    if (new Date(logDate) > new Date()) {
      toast.error("Invalid Timeline", {
        description: "You cannot log meals for future dates.",
      });
      return;
    }

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
            logged_on: logDate.replace("T", " ") + ":00",
          }
        })
      });

      if (response.ok) {
        toast.success(`${mealName} Logged`, {
          description: `Successfully synchronized to NARA.`,
        });
        setMealName("");
        setCalories("");
        setLogDate(getLocalISOString(new Date()));
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
    : t('profile.awaiting_data');

  const getBMICategory = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return t('profile.awaiting_data');
    if (num < 18.5) return t('profile.underweight');
    if (num < 25) return t('profile.healthy');
    if (num < 30) return t('profile.overweight');
    return t('profile.obese');
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-4xl font-extrabold tracking-tight flex items-center gap-4">
              <Utensils className="w-10 h-10 text-emerald-500 neon-glow" />
              RAGA <span className="text-muted-foreground font-light text-2xl">| {t('raga.title')}</span>
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl font-medium italic">
              {t('raga.subtitle')}
            </p>
          </div>
          <TooltipProvider>
            <ShadTooltip>
              <TooltipTrigger asChild>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl backdrop-blur-md cursor-help"
                >
                  <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-600">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-emerald-600/80 tracking-widest">{t('raga.active_rank')}</p>
                    <p className="text-xl font-black text-emerald-950 dark:text-white tracking-tighter leading-none">{rank}</p>
                  </div>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="p-4 bg-zinc-900 border-zinc-800 text-white w-64 rounded-2xl shadow-2xl">
                <div className="space-y-3">
                  <p className="text-xs font-black uppercase tracking-widest text-emerald-500 border-b border-white/10 pb-2">{t('raga.thresholds')}</p>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                    <span className="text-zinc-400">Legendary</span>
                    <span className="text-right">{">"} 3000 pts</span>
                    <span className="text-zinc-400">Master</span>
                    <span className="text-right">1501-3000 pts</span>
                    <span className="text-zinc-400">Disciplined</span>
                    <span className="text-right">501-1500 pts</span>
                    <span className="text-zinc-400">Novice</span>
                    <span className="text-right">0-500 pts</span>
                  </div>
                  <p className="text-[9px] text-zinc-500 italic mt-2">*Points reset every month</p>
                </div>
              </TooltipContent>
            </ShadTooltip>
          </TooltipProvider>
        </div>
      </motion.header>

      {/* MAIN OVERVIEW SECTION */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* PROGRESS RING CARD */}
        <Card className="xl:col-span-1 bg-card/40 backdrop-blur-xl border-white/5 relative group transition-all duration-500 hover:border-emerald-500/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-500" />
                {selectedDate === new Date().toLocaleDateString("en-CA") ? t('raga.daily_kcal') : `${t('raga.analysis')}: ${new Date(selectedDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
              </span>
              <div className="flex items-center gap-2">
                {selectedDate !== new Date().toLocaleDateString("en-CA") && (
                  <button 
                    onClick={() => {
                      setSelectedDate(new Date().toLocaleDateString("en-CA"));
                      setReportPeriod("daily");
                    }}
                    className="text-[10px] font-black text-emerald-500 hover:underline uppercase"
                  >
                    {t('raga.daily')}
                  </button>
                )}
                <span className="text-xs font-mono px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500">
                  {selectedDate === new Date().toLocaleDateString("en-CA") ? "Live" : "Archive"}
                </span>
              </div>
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
                  animate={{
                    strokeDashoffset: 596.6 - (596.6 * Math.min(progress, 100)) / 100,
                    color: totalCaloriesToday > target ? "#f43f5e" : "#10b981"
                  }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="neon-glow"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute text-center">
                <motion.span
                  key={totalCaloriesToday}
                  initial={{ scale: 0.8 }}
                  animate={{
                    scale: totalCaloriesToday > target ? [1, 1.05, 1] : 1,
                    color: totalCaloriesToday > target ? "#f43f5e" : "#ffffff"
                  }}
                  transition={{ duration: 2, repeat: totalCaloriesToday > target ? Infinity : 0 }}
                  className="text-5xl font-black tracking-tighter"
                >
                  {totalCaloriesToday}
                </motion.span>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">kcal logged</p>
              </div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-8 w-full">
              <div className="text-center p-3 rounded-2xl bg-white/5 border border-white/5">
                <p className="text-[10px] text-muted-foreground uppercase font-black">{t('raga.target')}</p>
                <p className="text-lg font-bold">{target}</p>
              </div>
              <div className="text-center p-3 rounded-2xl bg-white/5 border border-white/5">
                <p className="text-[10px] text-muted-foreground uppercase font-black">{t('raga.remaining')}</p>
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
                {t('raga.analysis')}
              </CardTitle>
              <CardDescription>{t('raga.subtitle')}</CardDescription>
            </div>
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
              {(["daily", "weekly", "monthly"] as ReportPeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => { setReportPeriod(p); setChartOffset(0); }}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold rounded-lg transition-all capitalize",
                    reportPeriod === p
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t(`raga.${p}`)}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Stats Summary Bar */}
            <div className="grid grid-cols-3 gap-4 px-6 pt-6 mb-4">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">{t('raga.period_total')}</p>
                <p className="text-2xl font-bold">{stats.total} <span className="text-xs font-normal text-muted-foreground">kcal</span></p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">{t('raga.daily_avg')}</p>
                <p className="text-2xl font-bold text-emerald-400">{stats.avg} <span className="text-xs font-normal text-muted-foreground">kcal</span></p>
              </div>
              <div className="flex items-end justify-end gap-2">
                {reportPeriod !== "daily" && (
                  <>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setChartOffset(prev => prev + 1)}
                      className="h-8 w-8 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      disabled={chartOffset <= 0}
                      onClick={() => setChartOffset(prev => Math.max(0, prev - 1))}
                      className="h-8 w-8 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 disabled:opacity-20 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Main Graph */}
            <div className="h-[280px] w-full mt-4 pr-4">
              <ResponsiveContainer width="100%" height="100%">
                {reportPeriod === "daily" ? (
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      interval={2}
                    />
                    <YAxis domain={[0, (dataMax: number) => Math.max(dataMax, target) * 1.2]} hide />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      itemStyle={{ color: '#10b981' }}
                    />
                    <ReferenceLine 
                      y={target} 
                      stroke="#f43f5e" 
                      strokeDasharray="3 3" 
                      label={{ value: t('raga.target'), position: 'right', fill: '#f43f5e', fontSize: 10, fontWeight: 'bold' }} 
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
                      tick={{ fontSize: 10, fill: '#71717a' }}
                    />
                    <YAxis domain={[0, (dataMax: number) => Math.max(dataMax, target) * 1.2]} hide />
                    <Tooltip
                      key={`tooltip-${reportPeriod}`}
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      itemStyle={{ color: '#10b981' }}
                      labelFormatter={(label) => {
                        const d = new Date(label);
                        return d.toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' });
                      }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const isOver = data.value > target;
                          return (
                            <div className="bg-zinc-900 border border-white/10 p-3 rounded-xl shadow-2xl space-y-1">
                              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                                {new Date(data.fullDate).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
                              </p>
                              <div className="flex items-center justify-between gap-6">
                                <span className="text-sm font-bold text-white">{data.value} kcal</span>
                                <span className={cn(
                                  "text-[10px] font-black px-2 py-0.5 rounded-full border",
                                  data.points >= 100 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                                  data.points > 0 ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
                                  "bg-red-500/10 border-red-500/20 text-red-500"
                                )}>
                                  {data.points >= 0 ? "+" : ""}{data.points} pts
                                </span>
                              </div>
                              {isOver && (
                                <p className="text-[9px] text-red-400 font-bold mt-1 tracking-tight">⚠️ {t('raga.over_target')} ({data.value - target} kcal)</p>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine 
                      y={target} 
                      stroke="#f43f5e" 
                      strokeDasharray="3 3" 
                      strokeWidth={1}
                      label={{ value: t('raga.target'), position: 'insideTopRight', fill: '#f43f5e', fontSize: 10, fontWeight: 'bold', offset: 10 }} 
                    />
                    <Bar 
                      dataKey="value" 
                      radius={[6, 6, 0, 0]} 
                      onClick={(data: any) => {
                        if (data && data.fullDate) {
                          setSelectedDate(data.fullDate);
                          setReportPeriod("daily");
                          // Also update logDate to match selected day
                          const d = new Date(data.fullDate);
                          d.setHours(new Date().getHours(), new Date().getMinutes());
                          setLogDate(getLocalISOString(d));
                          window.scrollTo({ top: 400, behavior: 'smooth' });
                        }
                      }}
                      className="cursor-pointer"
                    >
                      {chartData.map((entry, index) => {
                        const isOver = entry.value > target;
                        const isSelected = entry.fullDate === selectedDate;
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={isOver ? '#f43f5e' : (isSelected ? '#10b981' : '#10b981')}
                            fillOpacity={isSelected ? 1 : 0.6}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: List & Analysis */}
      <div className="lg:col-span-2 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className={cn(
            "border-white/5 backdrop-blur-xl transition-colors duration-500",
            totalCaloriesToday > (biometrics?.target_calories || 2000)
              ? "bg-rose-500/5 border-rose-500/20"
              : "bg-card/40"
          )}>
            <CardContent className="p-8">
              <div className="flex flex-col justify-between h-full gap-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Activity className={cn(
                      "w-4 h-4",
                      totalCaloriesToday > (biometrics?.target_calories || 2000) ? "text-rose-500" : "text-emerald-500"
                    )} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-mono">{t('raga.analysis')} Index Summary</span>
                    {totalCaloriesToday > (biometrics?.target_calories || 2000) && (
                      <span className="text-[8px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-full animate-pulse">{t('raga.over_target_hint')}</span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <h3 className={cn(
                      "text-5xl font-black tracking-tighter",
                      totalCaloriesToday > (biometrics?.target_calories || 2000) ? "text-rose-500" : "text-zinc-950 dark:text-white"
                    )}>
                      {totalCaloriesToday}
                    </h3>
                    <span className="text-muted-foreground text-sm font-medium">/ {biometrics?.target_calories || 2000} kcal</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <TooltipProvider>
            <ShadTooltip>
              <TooltipTrigger asChild>
                <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20 backdrop-blur-xl cursor-help group hover:border-amber-500/40 transition-all">
                  <CardContent className="p-8">
                    <div className="flex flex-col h-full justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-amber-500" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-amber-500 transition-colors">Nutrition Performance</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <h3 className="text-5xl font-black text-amber-500 tracking-tighter">{monthlyScore}</h3>
                          <span className="text-muted-foreground text-sm font-medium lowercase">monthly {t('raga.pts')}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest pt-2 border-t border-white/5">
                        <span className={todayPoints >= 0 ? "text-emerald-500" : "text-rose-500"}>
                          {t('raga.daily').charAt(0).toUpperCase() + t('raga.daily').slice(1)}: {todayPoints > 0 ? "+" : ""}{todayPoints} {t('raga.pts')}
                        </span>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <span>lvl: {rank}</span>
                          <Info className="w-3 h-3 text-amber-500/50" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="top" className="p-5 bg-zinc-950 border-amber-500/20 text-white w-72 rounded-3xl shadow-2xl backdrop-blur-xl">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <p className="text-xs font-black uppercase tracking-widest text-amber-500">Scoring Engine</p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-emerald-400">Success (+100 to +150 pts)</p>
                      <p className="text-[9px] text-zinc-400">Hit your calorie goal for the day. Perfect hits get bonus points!</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-rose-400">Penalty (Minus pts)</p>
                      <p className="text-[9px] text-zinc-400">Going over (in Loss mode) or under (in Gain mode) costs points based on the offset.</p>
                    </div>
                  </div>

                  <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-[9px] font-black uppercase text-zinc-500 mb-1">{t('common.mode')}</p>
                    <p className="text-[10px] font-bold text-emerald-500 capitalize">{t('raga.strategy_active')}</p>
                  </div>
                </div>
              </TooltipContent>
            </ShadTooltip>
          </TooltipProvider>
        </div>

        <Card className="bg-card/40 border-white/5 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Detailed Analysis</CardTitle>
              <CardDescription>Trends based on your {reportPeriod} data.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-8 mb-8 p-6 bg-white/5 rounded-2xl border border-white/5">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Total Calories</p>
                <p className="text-2xl font-bold">{stats.total} <span className="text-xs font-normal text-muted-foreground">kcal</span></p>
              </div>
              <div className="space-y-1 border-x border-white/5 px-8">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Daily Avg</p>
                <p className="text-2xl font-bold">{stats.avg} <span className="text-xs font-normal text-muted-foreground">kcal</span></p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Peak Intake</p>
                <p className="text-2xl font-bold">{stats.max} <span className="text-xs font-normal text-muted-foreground">kcal</span></p>
              </div>
            </div>
          </CardContent>
        </Card>

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
                  <div className="md:col-span-2 space-y-3">
                    <Label className="text-muted-foreground text-[10px] font-black uppercase tracking-widest px-1">Meal Discovery</Label>
                    <div className="relative group/input">
                      <Input
                        placeholder="Lunch: Nasi Hainan..."
                        value={mealName}
                        onChange={(e) => setMealName(e.target.value)}
                        className="bg-white/5 border-white/5 h-14 rounded-2xl focus:ring-emerald-500/40 focus:border-emerald-500/40 text-lg transition-all pr-12"
                      />
                      <button
                        type="button"
                        onClick={handleAIEstimate}
                        disabled={!mealName.trim() || isEstimating}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title={t('raga.ai_estimate_btn')}
                      >
                        <Sparkles className={`w-5 h-5 ${isEstimating ? "animate-pulse" : ""}`} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3 relative">
                    <Label className="text-muted-foreground text-[10px] font-black uppercase tracking-widest px-1">{t('raga.kcal_placeholder')}</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="---"
                        value={calories}
                        onChange={(e) => setCalories(e.target.value)}
                        className={`bg-white/5 border-white/5 h-14 rounded-2xl focus:ring-emerald-500/40 focus:border-emerald-500/40 text-lg transition-all pl-12 ${isEstimating ? "animate-pulse border-emerald-500/50" : ""}`}
                      />
                      {isEstimating && (
                        <div className="absolute inset-0 bg-emerald-500/5 rounded-2xl animate-pulse pointer-events-none" />
                      )}
                    </div>
                    {isEstimating && (
                      <p className="absolute -bottom-5 left-1 text-[8px] font-bold text-emerald-500 animate-bounce">
                        {t('raga.ai_estimating')}
                      </p>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <Label className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">Log Timeline</Label>
                      <button
                        type="button"
                        onClick={() => setLogDate(getLocalISOString(new Date()))}
                        className="text-[8px] font-black text-emerald-500 uppercase hover:underline"
                      >
                        Reset to Now
                      </button>
                    </div>
                    <Input
                      type="datetime-local"
                      value={logDate}
                      max={getLocalISOString(new Date())}
                      onChange={(e) => setLogDate(e.target.value)}
                      className="bg-white/5 border-white/5 h-14 rounded-2xl focus:ring-emerald-500/40 focus:border-emerald-500/40 text-sm transition-all [color-scheme:dark] block w-full px-4"
                    />
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
                {selectedDate === new Date().toLocaleDateString("en-CA") ? "Today's Activity" : `Activity: ${new Date(selectedDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
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
                            <Clock className="w-3 h-3 text-emerald-600/50" />
                            <p className="text-[10px] text-emerald-700/60 dark:text-muted-foreground font-black uppercase tracking-tighter">
                              {(() => {
                                const dateStr = log.logged_on || log.logged_at || "";
                                if (!dateStr) return "--:--";
                                try {
                                  // Use Device-Local Time display
                                  const d = new Date(dateStr.replace(" ", "T"));
                                  return d.toLocaleTimeString("id-ID", { 
                                    hour: "2-digit", 
                                    minute: "2-digit",
                                    hour12: false
                                  });
                                } catch (e) {
                                  return "--:--";
                                }
                              })()}
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
                <span className="text-6xl font-black text-slate-900 dark:text-white leading-none tracking-tighter">{bmi}</span>
                <div className="mb-1 space-y-0.5">
                  <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest">BMI Points</p>
                  <p className="text-xs font-bold text-slate-600 dark:text-emerald-200/60">{getBMICategory(bmi)}</p>
                </div>
              </div>
              <div className="relative h-2.5 w-full bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden mt-6 ring-1 ring-slate-900/5">
                <div className="absolute inset-0 flex">
                  <div className="h-full bg-cyan-500/20 dark:bg-cyan-500/40 w-[14%]" />
                  <div className="h-full bg-emerald-500/20 dark:bg-emerald-500/40 w-[26%]" />
                  <div className="h-full bg-amber-500/20 dark:bg-amber-500/40 w-[20%]" />
                  <div className="h-full bg-rose-500/20 dark:bg-rose-500/40 w-[40%]" />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-emerald-500/5 dark:bg-black/20 p-5 rounded-2xl flex items-center justify-between group cursor-default border border-emerald-500/10 dark:border-white/5 hover:border-emerald-500/30 transition-all duration-300">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-emerald-700/70 dark:text-muted-foreground tracking-widest">Ideal Weight</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{(22 * Math.pow((biometrics?.height_cm || 0) / 100, 2)).toFixed(1)} <span className="text-xs font-normal opacity-50">kg</span></p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-emerald-500/50 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                </div>
                <div className="bg-emerald-500/5 dark:bg-black/20 p-5 rounded-2xl flex items-center justify-between group cursor-default border border-emerald-500/10 dark:border-white/5 hover:border-emerald-500/30 transition-all duration-300">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-emerald-700/70 dark:text-muted-foreground tracking-widest">BMR Index</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{Math.round((biometrics?.target_calories || 0) * 0.7)} <span className="text-xs font-normal opacity-50">kcal</span></p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-emerald-500/50 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
