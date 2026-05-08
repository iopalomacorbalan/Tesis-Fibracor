import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, initialized, profileLoading } = useAuth();

  if (!initialized || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Cargando...</span>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Si hay user pero no profile (perfil pendiente o error), mostrar loader breve
  // antes de renderizar (evita que componentes con permisos fallen)
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Cargando perfil...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
