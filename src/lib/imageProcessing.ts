/**
 * Procesa una imagen antes de subirla a Supabase Storage.
 *
 * - Convierte HEIC/HEIF a JPG (iPhones modernos guardan en HEIC).
 * - Comprime imágenes grandes (>2MB → ~1.5MB, max 2048px lado largo).
 * - Aplica orientación EXIF correctamente.
 * - Devuelve siempre un File JPG listo para upload.
 *
 * Si el procesamiento falla, devuelve el archivo original con un warning en consola
 * (para que el usuario al menos pueda intentar subir lo que tiene).
 */
import imageCompression from "browser-image-compression";

const HEIC_MIME_TYPES = ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"];
const HEIC_EXTENSIONS = [".heic", ".heif"];

function esHeic(file: File): boolean {
  if (HEIC_MIME_TYPES.includes(file.type.toLowerCase())) return true;
  const name = file.name.toLowerCase();
  return HEIC_EXTENSIONS.some(ext => name.endsWith(ext));
}

/**
 * Convierte un HEIC/HEIF a JPG.
 * Importa heic2any solo cuando lo necesita (lazy load) para no bloquear el bundle inicial.
 */
async function convertirHeicAJpg(file: File): Promise<File> {
  try {
    const heic2any = (await import("heic2any")).default;
    const result = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.9,
    });
    const blob = Array.isArray(result) ? result[0] : result;
    // Cambiar la extensión a .jpg
    const newName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
    return new File([blob], newName, { type: "image/jpeg" });
  } catch (e) {
    console.error("Error convirtiendo HEIC:", e);
    throw new Error("No se pudo convertir la imagen HEIC. Probá sacar la foto en formato JPG.");
  }
}

/**
 * Comprime y normaliza una imagen (jpg / png).
 */
async function comprimirImagen(file: File): Promise<File> {
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1.5,            // Comprime a max 1.5 MB
      maxWidthOrHeight: 2048,    // Reduce si es más grande de 2048px
      useWebWorker: true,        // Más rápido sin bloquear UI
      fileType: "image/jpeg",    // Siempre JPG al final
      // Aplica EXIF orientation automáticamente
    });
    // imageCompression devuelve File con el nombre original mantenido
    return compressed instanceof File ? compressed : new File([compressed], file.name, { type: "image/jpeg" });
  } catch (e) {
    console.error("Error comprimiendo imagen:", e);
    // Si falla la compresión, devolver original
    return file;
  }
}

/**
 * Procesa una imagen completa: detecta HEIC, convierte y comprime.
 *
 * @param file Archivo de imagen del input/cámara
 * @returns File JPG listo para subir
 */
export async function procesarImagen(file: File): Promise<File> {
  // Solo procesa imágenes
  if (!file.type.startsWith("image/") && !esHeic(file)) {
    return file;
  }

  let processed = file;

  // Paso 1: si es HEIC, convertir a JPG
  if (esHeic(file)) {
    processed = await convertirHeicAJpg(file);
  }

  // Paso 2: comprimir y normalizar orientación
  processed = await comprimirImagen(processed);

  return processed;
}

/**
 * Procesa múltiples imágenes en paralelo.
 * Continúa aunque alguna falle (devuelve solo las exitosas con warning).
 */
export async function procesarImagenes(files: File[]): Promise<{
  exitosas: File[];
  fallidas: { file: File; error: string }[];
}> {
  const results = await Promise.allSettled(files.map(f => procesarImagen(f)));
  const exitosas: File[] = [];
  const fallidas: { file: File; error: string }[] = [];

  results.forEach((r, idx) => {
    if (r.status === "fulfilled") {
      exitosas.push(r.value);
    } else {
      fallidas.push({
        file: files[idx],
        error: r.reason?.message ?? "Error desconocido",
      });
    }
  });

  return { exitosas, fallidas };
}
