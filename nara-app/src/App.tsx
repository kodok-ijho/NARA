import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthScreen } from "./components/AuthScreen";
import { Dashboard } from "./components/Dashboard";
import { RagaScreen } from "./components/RagaScreen";
import { ArtaScreen } from "./components/ArtaScreen";
import { MasaScreen } from "./components/MasaScreen";
import { ProfileScreen } from "./components/ProfileScreen";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { Toaster } from "@/components/ui/sonner";

import { LanguageProvider } from "./lib/i18n.tsx";

import { FilterProvider } from "./context/FilterContext";

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<AuthScreen />} />
        
        <Route element={<ProtectedRoute />}>
          <Route element={
            <FilterProvider>
              <DashboardLayout />
            </FilterProvider>
          }>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/raga" element={<RagaScreen />} />
            <Route path="/dashboard/arta" element={<ArtaScreen />} />
            <Route path="/dashboard/masa" element={<MasaScreen />} />
            <Route path="/dashboard/profile" element={<ProfileScreen />} />
          </Route>
        </Route>
        
        {/* Catch-all route to redirect unknown paths to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <Toaster position="top-center" richColors />
      </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;
