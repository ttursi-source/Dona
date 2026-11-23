export interface ProcessedJpeg {
  dataUrl: string;
  base64: string;
}

export async function fileToJpeg(file: Blob, maxSide: number, quality: number): Promise<ProcessedJpeg> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = bitmap;
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("No se pudo inicializar el canvas para procesar la imagen.");
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const commaIdx = dataUrl.indexOf(",");
    const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
    return { dataUrl, base64 };
  } finally {
    bitmap.close();
  }
}
