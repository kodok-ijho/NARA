import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function AuthScreen() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);

  useEffect(() => {
    // Memastikan jika user sudah login sblmnya, langsung lempar ke dashboard
    const checkUserSession = async () => {
        if (window.location.hash.includes("access_token")) {
           // Sedang proses login dari Google, biarkan Auth Listener bekerja!
           return; 
        }
        
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            navigate("/dashboard", { replace: true });
        }
    };
    checkUserSession();

    // Listener for Auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth Event:", event);
      if (event === "SIGNED_IN" && session) {
        setIsLoading(true);
        
        // Membaca Niat (Intent) user dari SessionStorage yang disimpan sebelum kehalaman Google
        const intent = sessionStorage.getItem("nara_auth_intent") || "login";
        
        if (intent === "register") {
            setStatusText("Registering your profile into NARA...");
        } else {
            setStatusText("Synchronizing data with NARA ecosystem...");
        }

        try {
          // Pilih Webhook URL berdasarkan intent
          const webhookUrl = intent === "register" 
            ? import.meta.env.VITE_N8N_WEBHOOK_REGISTER_URL 
            : import.meta.env.VITE_N8N_WEBHOOK_URL;
          
          if (!webhookUrl) {
            console.warn("Webhook URL missing, skipping sync.");
            setStatusText("Webhook URL missing.");
            return;
          }

          const user = session.user;
          const response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: intent === "register" ? "register" : "sync",
              user_id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name || user.email,
              avatar_url: user.user_metadata?.avatar_url || "",
            }),
          });

          if (response.ok) {
            const syncResult = await response.json();
            const userData = Array.isArray(syncResult) ? syncResult[0] : syncResult;

            // Jika login tapi n8n tidak menemukan profile (array kosong atau id null)
            if (intent === "login" && (!userData || (!userData.id && !userData.user_id))) {
                setStatusText("Sync Warning: Account profile not found in NARA.");
                // Tetap lanjut tapi beri warning, atau bisa signOut jika ingin ketat
                // Untuk sekarang kita biarkan lanjut agar user tidak terjebak
                setTimeout(() => {
                    navigate("/dashboard", { replace: true });
                }, 1500);
                return;
            }

            if (intent === "register") {
                setStatusText("Registration complete! Welcome to NARA.");
            } else {
                setStatusText("Login success! Welcome back to NARA.");
            }
            
            setTimeout(() => {
                navigate("/dashboard", { replace: true });
            }, 1000);
            
          } else {
            console.error("N8n Sync Warning: Server responded with", response.status);
            if (response.status === 400 || response.status === 500) {
                 if (intent === "login") {
                    setStatusText("Sync failed: Data could not be updated.");
                 } else {
                    setStatusText("Registration failed: Service unavailable.");
                 }
                 setTimeout(() => {
                    navigate("/dashboard", { replace: true });
                 }, 1500);
            } else {
                setStatusText("Welcome to NARA (Limited sync)");
                setTimeout(() => navigate("/dashboard", { replace: true }), 1000);
            }
          }

        } catch (error) {
          console.error("Failed to call n8n webhook:", error);
          setStatusText("Network Warning: NARA internal sync offline.");
          setTimeout(() => {
              navigate("/dashboard", { replace: true });
          }, 2000);
        } finally {
          setIsLoading(false);
          sessionStorage.removeItem("nara_auth_intent"); // Bersihkan jejak intent
        }
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleGoogleAuth = async (mode: "login" | "register") => {
    setIsLoading(true);
    setStatusText("Connecting to Google...");
    
    // Simpan niat (intent) registrasi/login ke browser sebelum memanggil Google
    sessionStorage.setItem("nara_auth_intent", mode);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      console.error("Error logging in:", error.message);
      setStatusText(`Failed to ${mode}.`);
      setIsLoading(false);
      sessionStorage.removeItem("nara_auth_intent");
    }
  };

  const toggleMode = () => {
      setIsLoginMode(!isLoginMode);
      setStatusText("");
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]">
      <AnimatePresence mode="wait">
        <motion.div
          key={isLoginMode ? "login" : "register"}
          initial={{ opacity: 0, x: isLoginMode ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: isLoginMode ? 20 : -20 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <Card className="w-[380px] border-zinc-800 bg-zinc-900/50 backdrop-blur-xl shadow-2xl">
            <CardHeader className="space-y-1 pb-8 text-center">
              <motion.div
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <CardTitle className="text-3xl font-bold tracking-tight text-white mb-2">NARA</CardTitle>
                <CardDescription className="text-zinc-400">
                  {isLoginMode ? "Log in to your ecosystem." : "Create your personal ecosystem."}
                </CardDescription>
              </motion.div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Button
                variant="outline"
                className="w-full bg-zinc-800/50 text-white hover:bg-zinc-700/50 hover:text-white border-zinc-700 h-12 transition-all duration-300 relative overflow-hidden group"
                onClick={() => handleGoogleAuth(isLoginMode ? "login" : "register")}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <svg
                    className="mr-2 h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                )}
                {isLoading ? "Please wait..." : (isLoginMode ? "Sign in with Google" : "Sign up with Google")}
                
                {!isLoading && (
                    <div className="absolute inset-0 bg-white/10 translate-y-[100%] group-hover:translate-y-[0%] transition-transform duration-300 ease-in-out" />
                )}
              </Button>
              
              <div className="min-h-[24px] text-center mt-1">
                {statusText && (
                  <motion.p 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`text-sm ${statusText.includes("failed") || statusText.includes("Error") ? 'text-red-400' : 'text-zinc-400'}`}
                  >
                    {statusText}
                  </motion.p>
                )}
              </div>

            <div className="text-center text-sm text-zinc-500 mt-2">
                {isLoginMode ? "Don't have an account?" : "Already have an account?"}
                <button 
                  onClick={toggleMode}
                  disabled={isLoading}
                  className="ml-1 text-zinc-300 hover:text-white transition-colors underline-offset-4 hover:underline disabled:opacity-50"
                >
                  {isLoginMode ? "Register here" : "Sign in here"}
                </button>
            </div>

            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
