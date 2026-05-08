import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useAuth } from "@/lib/auth";

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const { profile } = useAuth();

  // Cerrar drawer al cambiar de ruta
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Bloquear scroll del body cuando drawer está abierto
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar fijo en desktop */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Drawer en mobile */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <div
        className={`fixed top-0 left-0 h-full z-50 transition-transform duration-300 lg:hidden ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar />
      </div>

      <main className="flex-1 min-w-0 overflow-x-hidden">
        {/* Header mobile */}
        <header className="lg:hidden sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 h-14">
            <button
              onClick={() => setDrawerOpen(true)}
              className="h-10 w-10 rounded-md hover:bg-accent flex items-center justify-center"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <img
                src="/logo-fibracor.png"
                alt="FIBRACOR"
                className="h-7 w-auto rounded"
              />
            </div>
            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs">
              {profile?.nombre.split(" ").slice(0, 2).map(s => s[0]).join("") || "?"}
            </div>
          </div>
        </header>

        <div className="container max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
