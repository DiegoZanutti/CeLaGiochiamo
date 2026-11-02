/**
 * Client-side photo preprocessing pipeline for Player Profiles & FUT Cards.
 * - Smart upper-center portrait crop (4:5 aspect ratio focused on head & shoulders)
 * - Resize to 280x350px for fast Firestore sync
 * - Subtle contrast/saturation enhancement & studio vignette
 */
export async function preprocessPlayerPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Seleziona un file immagine valido (JPG, PNG, WebP).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Errore nella lettura del file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Impossibile elaborare l’immagine selezionata.'));
      img.onload = () => {
        try {
          const targetW = 280;
          const targetH = 350;
          const targetRatio = targetW / targetH; // 0.8 (4:5 portrait)

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context non disponibile.'));
            return;
          }

          // Compute smart portrait crop (biased toward upper third for head & shoulders)
          const srcW = img.naturalWidth || img.width;
          const srcH = img.naturalHeight || img.height;
          const srcRatio = srcW / srcH;

          let cropW = srcW;
          let cropH = srcH;
          let sx = 0;
          let sy = 0;

          if (srcRatio > targetRatio) {
            // Image is wider than 4:5 -> crop left/right equally
            cropW = srcH * targetRatio;
            sx = (srcW - cropW) / 2;
          } else {
            // Image is taller than 4:5 -> crop top/bottom with top bias (15% from top)
            cropH = srcW / targetRatio;
            sy = Math.max(0, (srcH - cropH) * 0.15);
          }

          ctx.clearRect(0, 0, targetW, targetH);

          // Apply subtle FUT studio grading (crisp contrast & vibrant color)
          ctx.save();
          if ('filter' in ctx) {
            ctx.filter = 'contrast(1.08) saturate(1.08) brightness(1.02)';
          }
          ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, targetW, targetH);
          ctx.restore();

          // Subtle edge vignette to blend smoothly into the FUT card crest
          const radGrad = ctx.createRadialGradient(
            targetW * 0.5,
            targetH * 0.42,
            targetW * 0.28,
            targetW * 0.5,
            targetH * 0.45,
            targetH * 0.68
          );
          radGrad.addColorStop(0, 'rgba(0,0,0,0)');
          radGrad.addColorStop(0.75, 'rgba(0,0,0,0.04)');
          radGrad.addColorStop(1, 'rgba(0,0,0,0.22)');
          ctx.fillStyle = radGrad;
          ctx.fillRect(0, 0, targetW, targetH);

          // Export compressed WebP (or JPEG fallback)
          let dataUrl = canvas.toDataURL('image/webp', 0.82);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          }
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
