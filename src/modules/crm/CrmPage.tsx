import { Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientesList } from "./clientes/ClientesList";
import { ProveedoresList } from "./proveedores/ProveedoresList";

export default function CrmPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          CRM
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestión de clientes y proveedores
        </p>
      </div>

      <Tabs defaultValue="clientes">
        <TabsList>
          <TabsTrigger value="clientes">👥 Clientes</TabsTrigger>
          <TabsTrigger value="proveedores">🚚 Proveedores</TabsTrigger>
        </TabsList>

        <TabsContent value="clientes">
          <ClientesList />
        </TabsContent>

        <TabsContent value="proveedores">
          <ProveedoresList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
