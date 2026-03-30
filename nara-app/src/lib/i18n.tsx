import React, { createContext, useContext, useState } from "react";

type Language = "en" | "id";

const translations: Record<Language, any> = {
  en: {
    // Nav & Common
    nav: {
      dashboard: "Dashboard",
      raga: "RAGA",
      arta: "ARTA",
      masa: "MASA",
      profile: "Profile",
    },
    common: {
      save: "Save Changes",
      saving: "Synchronizing...",
      role: "Verified Meta-User",
      delete: "Delete",
      cancel: "Cancel",
      add: "Add",
      loading: "Loading...",
      search: "Search everything...",
      appearance: "Appearance",
      language: "Language",
      theme: "Theme",
      mode: "Mode",
      classic: "Classic",
      neon: "Neon",
      light: "Light",
      dark: "Dark",
    },
    // Dashboard
    dash: {
      welcome: "Welcome back",
      syncing: "Synchronizing NARA",
      aligning: "Aligning your digital ecosystem...",
      balanced: "Everything looks balanced today. Health and wealth are on track.",
      wealth: "Wealth Status",
      health: "Health Status",
      agenda: "Agenda Load",
      net_balance: "Net Balance",
      pts_today: "pts today",
      pending_actions: "Pending Actions",
    },
    // RAGA
    raga: {
      title: "Nutrition Hub",
      subtitle: "Record Asupan Gizi Anda: Daily monitoring, weekly trends, and monthly health analysis.",
      active_rank: "Active Rank",
      thresholds: "Level Thresholds",
      daily_kcal: "Daily Calories",
      kcal_logged: "kcal logged",
      target: "Target",
      remaining: "Remaining",
      analysis: "Analysis & Reports",
      daily: "daily",
      weekly: "weekly",
      monthly: "monthly",
      period_total: "Period Total",
      daily_avg: "Daily Avg",
      over_target: "OVER TARGET",
      over_target_hint: "LIMIT EXCEEDED",
      pts: "pts",
      scoring_engine: "Scoring Engine",
      success: "Success",
      penalty: "Penalty",
      strategy_active: "Strategy Active",
      add_meal: "Add Meal Log",
      meal_placeholder: "What did you eat?",
      kcal_placeholder: "Calories (kcal)",
      log_meal: "Log Meal",
      today_activity: "Today's Activity",
      no_logs: "No nutrition logs found for this date.",
      ai_estimating: "NARA is analyzing...",
      ai_estimate_btn: "Magic Estimate",
      ai_disclaimer: "Estimation based on standard NARA assessment",
    },
    // ARTA
    arta: {
      wealth: "ARTA Wealth",
      spending: "Top Spending",
      income: "Top Income",
      details: "Details",
      no_data: "No data available.",
    },
    // MASA
    masa: {
      agenda: "MASA Agenda",
      focus: "Today's Focus",
      ritual: "Next Ritual",
      open: "Open Agenda",
      no_tasks: "No pending tasks.",
      no_rituals: "No rituals defined.",
    },
    // Profile/Settings
    profile: {
      title: "Profile & Settings",
      subtitle: "Manage your identity, health parameters, and app preferences.",
      health_summary: "Health Summary",
      biometrics: "Physical Biometrics",
      app_settings: "Application Settings",
      height: "Height (cm)",
      weight: "Weight (kg)",
      age: "Age",
      gender: "Gender",
      male: "Male",
      female: "Female",
      target_weight: "Target Weight (kg)",
      activity_level: "Activity Level",
      methodology: "NARA Calculation Methodology",
      fullname: "Full Name",
      phone: "Phone Number",
      success_update: "Profile & Biometrics Updated",
      sync_success: "Synchronized to NARA via n8n orchestration.",
      update_failed: "Update Failed",
      awaiting_data: "Awaiting Data",
      awaiting_biometrics: "Update your biometrics in Profile to see health stats.",
      full_assessment: "Full Assessment",
      app_settings_desc: "Centralized control for Language, Theme, and Mode.",
      underweight: "Underweight",
      healthy: "Healthy",
      overweight: "Overweight",
      obese: "Obese",
    }
  },
  id: {
    // Nav & Common
    nav: {
      dashboard: "Dasbor",
      raga: "RAGA",
      arta: "ARTA",
      masa: "MASA",
      profile: "Profil",
    },
    common: {
      save: "Simpan Perubahan",
      saving: "Sinkronisasi...",
      role: "Meta-User Terverifikasi",
      delete: "Hapus",
      cancel: "Batal",
      add: "Tambah",
      loading: "Memuat...",
      search: "Cari apa saja...",
      appearance: "Tampilan",
      language: "Bahasa",
      theme: "Tema",
      mode: "Mode",
      classic: "Klasik",
      neon: "Neon",
      light: "Terang",
      dark: "Gelap",
    },
    // Dashboard
    dash: {
      welcome: "Selamat datang kembali",
      syncing: "Menyinkronkan NARA",
      aligning: "Menyelaraskan ekosistem digital Anda...",
      balanced: "Semua tampak seimbang hari ini. Kesehatan dan keuangan terkendali.",
      wealth: "Status Kekayaan",
      health: "Status Kesehatan",
      agenda: "Beban Agenda",
      net_balance: "Saldo Bersih",
      pts_today: "poin hari ini",
      pending_actions: "Tindakan Tertunda",
    },
    // RAGA
    raga: {
      title: "Pusat Nutrisi",
      subtitle: "Record Asupan Gizi Anda: Pemantauan harian, tren mingguan, dan analisis kesehatan bulanan.",
      active_rank: "Peringkat Aktif",
      thresholds: "Ambang Batas Level",
      daily_kcal: "Kalori Harian",
      kcal_logged: "kalori tercatat",
      target: "Target",
      remaining: "Sisa",
      analysis: "Analisis & Laporan",
      daily: "harian",
      weekly: "mingguan",
      monthly: "bulanan",
      period_total: "Total Periode",
      daily_avg: "Rata-rata Harian",
      over_target: "MELEBIHI TARGET",
      over_target_hint: "BATAS TERLAMPAUI",
      pts: "poin",
      scoring_engine: "Mesin Skor",
      success: "Berhasil",
      penalty: "Penalti",
      strategy_active: "Strategi Aktif",
      add_meal: "Tambah Catatan Makan",
      meal_placeholder: "Apa yang Anda makan?",
      kcal_placeholder: "Kalori (kcal)",
      log_meal: "Catat Makan",
      today_activity: "Aktivitas Hari Ini",
      no_logs: "Tidak ada catatan nutrisi untuk tanggal ini.",
      ai_estimating: "NARA sedang menganalisa...",
      ai_estimate_btn: "Estimasi Ajaib",
      ai_disclaimer: "Estimasi berdasarkan penilaian standar NARA",
    },
    // ARTA
    arta: {
      wealth: "Kekayaan ARTA",
      spending: "Pengeluaran Teratas",
      income: "Pemasukan Teratas",
      details: "Detail",
      no_data: "Tidak ada data tersedia.",
    },
    // MASA
    masa: {
      agenda: "Agenda MASA",
      focus: "Fokus Hari Ini",
      ritual: "Ritual Berikutnya",
      open: "Buka Agenda",
      no_tasks: "Tidak ada tugas tertunda.",
      no_rituals: "Tidak ada ritual.",
    },
    // Profile/Settings
    profile: {
      title: "Profil & Pengaturan",
      subtitle: "Kelola identitas, parameter kesehatan, dan preferensi aplikasi Anda.",
      health_summary: "Ringkasan Kesehatan",
      biometrics: "Biometrik Fisik",
      app_settings: "Pengaturan Aplikasi",
      height: "Tinggi Badan (cm)",
      weight: "Berat Badan (kg)",
      age: "Usia",
      gender: "Jenis Kelamin",
      male: "Laki-laki",
      female: "Perempuan",
      target_weight: "Target Berat (kg)",
      activity_level: "Tingkat Aktivitas",
      methodology: "Metodologi Kalkulasi NARA",
      fullname: "Nama Lengkap",
      phone: "Nomor Telepon",
      success_update: "Profil & Biometrik Diperbarui",
      sync_success: "Tersinkronisasi ke NARA melalui orkestrasi n8n.",
      update_failed: "Pembaruan Gagal",
      awaiting_data: "Menunggu Data",
      awaiting_biometrics: "Perbarui biometrik di Profil untuk melihat statistik kesehatan.",
      full_assessment: "Asesmen Lengkap",
      app_settings_desc: "Kontrol terpusat untuk Bahasa, Tema, dan Mode.",
      underweight: "Kekurangan Berat",
      healthy: "Sehat",
      overweight: "Kelebihan Berat",
      obese: "Obesitas",
    }
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem("nara-lang") as Language) || "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("nara-lang", lang);
  };

  const t = (key: string): string => {
    const keys = key.split(".");
    let result: any = translations[language];
    
    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = result[k];
      } else {
        console.warn(`[i18n] Key not found: ${key} (at ${k})`);
        return key;
      }
    }
    return typeof result === 'string' ? result : key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};
