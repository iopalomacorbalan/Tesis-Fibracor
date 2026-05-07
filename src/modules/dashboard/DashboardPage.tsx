import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Bienvenido, {profile?.nombre.split(",")[0] ?? "—"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>🚧 En construcción</CardTitle>
          <CardDescription>
            Estamos migrando los módulos a la nueva versión. El dashboard con métricas estará disponible pronto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Usuario:</span> <b>{profile?.nombre}</b></div>
            <div><span className="text-muted-foreground">Área:</span> <b>{profile?.area}</b></div>
            <div><span className="text-muted-foreground">Email:</span> <b>{profile?.email}</b></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
