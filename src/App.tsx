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
import { CalendarioPage } from "@/modules/calendario/CalendarioPage";
import CrmPage from "@/modules/crm/CrmPage";
import MisHerramientasPage from "@/modules/mis-herramientas/MisHerramientasPage";
import AsignacionesPersonalesPage from "@/modules/asignaciones-personales/AsignacionesPersonalesPage";
import ItemsRevisionPage from "@/modules/items-revision/ItemsRevisionPage";
import GoogleCalendarConfigPage from "@/modules/configuracion/GoogleCalendarConfigPage";
import RemitosPage from "@/modules/remitos/RemitosPage";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
            <Route path="/" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
            <Route path="/obras" element={<ErrorBoundary><ObrasPage /></ErrorBoundary>} />
            <Route path="/calendario" element={<ErrorBoundary><CalendarioPage /></ErrorBoundary>} />
            <Route path="/stock" element={<ErrorBoundary><StockPage /></ErrorBoundary>} />
            <Route path="/solicitudes" element={<ErrorBoundary><SolicitudesPage /></ErrorBoundary>} />
            <Route path="/movimientos" element={<ErrorBoundary><MovimientosPage /></ErrorBoundary>} />
            <Route path="/mis-herramientas" element={<ErrorBoundary><MisHerramientasPage /></ErrorBoundary>} />
            <Route path="/asignaciones-personales" element={<ErrorBoundary><AsignacionesPersonalesPage /></ErrorBoundary>} />
            <Route path="/items-revision" element={<ErrorBoundary><ItemsRevisionPage /></ErrorBoundary>} />
            <Route path="/config/google-calendar" element={<ErrorBoundary><GoogleCalendarConfigPage /></ErrorBoundary>} />
            <Route path="/compras" element={<ErrorBoundary><ComprasPage /></ErrorBoundary>} />
            <Route path="/reportes" element={<ErrorBoundary><ReportesPage /></ErrorBoundary>} />
            <Route path="/crm" element={<ErrorBoundary><CrmPage /></ErrorBoundary>} />
            <Route path="/remitos" element={<ErrorBoundary><RemitosPage /></ErrorBoundary>} />
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
