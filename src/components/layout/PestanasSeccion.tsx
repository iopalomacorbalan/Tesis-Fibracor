import { NavLink, Outlet } from "react-router-dom";
import { Package, GitBranch, AlertCircle, Wrench, Package2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface Pestana {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

const ROLES_OPERATIVOS = ["Direccion", "Operaciones", "Contabilidad", "Paniol"];

const PESTANAS_STOCK: Pestana[] = [
  { to: "/stock", label: "Inventario", icon: Package },
  { to: "/movimientos", label: "Movimientos", icon: GitBranch, roles: ROLES_OPERATIVOS },
  { to: "/items-revision", label: "En revisión", icon: AlertCircle, roles: ROLES_OPERATIVOS },
];

const PESTANAS_HERRAMIENTAS: Pestana[] = [
  { to: "/mis-herramientas", label: "Mis herramientas", icon: Wrench },
  { to: "/asignaciones-personales", label: "Asignaciones diarias", icon: Package2, roles: ROLES_OPERATIVOS },
];

/**
 * Barra de pestañas arriba de varias pantallas que van juntas.
 * Cada pestaña sigue siendo su propia ruta (los links de siempre funcionan) y
 * solo se muestran las que el área de la persona puede ver.
 */
function PestanasSeccion({ pestanas }: { pestanas: Pestana[] }) {
  const area = useAuth(s => s.profile?.area);
  const visibles = pestanas.filter(p => !p.roles || (area && p.roles.includes(area)));

  return (
    <div className="space-y-5">
      {visibles.length > 1 && (
        <nav aria-label="Secciones" className="flex gap-1 border-b border-border overflow-x-auto">
          {visibles.map(p => (
            <NavLink
              key={p.to}
              to={p.to}
              end
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm -mb-px border-b-2 transition-colors",
                  isActive
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )
              }
            >
              <p.icon className="h-4 w-4 shrink-0" />
              {p.label}
            </NavLink>
          ))}
        </nav>
      )}
      <Outlet />
    </div>
  );
}

export const StockSeccion = () => <PestanasSeccion pestanas={PESTANAS_STOCK} />;
export const HerramientasSeccion = () => <PestanasSeccion pestanas={PESTANAS_HERRAMIENTAS} />;
