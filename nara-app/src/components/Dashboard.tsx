import { useOutletContext } from "react-router-dom";
import { useLanguage } from "@/lib/i18n.tsx";
import type { Session } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity, 
  Zap,
  Wallet,
  Target,
  CalendarCheck,
  Clock,
  Plus
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Tag } from "lucide-react";
import { DEFAULT_CATEGORIES } from "./ArtaScreen";
import { useFilters } from "../context/FilterContext";
import { calculateBMI, calculatePointsForDay, getRankByScore } from "../lib/healthUtils";

export function Dashboard() {
  const { session } = useOutletContext<{ session: Session }>();
  const { t } = useLanguage();
  const user = session.user;
  const fullName = user.user_metadata?.full_name || user.email;

  const { startDate, endDate } = useFilters();
  const [artaData, setArtaData] = useState<any>(null);
  const [ragaData, setRagaData] = useState<any>(null);
  const [masaData, setMasaData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const ARTA_URL = import.meta.env.VITE_N8N_ARTA_WEBHOOK_URL;
  const RAGA_URL = import.meta.env.VITE_N8N_RAGA_WEBHOOK_URL;
  const MASA_URL = import.meta.env.VITE_N8N_MASA_WEBHOOK_URL;

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const artaPayload = {
          action: "get_data",
          user_id: user.id,
          ...(startDate && { start_date: startDate }),
          ...(endDate && { end_date: endDate })
        };

        const [artaResRaw, ragaResRaw, masaResRaw] = await Promise.all([
          fetch(ARTA_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(artaPayload) }).then(r => r.json()).catch(() => null),
          fetch(RAGA_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_data", user_id: user.id }) }).then(r => r.json()).catch(() => null),
          fetch(MASA_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_data", user_id: user.id }) }).then(r => r.json()).catch(() => null),
        ]);

        console.log("[Dashboard] Raw ARTA:", artaResRaw);
        console.log("[Dashboard] Raw RAGA:", ragaResRaw);
        console.log("[Dashboard] Raw MASA:", masaResRaw);

        const artaRes = Array.isArray(artaResRaw) ? artaResRaw[0] : artaResRaw;
        const ragaRes = Array.isArray(ragaResRaw) ? ragaResRaw[0] : ragaResRaw;
        const masaRes = Array.isArray(masaResRaw) ? masaResRaw[0] : masaResRaw;

        setArtaData(artaRes);
        setRagaData(ragaRes);
        setMasaData(masaRes);
      } catch (error) {
        console.error("Dashboard Sync Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [user.id, startDate, endDate]);

  // Calculate ARTA breakdowns locally for consistency
  const { artaExpenseBreakdown, artaIncomeBreakdown } = useMemo(() => {
    if (!artaData?.transactions || !artaData?.categories) return { artaExpenseBreakdown: [], artaIncomeBreakdown: [] };
    
    const expenseTotals: Record<string, { name: string, total: number }> = {};
    const incomeTotals: Record<string, { name: string, total: number }> = {};
    
    // Parse range dates from local storage
    const start = localStorage.getItem("nara-arta-start-date");
    const end = localStorage.getItem("nara-arta-end-date");
    
    // Fallback to current month if no range is specified
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const inRange = (dateStr: string) => {
      if (!dateStr) return true;
      const d = new Date(dateStr);
      if (start || end) {
        if (start && d < new Date(start)) return false;
        if (end && d > new Date(end)) return false;
        return true;
      } else {
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }
    };
    
    const getCategoryById = (id: string | null) => {
      if (!id) return { name: "Other", type: "expense" };
      const fetched = artaData.categories.find((c: any) => c.id === id);
      if (fetched) return fetched;
      const fallback = DEFAULT_CATEGORIES.find(c => c.id === id);
      if (fallback) return fallback;
      return { name: "Other", type: "expense" };
    };

    artaData.transactions.forEach((tx: any) => {
      if (!inRange(tx.date || tx.created_at)) return;
      
      const cat = getCategoryById(tx.category_id);
      const status = tx.type || "expense"; // Fallback to expense for legacy
      
      if (status === "expense") {
        if (!expenseTotals[cat.name]) expenseTotals[cat.name] = { name: cat.name, total: 0 };
        expenseTotals[cat.name].total += parseFloat(tx.amount || 0);
      } else if (status === "income") {
        if (!incomeTotals[cat.name]) incomeTotals[cat.name] = { name: cat.name, total: 0 };
        incomeTotals[cat.name].total += parseFloat(tx.amount || 0);
      }
    });
      
    return {
      artaExpenseBreakdown: Object.values(expenseTotals).sort((a, b) => b.total - a.total).slice(0, 3),
      artaIncomeBreakdown: Object.values(incomeTotals).sort((a, b) => b.total - a.total).slice(0, 3)
    };
  }, [artaData]);

  const maxArtaExpTotal = Math.max(...artaExpenseBreakdown.map(c => c.total), 1);
  const maxArtaIncTotal = Math.max(...artaIncomeBreakdown.map(c => c.total), 1);

  // Gamification Logic for Dashboard
  const { ragaTodayPoints, ragaRank, todayCalories } = useMemo(() => {
    if (!ragaData?.logs || !ragaData?.biometrics) return { ragaTodayPoints: 0, ragaRank: "Novice", todayCalories: 0 };
    
    const b = ragaData.biometrics;
    const bmi = calculateBMI(parseFloat(b.weight_kg), parseFloat(b.height_cm));
    const targetKcal = parseInt(b.target_calories) || 2000;

    const todayStr = new Date().toLocaleDateString("en-CA");
    const todayLogs = (ragaData.logs || []).filter((l: any) => (l.logged_on || l.logged_at || "").split(/[T ]/)[0] === todayStr);
    const ragaTodayPoints = calculatePointsForDay(todayLogs, targetKcal, bmi);
    const todayCalories = todayLogs.reduce((acc: number, l: any) => acc + (l.calories || 0), 0);

    // Monthly Rank calculation
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const daysMap: Record<string, any[]> = {};
    (ragaData.logs || []).forEach((l: any) => {
        const d = (l.logged_on || l.logged_at || "").split(/[T ]/)[0];
        if (new Date(d) >= startOfMonth) {
            if (!daysMap[d]) daysMap[d] = [];
            daysMap[d].push(l);
        }
    });
    const monthlyScore = Object.values(daysMap).reduce((acc, logs) => acc + calculatePointsForDay(logs, targetKcal, bmi), 0);
    
    const ragaRank = getRankByScore(monthlyScore);

    return { ragaTodayPoints, ragaRank, todayCalories };
  }, [ragaData]);

  const stats = [
    { 
      label: t('dash.wealth'), 
      value: artaData?.summary?.balance != null ? `Rp ${artaData.summary.balance.toLocaleString()}` : (loading ? "..." : "Rp 0"), 
      icon: Wallet, 
      color: "text-violet-400",
      subTitle: t('dash.net_balance')
    },
    { 
      label: t('dash.health'), 
      value: ragaRank, 
      icon: Target, 
      color: "text-emerald-400",
      subTitle: `${ragaTodayPoints >= 0 ? "+" : ""}${ragaTodayPoints} ${t('dash.pts_today')}`
    },
    { 
      label: t('dash.agenda'), 
      value: masaData?.tasks ? `${(masaData.tasks || []).filter((t: any) => t.status !== 'completed').length} Tasks` : "0 Tasks", 
      icon: CalendarCheck, 
      color: "text-blue-400",
      subTitle: t('dash.pending_actions')
    },
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="relative min-h-[calc(100vh-10rem)]">
      {/* Loading Overlay */}
      <AnimatePresence>
        {loading && !artaData && !ragaData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/60 backdrop-blur-md rounded-3xl border border-border/50"
          >
            <div className="relative">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="w-24 h-24 rounded-full border-t-2 border-r-2 border-primary neon-glow"
              />
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Zap className="w-8 h-8 text-primary" />
              </motion.div>
            </div>
            <motion.div 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mt-6 text-center"
            >
              <h3 className="text-xl font-bold tracking-tighter">{t('dash.syncing')}</h3>
              <p className="text-sm text-muted-foreground">{t('dash.aligning')}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn("space-y-8 transition-all duration-500", loading && !artaData ? "opacity-20 blur-sm scale-[0.98]" : "opacity-100 blur-0 scale-100")}>
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {t('dash.welcome')}, {fullName?.split(" ")[0]}!
          </h1>
          <p className="text-muted-foreground">
            {loading ? t('dash.aligning') : t('dash.balanced')}
          </p>
        </header>

      {/* Stats Grid */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {stats.map((stat, idx) => (
          <motion.div key={idx} variants={item}>
            <Card className="bg-[var(--glass-bg)] border-[var(--glass-border)] backdrop-blur-[var(--glass-blur)] hover:border-accent transition-all cursor-default group">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className={`w-4 h-4 ${stat.color} group-hover:scale-110 transition-transform neon-glow`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <span className="font-medium opacity-80">{stat.subTitle}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Dual Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-20">
        
        {/* ARTA: Wealth Glance */}
        <motion.div variants={item}>
          <Card className="bg-[var(--glass-bg)] border-[var(--glass-border)] backdrop-blur-[var(--glass-blur)] overflow-hidden">
            <CardHeader className="pb-2 border-b border-border/10">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-violet-500" /> {t('arta.wealth')}
                  </CardTitle>
                  <CardDescription className="text-xs">{t('dash.aligning')}</CardDescription>
                </div>
                <Link to="/dashboard/arta">
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] text-violet-500 hover:text-violet-400 hover:bg-violet-500/10 uppercase font-bold tracking-wider">{t('arta.details')}</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
               <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-8">
                  {/* EXPENSES SECTION */}
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-red-500/70 uppercase tracking-[0.2em]">{t('arta.spending')}</p>
                    {artaExpenseBreakdown.length > 0 ? (
                      artaExpenseBreakdown.map((cat: any, idx: number) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{cat.name}</span>
                            <span className="font-bold text-foreground">Rp {cat.total.toLocaleString()}</span>
                          </div>
                          <div className="h-1 w-full bg-secondary/50 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-violet-500 transition-all duration-1000"
                              style={{ width: `${Math.min(100, (cat.total / maxArtaExpTotal) * 100)}%` }} 
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-center text-muted-foreground text-[10px] flex flex-col items-center gap-1 opacity-50">
                        <Tag className="w-4 h-4" />
                        {t('arta.no_data')}
                      </div>
                    )}
                  </div>

                  {/* INCOME SECTION */}
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-emerald-500/70 uppercase tracking-[0.2em]">{t('arta.income')}</p>
                    {artaIncomeBreakdown.length > 0 ? (
                      artaIncomeBreakdown.map((cat: any, idx: number) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{cat.name}</span>
                            <span className="font-bold text-foreground">Rp {cat.total.toLocaleString()}</span>
                          </div>
                          <div className="h-1 w-full bg-secondary/50 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 transition-all duration-1000"
                              style={{ width: `${Math.min(100, (cat.total / maxArtaIncTotal) * 100)}%` }} 
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-center text-muted-foreground text-[10px] flex flex-col items-center gap-1 opacity-50">
                        <Tag className="w-4 h-4" />
                        {t('arta.no_data')}
                      </div>
                    )}
                  </div>
               </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* RAGA: Health Glance */}
        <motion.div variants={item}>
          <Card className="bg-[var(--glass-bg)] border-[var(--glass-border)] backdrop-blur-[var(--glass-blur)] overflow-hidden h-full flex flex-col">
            <CardHeader className="pb-2 border-b border-border/10">
             <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-500" /> {t('raga.title')}
                  </CardTitle>
                  <CardDescription className="text-xs">{t('dash.syncing')}</CardDescription>
                </div>
                <Link to="/dashboard/raga">
                  <Button variant="ghost" size="sm" className="text-xs text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10">{t('profile.full_assessment')}</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-6 flex flex-col justify-center">
                {ragaData ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-around text-center">
                       <div>
                          <p className="text-xs text-muted-foreground mb-1">{t('raga.target')}</p>
                          <p className="text-lg font-bold">{ragaData?.biometrics?.target_calories || 2000}</p>
                       </div>
                       <div className="w-px h-8 bg-border" />
                       <div>
                          <p className="text-xs text-muted-foreground mb-1">{t('raga.kcal_logged')}</p>
                          <motion.p 
                             animate={
                               todayCalories > (ragaData?.biometrics?.target_calories || 2000)
                                 ? { scale: [1, 1.05, 1], color: "#f43f5e" }
                                 : { scale: 1, color: "#10b981" }
                             }
                             transition={{ duration: 2, repeat: Infinity }}
                             className="text-lg font-bold"
                          >
                             {todayCalories}
                          </motion.p>
                       </div>
                       <div className="w-px h-8 bg-border" />
                       <div>
                          <p className="text-xs text-muted-foreground mb-1">{t('profile.weight')}</p>
                          <p className="text-lg font-bold">{ragaData?.biometrics?.weight_kg || "--"} kg</p>
                       </div>
                    </div>
                    <div className="relative pt-4">
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1 font-bold uppercase tracking-widest">
                            <span>0 kcal</span>
                            <span>{ragaData?.biometrics?.target_calories || 2000} kcal</span>
                        </div>
                        <div className="h-3 w-full bg-secondary rounded-full overflow-hidden border border-border/50">
                           <motion.div 
                             initial={{ width: 0 }}
                             animate={{ 
                               width: `${Math.min(100, (todayCalories / (ragaData?.biometrics?.target_calories || 2000)) * 100)}%`,
                               backgroundColor: todayCalories > (ragaData?.biometrics?.target_calories || 2000)
                                ? "#f43f5e" 
                                : "#10b981"
                             }}
                             className="h-full neon-border-glow"
                           />
                        </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground text-sm">{t('profile.awaiting_biometrics')}</div>
                )}
            </CardContent>
          </Card>
        </motion.div>

        {/* MASA: Agenda Glance */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="bg-[var(--glass-bg)] border-[var(--glass-border)] backdrop-blur-[var(--glass-blur)] overflow-hidden">
             <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-500" /> {t('masa.agenda')}
                  </CardTitle>
                  <Link to="/dashboard/masa">
                    <Button variant="ghost" size="sm" className="text-xs text-blue-500 hover:bg-blue-500/10">{t('masa.open')}</Button>
                  </Link>
                </div>
             </CardHeader>
             <CardContent className="px-6 pb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-3">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <CalendarCheck className="w-3 h-3" /> {t('masa.focus')}
                      </p>
                      <div className="space-y-2">
                        {masaData?.tasks?.filter((t: any) => t.status !== 'completed').slice(0, 2).map((task: any, idx: number) => (
                          <div key={idx} className="p-3 bg-secondary/50 border border-border/30 rounded-xl flex items-center gap-3">
                             <div className="w-2 h-2 rounded-full bg-blue-500" />
                             <span className="text-sm font-medium">{task.title}</span>
                          </div>
                        ))}
                        {(!masaData?.tasks || masaData.tasks.filter((t: any) => t.status !== 'completed').length === 0) && (
                          <div className="text-sm text-muted-foreground italic">{t('masa.no_tasks')}</div>
                        )}
                      </div>
                   </div>
                   <div className="space-y-3">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <Zap className="w-3 h-3 text-amber-500" /> {t('masa.ritual')}
                      </p>
                      {masaData?.routines?.[0] ? (
                        <div className="p-4 bg-[var(--masa-accent)]/10 border border-[var(--masa-accent)]/20 rounded-2xl flex items-center gap-4">
                           <div className="p-3 rounded-full bg-[var(--masa-accent)] text-white shadow-lg">
                              <Plus className="w-5 h-5" />
                           </div>
                           <div>
                              <p className="text-sm font-bold text-foreground">{masaData.routines[0].title}</p>
                              <p className="text-xs text-muted-foreground">{masaData.routines[0].time} • Set as daily habit</p>
                           </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground italic">{t('masa.no_rituals')}</div>
                      )}
                   </div>
                </div>
             </CardContent>
          </Card>
        </motion.div>
      </div>
      </div>
    </div>
  );
}
