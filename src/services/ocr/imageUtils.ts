export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Rotate image by degrees (e.g. 90, 180, 270)
export async function rotateImage(dataUrl: string, degrees: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context not available'));
        return;
      }

      const rad = (degrees * Math.PI) / 180;
      const is90or270 = Math.abs(degrees % 180) === 90;

      canvas.width = is90or270 ? img.height : img.width;
      canvas.height = is90or270 ? img.width : img.height;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image for rotation'));
    img.src = dataUrl;
  });
}

// Crop image according to CropRect
export async function cropImage(dataUrl: string, rect: CropRect): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context not available'));
        return;
      }

      const sw = Math.min(rect.width, img.width - rect.x);
      const sh = Math.min(rect.height, img.height - rect.y);

      canvas.width = Math.max(1, sw);
      canvas.height = Math.max(1, sh);

      ctx.drawImage(
        img,
        Math.max(0, rect.x),
        Math.max(0, rect.y),
        sw,
        sh,
        0,
        0,
        sw,
        sh
      );

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image for cropping'));
    img.src = dataUrl;
  });
}

// Enhance contrast for low-quality scanned documents
export async function enhanceImageContrast(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context not available'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Simple contrast stretch and binarization preparation
      for (let i = 0; i < data.length; i += 4) {
        // Luminance
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Contrast enhancement curve
        const factor = 1.3;
        const adjusted = Math.min(255, Math.max(0, factor * (gray - 128) + 128));

        data[i] = adjusted;     // R
        data[i + 1] = adjusted; // G
        data[i + 2] = adjusted; // B
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image for contrast enhancement'));
    img.src = dataUrl;
  });
}
