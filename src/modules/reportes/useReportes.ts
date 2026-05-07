import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Reporte, ReporteConRelaciones, ReporteFoto } from "@/types/database";

const KEY = "reportes";
const BUCKET = "reportes-fotos";

export function useReportes(obraId?: string | null) {
  return useQuery({
    queryKey: [KEY, { obraId }],
    queryFn: async (): Promise<ReporteConRelaciones[]> => {
      let q = supabase
        .from("reportes")
        .select(`
          *,
          obra:obras(id, obra_id, nombre_obra, sitio),
          tecnico:usuarios!reportes_tecnico_id_fkey(id, nombre, area, email),
          fotos:reporte_fotos(*)
        `);
      if (obraId) q = q.eq("obra_id", obraId);
      const { data, error } = await q.order("fecha", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]) as ReporteConRelaciones[];
    },
  });
}

export function useReporte(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, id],
    enabled: !!id,
    queryFn: async (): Promise<ReporteConRelaciones | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("reportes")
        .select(`
          *,
          obra:obras(id, obra_id, nombre_obra, sitio),
          tecnico:usuarios!reportes_tecnico_id_fkey(id, nombre, email),
          fotos:reporte_fotos(*)
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
  });
}

type ReporteInput = {
  obra_id: string;
  fecha?: string;
  descripcion?: string;
  trabajos_realizados?: string;
  pendientes?: string;
  fotos?: File[];
};

async function generarReporteId(): Promise<string> {
  const { data } = await supabase.from("reportes").select("reporte_id");
  const max = ((data as any[]) ?? [])
    .map((r: any) => parseInt(String(r.reporte_id ?? "").split("-").pop() || "0"))
    .reduce((m: number, n: number) => Math.max(m, n), 0);
  return `REP-${String(max + 1).padStart(3, "0")}`;
}

export function useCrearReporte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReporteInput) => {
      const reporte_id = await generarReporteId();
      const userResp = await supabase.auth.getUser();
      const userId = userResp.data.user?.id;

      const { data: rep, error } = await supabase
        .from("reportes")
        .insert({
          reporte_id,
          obra_id: input.obra_id,
          tecnico_id: userId ?? null,
          fecha: input.fecha ?? new Date().toISOString().slice(0, 10),
          descripcion: input.descripcion ?? null,
          trabajos_realizados: input.trabajos_realizados ?? null,
          pendientes: input.pendientes ?? null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      const repRow = rep as any;

      // Subir fotos si las hay
      if (input.fotos && input.fotos.length > 0) {
        for (const file of input.fotos) {
          const ts = Date.now();
          const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
          const path = `${repRow.id}/${ts}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

          const { error: errUp } = await supabase.storage
            .from(BUCKET)
            .upload(path, file, { upsert: false });
          if (errUp) {
            console.error("Error subiendo foto:", errUp);
            continue;
          }
          const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
          await supabase.from("reporte_fotos").insert({
            reporte_id: repRow.id,
            storage_path: path,
            url: pub.publicUrl,
            caption: null,
          } as any);
        }
      }

      return repRow as Reporte;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useAgregarFotos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reporteId, fotos }: { reporteId: string; fotos: File[] }) => {
      const subidas: ReporteFoto[] = [];
      for (const file of fotos) {
        const ts = Date.now();
        const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
        const path = `${reporteId}/${ts}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: errUp } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { upsert: false });
        if (errUp) throw errUp;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const { data: row } = await supabase.from("reporte_fotos").insert({
          reporte_id: reporteId,
          storage_path: path,
          url: pub.publicUrl,
          caption: null,
        } as any).select().single();
        if (row) subidas.push(row as any);
      }
      return subidas;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useEliminarFoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (foto: ReporteFoto) => {
      await supabase.storage.from(BUCKET).remove([foto.storage_path]);
      const { error } = await supabase.from("reporte_fotos").delete().eq("id", foto.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useEliminarReporte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Eliminar fotos del storage
      const { data: fotos } = await supabase
        .from("reporte_fotos").select("storage_path").eq("reporte_id", id);
      if (fotos && fotos.length > 0) {
        const paths = (fotos as any[]).map(f => f.storage_path);
        await supabase.storage.from(BUCKET).remove(paths);
      }
      const { error } = await supabase.from("reportes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
