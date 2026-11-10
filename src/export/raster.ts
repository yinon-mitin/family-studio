import { t } from '../i18n/index.ts';

/** Rasterises an SVG string into a PNG of the given pixel size (browser only). */
export async function svgToPng(svg: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(t('export.pngCanvas'));
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(t('export.pngBlob')))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
