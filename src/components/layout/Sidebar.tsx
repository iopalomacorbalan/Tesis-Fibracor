import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Briefcase, Package, FileText, ShoppingCart,
  Users, ClipboardList, LogOut, Wrench, ScrollText, CalendarDays, Clock, Wallet, Images, HardDriveDownload, ShieldCheck, ChevronDown, UserCog, CalendarCheck,
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
  /** Otras rutas que también dejan este ítem marcado (pestañas de su sección) */
  tambien?: string[];
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
  { to: "/stock", icon: Package, label: "Stock", group: "Operaciones",
    tambien: ["/movimientos", "/items-revision"] },
  { to: "/mis-herramientas", icon: Wrench, label: "Herramientas", group: "Operaciones",
    tambien: ["/asignaciones-personales"] },
  { to: "/liquidacion", icon: Clock, label: "Liquidación de horas", group: "Administración",
    roles: ["Direccion", "Operaciones", "Contabilidad"] },
  { to: "/caja-chica", icon: Wallet, label: "Caja Chica", group: "Administración",
    roles: ["Direccion", "Operaciones", "Contabilidad"] },
  { to: "/usuarios", icon: UserCog, label: "Usuarios", group: "Administración",
    roles: ["Direccion", "Operaciones"] },
  { to: "/auditoria", icon: ShieldCheck, label: "Auditoría", group: "Administración",
    roles: ["Direccion"] },
  { to: "/config/mi-google-calendar", icon: CalendarCheck, label: "Mi Google Calendar", group: "Configuración" },
  { to: "/config/optimizar-fotos", icon: Images, label: "Optimizar fotos", group: "Configuración",
    roles: ["Direccion"] },
  { to: "/config/backup", icon: HardDriveDownload, label: "Copia de seguridad", group: "Configuración",
    roles: ["Direccion"] },
  { to: "/solicitudes", icon: ClipboardList, label: "Solicitudes", group: "Operaciones" },
  { to: "/compras", icon: ShoppingCart, label: "Compras", group: "Operaciones",
    roles: ["Direccion", "Operaciones", "Paniol", "Contabilidad"] },
];

// Pantallas que ya no tienen ítem propio en el menú (son pestañas) pero siguen restringidas por área
const RUTAS_PESTANA: { to: string; roles: string[] }[] = [
  { to: "/movimientos", roles: ["Direccion", "Operaciones", "Contabilidad", "Paniol"] },
  { to: "/items-revision", roles: ["Direccion", "Operaciones", "Contabilidad", "Paniol"] },
  { to: "/asignaciones-personales", roles: ["Direccion", "Operaciones", "Contabilidad", "Paniol"] },
];

/**
 * ¿El área puede entrar a esta ruta? Usa los mismos roles que el menú,
 * para que una pantalla oculta tampoco se pueda abrir escribiendo la URL.
 */
export function puedeVerRuta(pathname: string, area: string | undefined): boolean {
  const reglas = [...NAV.map(n => ({ to: n.to, roles: n.roles })), ...RUTAS_PESTANA];
  const regla = reglas.find(n => n.to !== "/" && (pathname === n.to || pathname.startsWith(n.to + "/")));
  if (!regla?.roles) return true;
  return !!area && regla.roles.includes(area);
}

function estaActivo(pathname: string, to: string) {
  return to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");
}

function ItemLink({ item, anidado }: { item: NavItem; anidado?: boolean }) {
  const { pathname } = useLocation();
  const enPestana = !!item.tambien?.some(r => estaActivo(pathname, r));
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
          anidado && "pl-4",
          isActive || enPestana
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        )
      }
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
    </NavLink>
  );
}

export function Sidebar() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const userArea = profile?.area;

  const visible = NAV.filter(n => !n.roles || (userArea && n.roles.includes(userArea)));

  const groups = visible.reduce<Record<string, NavItem[]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  // Submenús que la persona abrió a mano. Al cambiar de grupo, los demás se cierran solos
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const grupoActivo = Object.entries(groups).find(([, items]) => items.some(i => estaActivo(pathname, i.to) || i.tambien?.some(r => estaActivo(pathname, r))))?.[0];

  useEffect(() => {
    setManual(grupoActivo ? { [grupoActivo]: true } : {});
  }, [grupoActivo]);

  const alternar = (g: string, abierto: boolean) => setManual(prev => ({ ...prev, [g]: !abierto }));

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

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {Object.entries(groups).map(([group, items]) => {
          // Un grupo con un solo ítem (Dashboard) no necesita submenú
          if (items.length === 1) {
            return (
              <div key={group} className="pb-1">
                <ItemLink item={items[0]} />
              </div>
            );
          }

          const abierto = manual[group] ?? group === grupoActivo;
          const idLista = `menu-${group.replace(/\s+/g, "-").toLowerCase()}`;
          return (
            <div key={group}>
              <button
                type="button"
                onClick={() => alternar(group, abierto)}
                aria-expanded={abierto}
                aria-controls={idLista}
                className={cn(
                  "w-full flex items-center justify-between rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors hover:bg-accent",
                  group === grupoActivo ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span>{group}</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", abierto ? "rotate-0" : "-rotate-90")} />
              </button>
              {abierto && (
                <ul id={idLista} className="mt-1 mb-2 ml-3 space-y-1 border-l border-border pl-2">
                  {items.map(item => (
                    <li key={item.to}>
                      <ItemLink item={item} anidado />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
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
