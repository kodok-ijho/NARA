import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { User, Save, Activity, Ruler, Weight as WeightIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const user = session.user;

  const [isLoading, setIsLoading] = useState(false);
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
    activity: "1.2" // Sedentary factor
  });

  const [targetCalories, setTargetCalories] = useState<number>(2000);
  const [bmi, setBmi] = useState<string>("N/A");

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
        setTargetCalories(Math.round(bmr * act));
      }
    }
  }, [bio]);

  useEffect(() => {
    calculateHealth();
  }, [calculateHealth]);

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
        setBio({
          height: b.height_cm?.toString() || "",
          weight: b.weight_kg?.toString() || "",
          age: b.age?.toString() || "",
          gender: b.gender || "male",
          activity: b.activity_level?.toString() || "1.2"
        });
        if (b.target_calories) setTargetCalories(parseInt(b.target_calories));
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
        // Pure n8n Flow: Save via Webhook POST
        const response = await fetch(RAGA_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upsert_biometrics",
            user_id: user.id,
            data: {
              height_cm: parseInt(bio.height),
              weight_kg: parseFloat(bio.weight),
              age: parseInt(bio.age),
              gender: bio.gender,
              activity_level: parseFloat(bio.activity),
              target_calories: targetCalories
            }
          })
        });

        if (response.ok) {
          toast.success("Profile & Biometrics Updated", {
            description: "Synchronized to NARA via n8n orchestration.",
          });
        } else {
          throw new Error("Webhook failed");
        }
      } catch (error: any) {
        toast.error("Update Failed", {
          description: error.message,
        });
      } finally {
        setIsLoading(false);
      }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">Profile & Health Settings</h1>
        <p className="text-zinc-500">Manage your identity and health parameters for the RAGA module.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Avatar & Summary */}
        <div className="lg:col-span-1 space-y-6">
            <Card className="bg-zinc-900/40 border-zinc-800 overflow-hidden">
                <div className="h-24 bg-gradient-to-br from-zinc-800 to-zinc-950" />
                <div className="px-6 pb-6 -mt-12 text-center">
                    <div className="relative inline-block group">
                        <div className="w-24 h-24 rounded-full border-4 border-zinc-950 bg-zinc-800 mx-auto overflow-hidden">
                            {user.user_metadata?.avatar_url ? (
                                <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                            ) : (
                                <User className="w-12 h-12 text-zinc-600 mt-5 mx-auto" />
                            )}
                        </div>
                    </div>
                    <h3 className="mt-4 text-xl font-bold text-white">{profile.fullName}</h3>
                    <p className="text-sm text-zinc-500">{user.email}</p>
                </div>
            </Card>

            <Card className="bg-zinc-900/40 border-zinc-800 p-6 space-y-4">
                 <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Health Summary</h4>
                 <div className="flex items-center justify-between">
                     <span className="text-zinc-500 text-sm">Calculated BMI</span>
                     <span className="text-white font-bold">{bmi}</span>
                 </div>
                 <div className="flex items-center justify-between">
                     <span className="text-zinc-500 text-sm">Calorie Target</span>
                     <span className="text-amber-500 font-bold">{targetCalories} kcal</span>
                 </div>
            </Card>
        </div>

        {/* Right Column: Detailed Forms */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Biometrics Form (The RAGA Engine) */}
          <Card className="bg-zinc-900/40 border-zinc-800 border-l-4 border-l-amber-500">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-amber-500" />
                Physical Biometrics
              </CardTitle>
              <CardDescription className="text-zinc-500">Required for BMI and Calorie target automation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <Label className="text-zinc-400">Height (cm)</Label>
                    <div className="relative">
                      <Ruler className="absolute left-3 top-2.5 w-4 h-4 text-zinc-600" />
                      <Input 
                        type="number"
                        value={bio.height}
                        onChange={(e) => setBio({...bio, height: e.target.value})}
                        className="pl-10 bg-zinc-950 border-zinc-800 text-white" 
                      />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-zinc-400">Weight (kg)</Label>
                    <div className="relative">
                      <WeightIcon className="absolute left-3 top-2.5 w-4 h-4 text-zinc-600" />
                      <Input 
                        type="number"
                        value={bio.weight}
                        onChange={(e) => setBio({...bio, weight: e.target.value})}
                        className="pl-10 bg-zinc-950 border-zinc-800 text-white" 
                      />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-zinc-400">Age</Label>
                    <Input 
                      type="number"
                      value={bio.age}
                      onChange={(e) => setBio({...bio, age: e.target.value})}
                      className="bg-zinc-950 border-zinc-800 text-white" 
                    />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-zinc-400">Gender</Label>
                    <Select value={bio.gender} onValueChange={(val: string | null) => { if (val) setBio({...bio, gender: val}); }}>
                      <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                        <SelectValue placeholder="Select Gender" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                 </div>
              </div>

              <div className="space-y-2 text-zinc-400">
                  <Label className="text-zinc-400">Activity Level</Label>
                  <Select value={bio.activity} onValueChange={(val: string | null) => { if (val) setBio({...bio, activity: val}); }}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white h-12">
                      <SelectValue>
                        {bio.activity === "1.2" && "1.2 - Sedentary"}
                        {bio.activity === "1.375" && "1.375 - Lightly Active"}
                        {bio.activity === "1.55" && "1.55 - Moderately Active"}
                        {bio.activity === "1.725" && "1.725 - Very Active"}
                        {bio.activity === "1.9" && "1.9 - Extra Active"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white w-[calc(var(--radix-select-trigger-width)+100px)] sm:w-[500px] max-w-[90vw]">
                      <SelectItem value="1.2" className="py-3">
                        <span className="font-bold text-amber-500 text-base">1.2 - Sedentary</span> 
                        <span className="block text-xs text-zinc-500 mt-0.5">Office job, very little to no exercise</span>
                      </SelectItem>
                      <SelectItem value="1.375" className="py-3">
                        <span className="font-bold text-amber-500 text-base">1.375 - Lightly Active</span> 
                        <span className="block text-xs text-zinc-500 mt-0.5">Light exercise or sports 1-3 days/week</span>
                      </SelectItem>
                      <SelectItem value="1.55" className="py-3">
                        <span className="font-bold text-amber-500 text-base">1.55 - Moderately Active</span> 
                        <span className="block text-xs text-zinc-500 mt-0.5">Moderate exercise or sports 3-5 days/week</span>
                      </SelectItem>
                      <SelectItem value="1.725" className="py-3">
                        <span className="font-bold text-amber-500 text-base">1.725 - Very Active</span> 
                        <span className="block text-xs text-zinc-500 mt-0.5">Hard exercise or sports 6-7 days/week</span>
                      </SelectItem>
                      <SelectItem value="1.9" className="py-3">
                        <span className="font-bold text-amber-500 text-base">1.9 - Extra Active</span> 
                        <span className="block text-xs text-zinc-500 mt-0.5">Very hard exercise, physical job or training 2x/day</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
              </div>
            </CardContent>
          </Card>

          {/* General Info */}
          <Card className="bg-zinc-900/40 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg text-white">General Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullname" className="text-zinc-400">Full Name</Label>
                  <Input 
                    id="fullname" 
                    value={profile.fullName} 
                    onChange={(e) => setProfile({...profile, fullName: e.target.value})}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-zinc-400">Phone Number</Label>
                  <Input 
                    id="phone" 
                    value={profile.phone}
                    onChange={(e) => setProfile({...profile, phone: e.target.value})}
                    className="bg-zinc-950 border-zinc-800 text-white" 
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button 
                  className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold px-8 h-12 transition-all"
                  onClick={handleSave}
                  disabled={isLoading}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isLoading ? "Synchronizing..." : "Save All Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
