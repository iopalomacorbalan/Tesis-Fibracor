import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { prepararFoto } from "@/lib/imagenes";
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
          fotos:reporte_fotos(*),
          reporte_tecnicos(usuario:usuarios!reporte_tecnicos_tecnico_id_fkey(id, nombre, area))
        `);
      if (obraId) q = q.eq("obra_id", obraId);
      const { data, error } = await q.order("fecha", { ascending: false });
      if (error) throw error;
      const reportes = ((data ?? []) as any[]).map(r => ({
        ...r,
        tecnicos_presentes: (r.reporte_tecnicos ?? []).map((rt: any) => rt.usuario),
      }));
      return reportes as ReporteConRelaciones[];
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
          fotos:reporte_fotos(*),
          reporte_tecnicos(usuario:usuarios!reporte_tecnicos_tecnico_id_fkey(id, nombre, area))
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      const reporte = data as any;
      reporte.tecnicos_presentes = (reporte.reporte_tecnicos ?? []).map((rt: any) => rt.usuario);
      return reporte;
    },
  });
}

type ReporteInput = {
  obra_id: string;
  fecha?: string;
  descripcion?: string;
  trabajos_realizados?: string;
  pendientes?: string;
  hora_entrada?: string;
  hora_salida?: string;
  fotos?: File[];
};

export function useCrearReporte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReporteInput) => {
      const userResp = await supabase.auth.getUser();
      const userId = userResp.data.user?.id;

      const { data: rep, error } = await supabase
        .from("reportes")
        .insert({
          obra_id: input.obra_id,
          tecnico_id: userId ?? null,
          fecha: input.fecha ?? new Date().toISOString().slice(0, 10),
          descripcion: input.descripcion ?? null,
          trabajos_realizados: input.trabajos_realizados ?? null,
          pendientes: input.pendientes ?? null,
          hora_entrada: input.hora_entrada ?? null,
          hora_salida: input.hora_salida ?? null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      const repRow = rep as any;

      // Subir fotos si las hay
      if (input.fotos && input.fotos.length > 0) {
        for (const original of input.fotos) {
          // Comprimir + generar miniatura antes de subir
          const { principal, miniatura } = await prepararFoto(original);
          const ts = Date.now();
          const rnd = Math.random().toString(36).slice(2, 8);
          const ext = (principal.name.split(".").pop() ?? "jpg").toLowerCase();
          const path = `${repRow.id}/${ts}-${rnd}.${ext}`;

          const { error: errUp } = await supabase.storage
            .from(BUCKET)
            .upload(path, principal, { upsert: false });
          if (errUp) {
            console.error("Error subiendo foto:", errUp);
            continue;
          }
          const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

          // Subir miniatura (si falla, la foto igual queda cargada)
          let thumbPath: string | null = null;
          let thumbUrl: string | null = null;
          if (miniatura) {
            thumbPath = `${repRow.id}/${ts}-${rnd}_thumb.jpg`;
            const { error: errTh } = await supabase.storage
              .from(BUCKET)
              .upload(thumbPath, miniatura, { upsert: false });
            if (errTh) { thumbPath = null; }
            else {
              const { data: pubT } = supabase.storage.from(BUCKET).getPublicUrl(thumbPath);
              thumbUrl = pubT.publicUrl;
            }
          }

          await supabase.from("reporte_fotos").insert({
            reporte_id: repRow.id,
            storage_path: path,
            url: pub.publicUrl,
            thumb_path: thumbPath,
            thumb_url: thumbUrl,
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
      for (const original of fotos) {
        // Comprimir + generar miniatura antes de subir
        const { principal, miniatura } = await prepararFoto(original);
        const ts = Date.now();
        const rnd = Math.random().toString(36).slice(2, 8);
        const ext = (principal.name.split(".").pop() ?? "jpg").toLowerCase();
        const path = `${reporteId}/${ts}-${rnd}.${ext}`;
        const { error: errUp } = await supabase.storage
          .from(BUCKET)
          .upload(path, principal, { upsert: false });
        if (errUp) throw errUp;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

        // Subir miniatura (si falla, la foto igual queda cargada)
        let thumbPath: string | null = null;
        let thumbUrl: string | null = null;
        if (miniatura) {
          thumbPath = `${reporteId}/${ts}-${rnd}_thumb.jpg`;
          const { error: errTh } = await supabase.storage
            .from(BUCKET)
            .upload(thumbPath, miniatura, { upsert: false });
          if (errTh) { thumbPath = null; }
          else {
            const { data: pubT } = supabase.storage.from(BUCKET).getPublicUrl(thumbPath);
            thumbUrl = pubT.publicUrl;
          }
        }

        const { data: row } = await supabase.from("reporte_fotos").insert({
          reporte_id: reporteId,
          storage_path: path,
          url: pub.publicUrl,
          thumb_path: thumbPath,
          thumb_url: thumbUrl,
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
      // Borrar la foto y su miniatura (si tiene)
      const paths = [foto.storage_path, (foto as any).thumb_path].filter(Boolean) as string[];
      await supabase.storage.from(BUCKET).remove(paths);
      const { error } = await supabase.from("reporte_fotos").delete().eq("id", foto.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useEditarReporte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: {
      id: string;
      patch: Partial<{
        fecha: string;
        descripcion: string | null;
        trabajos_realizados: string | null;
        pendientes: string | null;
        obra_id: string;
        hora_entrada: string | null;
        hora_salida: string | null;
      }>;
    }) => {
      const { data, error } = await supabase
        .from("reportes")
        .update(patch as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Reporte;
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
