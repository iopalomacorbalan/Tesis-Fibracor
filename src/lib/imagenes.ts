/**
 * Compresión de imágenes en el navegador antes de subirlas.
 * Redimensiona manteniendo proporción y recomprime como JPEG.
 *
 * Una foto típica de celular (4000x3000, ~6MB) queda en ~1600x1200 y ~300KB.
 */

const MAX_DIMENSION = 1600; // lado más largo en píxeles
const JPEG_QUALITY = 0.82;  // 0-1; 0.82 es buen balance calidad/peso
const THUMB_DIMENSION = 320; // miniatura para grillas y overview
const THUMB_QUALITY = 0.7;

/** Tipos que sí conviene comprimir. Los demás se suben tal cual. */
const COMPRIMIBLES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export interface ResultadoCompresion {
  file: File;
  originalKB: number;
  finalKB: number;
  reduccion: number; // porcentaje
}

/**
 * Comprime una imagen. Si falla o no es comprimible, devuelve el archivo original.
 */
export async function comprimirImagen(file: File): Promise<ResultadoCompresion> {
  const originalKB = Math.round(file.size / 1024);
  const sinCambios = (f: File): ResultadoCompresion => ({
    file: f, originalKB, finalKB: originalKB, reduccion: 0,
  });

  if (!COMPRIMIBLES.includes(file.type.toLowerCase())) return sinCambios(file);

  try {
    const bitmap = await cargarImagen(file);

    // Si ya es chica, no vale la pena recomprimir
    if (bitmap.width <= MAX_DIMENSION && bitmap.height <= MAX_DIMENSION && originalKB < 500) {
      cerrarBitmap(bitmap);
      return sinCambios(file);
    }

    // Calcular nuevo tamaño manteniendo proporción
    const escala = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * escala);
    const h = Math.round(bitmap.height * escala);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) { cerrarBitmap(bitmap); return sinCambios(file); }

    // Suavizado de calidad al reescalar
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap as any, 0, 0, w, h);
    cerrarBitmap(bitmap);

    const blob: Blob | null = await new Promise(resolve =>
      canvas.toBlob(b => resolve(b), "image/jpeg", JPEG_QUALITY)
    );
    if (!blob) return sinCambios(file);

    // Si por algún motivo quedó más pesada, nos quedamos con la original
    if (blob.size >= file.size) return sinCambios(file);

    const nombreBase = file.name.replace(/\.[^.]+$/, "");
    const comprimido = new File([blob], `${nombreBase}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });

    const finalKB = Math.round(comprimido.size / 1024);
    return {
      file: comprimido,
      originalKB,
      finalKB,
      reduccion: Math.round((1 - finalKB / originalKB) * 100),
    };
  } catch (e) {
    console.warn("No se pudo comprimir la imagen, se sube original:", e);
    return sinCambios(file);
  }
}

/** Comprime varias imágenes en paralelo. */
export async function comprimirImagenes(files: File[]): Promise<ResultadoCompresion[]> {
  return Promise.all(files.map(f => comprimirImagen(f)));
}

/**
 * Genera una miniatura (~320px) para grillas y previsualizaciones.
 * Devuelve null si no se pudo generar (se usará la original como fallback).
 */
export async function generarMiniatura(file: File): Promise<File | null> {
  if (!COMPRIMIBLES.includes(file.type.toLowerCase())) return null;
  try {
    const blob = await redimensionar(file, THUMB_DIMENSION, THUMB_QUALITY);
    if (!blob) return null;
    const nombreBase = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${nombreBase}_thumb.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (e) {
    console.warn("No se pudo generar miniatura:", e);
    return null;
  }
}

/**
 * Procesa una foto para subir: devuelve la versión comprimida y su miniatura.
 */
export async function prepararFoto(file: File): Promise<{ principal: File; miniatura: File | null }> {
  const { file: principal } = await comprimirImagen(file);
  const miniatura = await generarMiniatura(principal);
  return { principal, miniatura };
}

/** Redimensiona un archivo de imagen al lado máximo indicado. */
async function redimensionar(file: File, maxLado: number, calidad: number): Promise<Blob | null> {
  const bitmap = await cargarImagen(file);
  const anchoOrig = (bitmap as any).width as number;
  const altoOrig = (bitmap as any).height as number;

  const escala = Math.min(1, maxLado / Math.max(anchoOrig, altoOrig));
  const w = Math.round(anchoOrig * escala);
  const h = Math.round(altoOrig * escala);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) { cerrarBitmap(bitmap); return null; }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap as any, 0, 0, w, h);
  cerrarBitmap(bitmap);

  return new Promise(resolve => canvas.toBlob(b => resolve(b), "image/jpeg", calidad));
}

// ===== helpers internos =====

async function cargarImagen(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap es más rápido y no bloquea el hilo principal
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // sigue al fallback
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function cerrarBitmap(b: ImageBitmap | HTMLImageElement) {
  if (typeof ImageBitmap !== "undefined" && b instanceof ImageBitmap) b.close();
}
