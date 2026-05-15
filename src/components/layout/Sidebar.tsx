import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Briefcase, Package, FileText, ShoppingCart,
  Users, ClipboardList, GitBranch, LogOut, Wrench, ScrollText, CalendarDays, Package2, AlertCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  group: string;
  roles?: string[];
}

const NAV: NavItem[] = [
  // Principal
  { to: "/", icon: LayoutDashboard, label: "Dashboard", group: "Principal" },

  // Comercial
  { to: "/crm", icon: Users, label: "CRM", group: "Comercial",
    roles: ["Direccion", "Operaciones", "Comercial", "Contabilidad"] },
  { to: "/remitos", icon: ScrollText, label: "Remitos", group: "Comercial",
    roles: ["Direccion", "Operaciones", "Comercial", "Paniol", "Contabilidad"] },

  // Proyectos
  { to: "/obras", icon: Briefcase, label: "Obras", group: "Proyectos" },
  { to: "/calendario", icon: CalendarDays, label: "Calendario", group: "Proyectos" },
  { to: "/reportes", icon: FileText, label: "Reportes", group: "Proyectos" },

  // Operaciones
  { to: "/stock", icon: Package, label: "Stock", group: "Operaciones" },
  { to: "/mis-herramientas", icon: Wrench, label: "Mis herramientas", group: "Operaciones" },
  { to: "/asignaciones-personales", icon: Package2, label: "Asignaciones diarias", group: "Operaciones",
    roles: ["Direccion", "Operaciones", "Paniol"] },
  { to: "/items-revision", icon: AlertCircle, label: "Items en revisión", group: "Operaciones",
    roles: ["Direccion", "Operaciones", "Paniol"] },
  { to: "/solicitudes", icon: ClipboardList, label: "Solicitudes", group: "Operaciones" },
  { to: "/movimientos", icon: GitBranch, label: "Movimientos", group: "Operaciones",
    roles: ["Direccion", "Operaciones", "Paniol"] },
  { to: "/compras", icon: ShoppingCart, label: "Compras", group: "Operaciones",
    roles: ["Direccion", "Operaciones", "Paniol", "Contabilidad"] },
];

export function Sidebar() {
  const { profile } = useAuth();
  const userArea = profile?.area;

  const visible = NAV.filter(n => !n.roles || (userArea && n.roles.includes(userArea)));

  const groups = visible.reduce<Record<string, NavItem[]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  return (
    <aside className="w-[260px] sm:w-64 bg-card border-r border-border flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <img
            src="/logo-fibracor.png"
            alt="FIBRACOR"
            className="h-10 w-auto rounded-md"
          />
          <div className="text-xs text-muted-foreground">
            Gestión operativa
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group}>
            <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group}
            </div>
            <ul className="space-y-1">
              {items.map(item => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <UserCard />
    </aside>
  );
}

function UserCard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  if (!profile) return null;

  return (
    <div className="p-3 border-t border-border">
      <div className="flex items-center gap-3 px-2 py-2">
        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
          {profile.nombre.split(" ").slice(0, 2).map(s => s[0]).join("")}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{profile.nombre}</div>
          <div className="text-xs text-muted-foreground">{profile.area}</div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
        className="w-full justify-start mt-2 text-muted-foreground hover:text-destructive"
      >
        <LogOut className="h-4 w-4" />
        Cerrar sesión
      </Button>
    </div>
  );
}
