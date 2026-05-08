import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import LoginPage from "@/modules/auth/LoginPage";
import DashboardPage from "@/modules/dashboard/DashboardPage";
import ObrasPage from "@/modules/obras/ObrasPage";
import StockPage from "@/modules/stock/StockPage";
import SolicitudesPage from "@/modules/solicitudes/SolicitudesPage";
import MovimientosPage from "@/modules/movimientos/MovimientosPage";
import ComprasPage from "@/modules/compras/ComprasPage";
import ReportesPage from "@/modules/reportes/ReportesPage";
import CrmPage from "@/modules/crm/CrmPage";
import MisHerramientasPage from "@/modules/mis-herramientas/MisHerramientasPage";
import RemitosPage from "@/modules/remitos/RemitosPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const init = useAuth(s => s.init);

  useEffect(() => { init(); }, [init]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/obras" element={<ObrasPage />} />
            <Route path="/stock" element={<StockPage />} />
            <Route path="/solicitudes" element={<SolicitudesPage />} />
            <Route path="/movimientos" element={<MovimientosPage />} />
            <Route path="/mis-herramientas" element={<MisHerramientasPage />} />
            <Route path="/compras" element={<ComprasPage />} />
            <Route path="/reportes" element={<ReportesPage />} />
            <Route path="/crm" element={<CrmPage />} />
            <Route path="/remitos" element={<RemitosPage />} />
            <Route path="*" element={<Placeholder />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster theme="dark" richColors position="top-right" />
    </QueryClientProvider>
  );
}

function Placeholder() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">🚧 Módulo en desarrollo</h1>
      <p className="text-muted-foreground">Este módulo se está construyendo. Volvé pronto.</p>
    </div>
  );
}
