import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";

export function ProtectedRoute() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Memeriksa status sesi saat ini ketika pertama kali di mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Menonton perubahan sesi di masa depan (logout/login dari tab lain juga termonitor)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950">
        <Loader2 className="animate-spin text-zinc-500 w-10 h-10" />
      </div>
    );
  }

  // Jika tidak ada user session, tendang paksa ke /login
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Jika aman, render rute anak (misalnya /dashboard)
  return <Outlet context={{ session }} />;
}
