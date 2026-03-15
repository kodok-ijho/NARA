import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation, Link, useOutletContext } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { 
  LayoutDashboard, 
  User, 
  LogOut, 
  Menu, 
  X,
  Bell,
  Search,
  Wallet,
  Calendar,
  Utensils,
  Sun,
  Moon,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function DashboardLayout() {
  const { session } = useOutletContext<{ session: Session }>();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("nara-theme") || "classic");
  const [mode, setMode] = useState(() => localStorage.getItem("nara-mode") || "dark");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Apply Mode (Light/Dark)
    if (mode === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    
    // Apply Style Theme (Classic/Neon)
    root.setAttribute("data-theme", theme);
    
    localStorage.setItem("nara-theme", theme);
    localStorage.setItem("nara-mode", mode);
  }, [theme, mode]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: Utensils, label: "RAGA", path: "/dashboard/raga" },
    { icon: Wallet, label: "ARTA", path: "/dashboard/arta" },
    { icon: Calendar, label: "MASA", path: "/dashboard/masa" },
    { icon: User, label: "Profile", path: "/dashboard/profile" },
  ];

  return (
    <div className="h-screen bg-background text-foreground flex overflow-hidden transition-colors duration-300">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {(isSidebarOpen || !isMobile) && (
          <motion.aside
            initial={isMobile ? { x: -280 } : { width: 0 }}
            animate={isMobile ? { x: 0 } : { width: 280 }}
            exit={isMobile ? { x: -280 } : { width: 0 }}
            className={cn(
              "fixed inset-y-0 left-0 z-50 bg-card/80 backdrop-blur-xl border-r border-border flex flex-col h-screen shadow-xl",
              !isMobile && "relative"
            )}
          >
            <div className="p-6 flex items-center justify-between">
              <Link to="/dashboard" className="text-2xl font-bold tracking-tighter bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">
                NARA
              </Link>
              {isMobile && (
                <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)}>
                  <X className="w-5 h-5 text-zinc-400" />
                </Button>
              )}
            </div>

            <nav className="flex-1 px-3 space-y-1 mt-4 overflow-y-auto custom-scrollbar">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => isMobile && setIsSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group text-sm",
                    location.pathname === item.path
                      ? "bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>

            <div className="p-4 border-t border-border/50 bg-muted/30 space-y-4">
              {/* Theme & Mode Selector (Integrated) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Appearance</span>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => setMode("light")}
                      className={cn("p-1.5 rounded-md transition-all", mode === "light" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}
                    >
                      <Sun className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={() => setMode("dark")}
                      className={cn("p-1.5 rounded-md transition-all", mode === "dark" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}
                    >
                      <Moon className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-1 px-1">
                  <button
                    onClick={() => setTheme("classic")}
                    className={cn("text-[10px] py-1.5 rounded-lg border transition-all", theme === "classic" ? "bg-secondary border-primary/50 text-foreground font-bold" : "border-transparent text-muted-foreground hover:bg-accent")}
                  >
                    Classic
                  </button>
                  <button
                    onClick={() => setTheme("neon")}
                    className={cn("text-[10px] py-1.5 rounded-lg border transition-all flex items-center justify-center gap-1", theme === "neon" ? "bg-secondary border-primary/50 text-foreground font-bold" : "border-transparent text-muted-foreground hover:bg-accent")}
                  >
                    Neon <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                  </button>
                </div>
              </div>

              {/* User Profile Hook */}
              <div className="flex items-center gap-3 p-2 rounded-xl bg-card border border-border/50 shadow-sm">
                <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-bold text-foreground overflow-hidden">
                  {(session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture) && !avatarError ? (
                    <img 
                      src={session.user.user_metadata.avatar_url || session.user.user_metadata.picture} 
                      alt="Profile" 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <span className="text-foreground">{session.user.email?.[0].toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{session.user.user_metadata?.full_name || session.user.email?.split('@')[0]}</p>
                  <p className="text-[10px] text-muted-foreground truncate uppercase tracking-tighter">Verified Meta-User</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border bg-background/50 backdrop-blur-md flex items-center justify-between px-4 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            {isMobile && (
              <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)}>
                <Menu className="w-5 h-5 text-zinc-400" />
              </Button>
            )}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-muted border border-border rounded-lg text-muted-foreground w-64">
              <Search className="w-4 h-4" />
              <span className="text-sm">Search everything...</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-muted-foreground rounded-full hover:bg-accent">
              <Bell className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.05),rgba(255,255,255,0))]">
          <div className="max-w-6xl mx-auto">
            <Outlet context={{ session }} />
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {isMobile && isSidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        />
      )}
    </div>
  );
}
