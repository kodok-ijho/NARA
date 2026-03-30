import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { User, Save, Activity, Ruler, Weight as WeightIcon, Target, Info, Sun, Moon, Sparkles, Globe, Palette } from "lucide-react";
import { useLanguage } from "@/lib/i18n.tsx";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

const RAGA_WEBHOOK = import.meta.env.VITE_N8N_RAGA_WEBHOOK_URL;

export function ProfileScreen() {
  const { session } = useOutletContext<{ session: Session }>();
  const { t, language, setLanguage } = useLanguage();
  const user = session.user;

  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("nara-theme") || "classic");
  const [mode, setMode] = useState(() => localStorage.getItem("nara-mode") || "dark");
  
  const [profile, setProfile] = useState({
    fullName: user.user_metadata?.full_name || "",
    email: user.email || "",
    phone: "",
    institution: "",
    bio: "",
    location: ""
  });

  // Biometrics State
  const [bio, setBio] = useState({
    height: "",
    weight: "",
    age: "",
    gender: "male",
    activity: "1.2", // Sedentary factor
    weightGoal: ""
  });

  const [targetCalories, setTargetCalories] = useState<number>(2000);
  const [bmi, setBmi] = useState<string>("N/A");

  useEffect(() => {
    const root = window.document.documentElement;
    if (mode === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    root.setAttribute("data-theme", theme);
    localStorage.setItem("nara-theme", theme);
    localStorage.setItem("nara-mode", mode);
  }, [theme, mode]);

  const calculateHealth = useCallback(() => {
    const h = parseFloat(bio.height);
    const w = parseFloat(bio.weight);
    const a = parseInt(bio.age);
    const act = parseFloat(bio.activity);

    if (h > 0 && w > 0) {
      // BMI
      const bmiVal = (w / Math.pow(h / 100, 2)).toFixed(1);
      setBmi(bmiVal);

      // Mifflin-St Jeor BMR
      if (a > 0) {
        let bmr = (10 * w) + (6.25 * h) - (5 * a);
        bmr = bio.gender === "male" ? bmr + 5 : bmr - 161;
        const tdee = Math.round(bmr * act);
        
        // Deficit/Surplus based on Target Weight
        const wg = parseFloat(bio.weightGoal);
        if (wg > 0) {
            if (wg < w) {
                // Weight Loss Deficit (approx 500kcal)
                setTargetCalories(Math.max(1200, tdee - 500));
            } else if (wg > w) {
                // Weight Gain Surplus (approx 500kcal)
                setTargetCalories(tdee + 500);
            } else {
                setTargetCalories(tdee);
            }
        } else {
            setTargetCalories(tdee);
        }
      }
    }
  }, [bio]);

  useEffect(() => {
    calculateHealth();
  }, [calculateHealth]);

  const getBMICategory = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return t('profile.awaiting_data');
    if (num < 18.5) return t('profile.underweight');
    if (num < 25) return t('profile.healthy');
    if (num < 30) return t('profile.overweight');
    return t('profile.obese');
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Pure n8n Flow: Fetch via Webhook
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
      console.log("[Profile] Raw n8n response:", result);
      const data = Array.isArray(result) ? result[0] : result;
      console.log("[Profile] Biometrics:", data?.biometrics);

      if (data && data.biometrics && data.biometrics.user_id) {
        const b = data.biometrics;
        console.log("[Profile] Biometric keys found:", Object.keys(b));
        setBio({
          height: b.height_cm?.toString() || "",
          weight: b.weight_kg?.toString() || "",
          age: b.age?.toString() || "",
          gender: b.gender || "male",
          activity: b.activity_level?.toString() || "1.2",
          weightGoal: (b.target_weight || b.weight_target || b.target_weight_kg || "")?.toString() || ""
        });
        if (b.target_calories) setTargetCalories(Math.round(parseFloat(b.target_calories)));
      }
    } catch (error) {
      console.error("Error loading biometric via n8n:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
      setIsLoading(true);
      
      try {
        const payload = {
          action: "upsert_biometrics",
          user_id: user.id,
          data: {
            height_cm: parseInt(bio.height),
            weight_kg: parseFloat(bio.weight),
            age: parseInt(bio.age),
            gender: bio.gender,
            activity_level: parseFloat(bio.activity),
            target_weight: parseFloat(bio.weightGoal),
            weight_target: parseFloat(bio.weightGoal), // Fallback for n8n
            target_calories: Math.round(targetCalories)
          }
        };

        console.log("[Profile] Sending payload to n8n:", payload);

        // Pure n8n Flow: Save via Webhook POST
        const response = await fetch(RAGA_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const debugResponse = await response.text();
        console.log("[Profile] n8n Save Response:", debugResponse);

        if (response.ok) {
          toast.success(t('profile.success_update'), {
            description: t('profile.sync_success'),
          });
        } else {
          throw new Error("Webhook failed");
        }
      } catch (error: any) {
        toast.error(t('profile.update_failed'), {
          description: error.message,
        });
      } finally {
        setIsLoading(false);
      }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">{t('profile.title')}</h1>
        <p className="text-muted-foreground">{t('profile.subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Avatar & Summary */}
        <div className="lg:col-span-1 space-y-6">
            <Card className="bg-card/50 backdrop-blur-md border-border overflow-hidden">
                <div className="h-24 bg-gradient-to-br from-muted to-background" />
                <div className="px-6 pb-6 -mt-12 text-center">
                    <div className="relative inline-block group">
                        <div className="w-24 h-24 rounded-full border-4 border-background bg-muted mx-auto overflow-hidden">
                            {user.user_metadata?.avatar_url ? (
                                <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                            ) : (
                                <User className="w-12 h-12 text-muted-foreground mt-5 mx-auto" />
                            )}
                        </div>
                    </div>
                    <h3 className="mt-4 text-xl font-bold text-foreground">{profile.fullName}</h3>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
            </Card>

            <Card className="bg-card/50 backdrop-blur-md border-border p-6 space-y-4">
                 <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t('profile.health_summary')}</h4>
                 <div className="flex items-center justify-between">
                     <span className="text-muted-foreground text-sm">Calculated BMI</span>
                     <span className="text-foreground font-bold">{bmi}</span>
                 </div>
                 <div className="flex items-center justify-between">
                     <span className="text-muted-foreground text-sm">Calorie Target</span>
                     <span className="text-amber-500 font-bold">{targetCalories} kcal</span>
                 </div>
            </Card>
        </div>

        {/* Right Column: Detailed Forms */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Biometrics Form (The RAGA Engine) */}
          <Card className="bg-card/50 backdrop-blur-md border-border border-l-4 border-l-amber-500">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <Activity className="w-5 h-5 text-amber-500" />
                {t('profile.biometrics')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('profile.height')}</Label>
                    <div className="relative">
                      <Ruler className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground/50" />
                      <Input 
                        type="number"
                        value={bio.height}
                        onChange={(e) => setBio({...bio, height: e.target.value})}
                        className="pl-10 bg-background/50 border-border" 
                      />
                    </div>
                 </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('profile.weight')}</Label>
                    <div className="relative">
                      <WeightIcon className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground/50" />
                      <Input 
                        type="number"
                        value={bio.weight}
                        onChange={(e) => setBio({...bio, weight: e.target.value})}
                        className="pl-10 bg-background/50 border-border" 
                      />
                    </div>
                 </div>

                 {/* VISUAL BMI INDICATOR */}
                 <div className="md:col-span-2 p-6 rounded-2xl bg-muted/30 border border-border space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <Activity className="w-4 h-4 text-amber-500" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Body Mass Index Analysis</span>
                        </div>
                        <span className={cn(
                            "text-xs font-bold px-3 py-1 rounded-full",
                            bmi !== "N/A" && parseFloat(bmi) >= 18.5 && parseFloat(bmi) < 25 
                                ? "bg-emerald-500/10 text-emerald-500" 
                                : "bg-amber-500/10 text-amber-500"
                        )}>
                            {bmi !== "N/A" ? getBMICategory(bmi) : t('profile.awaiting_data')}
                        </span>
                    </div>
                    
                    <div className="flex items-end gap-3">
                        <span className="text-5xl font-black text-foreground">{bmi}</span>
                        <div className="pb-1">
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Your Current Score</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden flex">
                            <div className="h-full bg-cyan-500/40 w-[14%]" title="Underweight" />
                            <div className="h-full bg-emerald-500/40 w-[26%]" title="Healthy" />
                            <div className="h-full bg-amber-500/40 w-[20%]" title="Overweight" />
                            <div className="h-full bg-rose-500/40 w-[40%]" title="Obese" />
                            
                            {bmi !== "N/A" && (
                            <motion.div 
                                initial={{ left: 0 }}
                                animate={{ left: `${Math.min(Math.max((parseFloat(bmi) - 15) / 25 * 100, 0), 100)}%` }}
                                className="absolute top-0 bottom-0 w-1.5 bg-white shadow-[0_0_15px_white] z-10"
                                transition={{ type: "spring", stiffness: 50, damping: 10 }}
                            />
                            )}
                        </div>
                        <div className="flex justify-between text-[8px] text-zinc-600 font-black uppercase tracking-widest px-1">
                            <span>15.0</span>
                            <span className="ml-[14%]">18.5</span>
                            <span className="ml-[26%]">25.0</span>
                            <span className="ml-[20%]">30.0</span>
                            <span className="text-right">40.0</span>
                        </div>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <Label className="text-zinc-400">{t('profile.age')}</Label>
                    <Input 
                      type="number"
                      value={bio.age}
                      onChange={(e) => setBio({...bio, age: e.target.value})}
                      className="bg-zinc-950 border-zinc-800 text-white" 
                    />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-zinc-400">{t('profile.gender')}</Label>
                    <Select value={bio.gender} onValueChange={(val: string | null) => { if (val) setBio({...bio, gender: val}); }}>
                      <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                        <SelectValue placeholder="Select Gender" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                        <SelectItem value="male">{t('profile.male')}</SelectItem>
                        <SelectItem value="female">{t('profile.female')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('profile.target_weight')}</Label>
                    <div className="relative">
                      <Target className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground/50" />
                      <Input 
                        type="number"
                        placeholder="e.g. 70"
                        value={bio.weightGoal}
                        onChange={(e) => setBio({...bio, weightGoal: e.target.value})}
                        className="pl-10 bg-background/50 border-border" 
                      />
                    </div>
                 </div>
              </div>

              <div className="space-y-2 text-muted-foreground">
                  <Label className="text-muted-foreground">{t('profile.activity_level')}</Label>
                  <Select value={bio.activity} onValueChange={(val: string | null) => { if (val) setBio({...bio, activity: val}); }}>
                    <SelectTrigger className="bg-background/50 border-border h-12">
                      <SelectValue>
                        {bio.activity === "1.2" && "1.2 - Sedentary"}
                        {bio.activity === "1.375" && "1.375 - Lightly Active"}
                        {bio.activity === "1.55" && "1.55 - Moderately Active"}
                        {bio.activity === "1.725" && "1.725 - Very Active"}
                        {bio.activity === "1.9" && "1.9 - Extra Active"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border w-[calc(var(--radix-select-trigger-width)+100px)] sm:w-[500px] max-w-[90vw]">
                      <SelectItem value="1.2" className="py-3">
                        <span className="font-bold text-amber-500 text-base">1.2 - Sedentary</span> 
                        <span className="block text-xs text-muted-foreground mt-0.5">Office job, very little to no exercise</span>
                      </SelectItem>
                      <SelectItem value="1.375" className="py-3">
                        <span className="font-bold text-amber-500 text-base">1.375 - Lightly Active</span> 
                        <span className="block text-xs text-muted-foreground mt-0.5">Light exercise or sports 1-3 days/week</span>
                      </SelectItem>
                      <SelectItem value="1.55" className="py-3">
                        <span className="font-bold text-amber-500 text-base">1.55 - Moderately Active</span> 
                        <span className="block text-xs text-muted-foreground mt-0.5">Moderate exercise or sports 3-5 days/week</span>
                      </SelectItem>
                      <SelectItem value="1.725" className="py-3">
                        <span className="font-bold text-amber-500 text-base">1.725 - Very Active</span> 
                        <span className="block text-xs text-muted-foreground mt-0.5">Hard exercise or sports 6-7 days/week</span>
                      </SelectItem>
                      <SelectItem value="1.9" className="py-3">
                        <span className="font-bold text-amber-500 text-base">1.9 - Extra Active</span> 
                        <span className="block text-xs text-muted-foreground mt-0.5">Very hard exercise, physical job or training 2x/day</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
              </div>

              {/* METHODOLOGY EXPLANATION */}
              <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/10 space-y-3">
                  <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-black uppercase tracking-widest text-amber-500/80">{t('profile.methodology')}</span>
                  </div>
                  <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground leading-relaxed">
                          Aplikasi NARA menggunakan metode <span className="text-amber-500 underline decoration-amber-500/30">Mifflin-St Jeor Equation</span> sebagai standar emas medis dalam menentukan target kalori harian.
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-2 ml-4 list-disc">
                          <li><span className="text-foreground font-bold">BMR (Basal Metabolic Rate):</span> Kalori yang dibakar tubuh saat istirahat berdasarkan jenis kelamin, tinggi, berat, dan usia.</li>
                          <li><span className="text-foreground font-bold">TDEE (Total Daily Energy Expenditure):</span> Penyesuaian BMR berdasarkan level aktivitas fisik Anda (*Activity Level multiplier*).</li>
                          <li><span className="text-foreground font-bold">Weight Goal Adjustment:</span> NARA secara otomatis menambahkan surplus (+500 kcal) untuk target kenaikan berat badan, atau defisit (-500 kcal) untuk penurunan berat badan.</li>
                      </ul>
                  </div>
              </div>
            </CardContent>
          </Card>

          {/* Application Settings (Unified Control) */}
          <Card className="bg-card/50 backdrop-blur-md border-border border-l-4 border-l-indigo-500">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <Palette className="w-5 h-5 text-indigo-500" />
                {t('profile.app_settings')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Language Selector */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-sm font-semibold">{t('common.language')}</Label>
                  </div>
                  <div className="flex p-1 bg-muted rounded-xl border border-border">
                    <button 
                      onClick={() => setLanguage("en")}
                      className={cn(
                        "flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all",
                        language === "en" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      English
                    </button>
                    <button 
                      onClick={() => setLanguage("id")}
                      className={cn(
                        "flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all",
                        language === "id" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Indonesia
                    </button>
                  </div>
                </div>

                {/* Mode Selector */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {mode === "dark" ? <Moon className="w-4 h-4 text-muted-foreground" /> : <Sun className="w-4 h-4 text-muted-foreground" />}
                    <Label className="text-sm font-semibold">{t('common.mode')}</Label>
                  </div>
                  <div className="flex p-1 bg-muted rounded-xl border border-border">
                    <button 
                      onClick={() => setMode("light")}
                      className={cn(
                        "flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                        mode === "light" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Sun className="w-3.5 h-3.5" /> {t('common.light')}
                    </button>
                    <button 
                      onClick={() => setMode("dark")}
                      className={cn(
                        "flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                        mode === "dark" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Moon className="w-3.5 h-3.5" /> {t('common.dark')}
                    </button>
                  </div>
                </div>

                {/* Theme Selector */}
                <div className="space-y-3 md:col-span-2">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-sm font-semibold">{t('common.theme')}</Label>
                  </div>
                  <div className="flex p-1 bg-muted rounded-xl border border-border">
                    <button 
                      onClick={() => setTheme("classic")}
                      className={cn(
                        "flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all",
                        theme === "classic" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t('common.classic')}
                    </button>
                    <button 
                      onClick={() => setTheme("neon")}
                      className={cn(
                        "flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2",
                        theme === "neon" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t('common.neon')} <Sparkles className="w-4 h-4 text-purple-500" />
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* General Info */}
          <Card className="bg-card/50 backdrop-blur-md border-border">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">{t('profile.fullname')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullname" className="text-muted-foreground">{t('profile.fullname')}</Label>
                  <Input 
                    id="fullname" 
                    value={profile.fullName} 
                    onChange={(e) => setProfile({...profile, fullName: e.target.value})}
                    className="bg-background/50 border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-muted-foreground">{t('profile.phone')}</Label>
                  <Input 
                    id="phone" 
                    value={profile.phone}
                    onChange={(e) => setProfile({...profile, phone: e.target.value})}
                    className="bg-background/50 border-border" 
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button 
                  className="bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold px-8 h-12 transition-all"
                  onClick={handleSave}
                  disabled={isLoading}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isLoading ? t('common.saving') : t('common.save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
