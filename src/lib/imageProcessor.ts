import {
  FaceDetector,
  FilesetResolver,
  ImageSegmenter,
} from '@mediapipe/tasks-vision';

// 2x Retina resolution matching the 260x206 upper shield area of FutCard.tsx
const TARGET_WIDTH = 520;
const TARGET_HEIGHT = 412;

// Exact FUT Shield Inner Path in 260x370 card coordinates (from FutCard.tsx)
const FUT_SHIELD_INNER_PATH =
  'M 130 16 C 119 28, 103 30, 91 21 C 69 30, 46 47, 21 58 L 21 272 C 21 289, 29 300, 48 306 C 84 318, 112 331, 130 350 C 148 331, 176 318, 212 306 C 231 300, 239 289, 239 272 L 239 58 C 214 47, 191 30, 169 21 C 157 30, 141 28, 130 16 Z';

const WASM_CDN_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm';
const SEGMENTER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
const FACE_DETECTOR_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

let visionFilesetPromise: ReturnType<typeof FilesetResolver.forVisionTasks> | null =
  null;
let segmenterPromise: Promise<ImageSegmenter | null> | null = null;
let faceDetectorPromise: Promise<FaceDetector | null> | null = null;

function getVisionFileset() {
  if (!visionFilesetPromise) {
    visionFilesetPromise = FilesetResolver.forVisionTasks(WASM_CDN_URL);
  }
  return visionFilesetPromise;
}

/**
 * Lazily initializes the Google MediaPipe Selfie Segmenter (float16 model).
 * Runs 100% client-side via WebAssembly / WebGL with zero API cost.
 */
async function getPortraitSegmenter(): Promise<ImageSegmenter | null> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      try {
        const vision = await getVisionFileset();
        try {
          return await ImageSegmenter.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: SEGMENTER_MODEL_URL,
              delegate: 'GPU',
            },
            runningMode: 'IMAGE',
            outputCategoryMask: false,
            outputConfidenceMasks: true,
          });
        } catch {
          return await ImageSegmenter.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: SEGMENTER_MODEL_URL,
              delegate: 'CPU',
            },
            runningMode: 'IMAGE',
            outputCategoryMask: false,
            outputConfidenceMasks: true,
          });
        }
      } catch (err) {
        console.warn('MediaPipe Selfie Segmenter non disponibile, uso fallback:', err);
        return null;
      }
    })();
  }
  return segmenterPromise;
}

/**
 * Lazily initializes the Google MediaPipe BlazeFace Detector (short-range float16 model).
 * Runs 100% client-side via WebAssembly / WebGL with zero API cost.
 */
async function getLocalFaceDetector(): Promise<FaceDetector | null> {
  if (!faceDetectorPromise) {
    faceDetectorPromise = (async () => {
      try {
        const vision = await getVisionFileset();
        try {
          return await FaceDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: FACE_DETECTOR_MODEL_URL,
              delegate: 'GPU',
            },
            runningMode: 'IMAGE',
            minDetectionConfidence: 0.4,
          });
        } catch {
          return await FaceDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: FACE_DETECTOR_MODEL_URL,
              delegate: 'CPU',
            },
            runningMode: 'IMAGE',
            minDetectionConfidence: 0.4,
          });
        }
      } catch (err) {
        console.warn('MediaPipe FaceDetector non disponibile:', err);
        return null;
      }
    })();
  }
  return faceDetectorPromise;
}

interface DetectedEyesAndFace {
  eyesCenterX: number;
  eyesCenterY: number;
  eyeDistance: number;
}

/**
 * Detects the primary face and extracts the exact eye coordinates and inter-ocular distance
 * using client-side MediaPipe BlazeFace (with fallback to native FaceDetector).
 */
async function detectPrimaryEyes(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): Promise<DetectedEyesAndFace | null> {
  // 1. Try MediaPipe FaceDetector (BlazeFace with right eye = keypoints[0], left eye = keypoints[1])
  const detector = await getLocalFaceDetector();
  if (detector) {
    try {
      const res = detector.detect(canvas);
      if (res.detections && res.detections.length > 0) {
        const best = [...res.detections].sort((a, b) => {
          const areaA = (a.boundingBox?.width ?? 0) * (a.boundingBox?.height ?? 0);
          const areaB = (b.boundingBox?.width ?? 0) * (b.boundingBox?.height ?? 0);
          return areaB - areaA;
        })[0];

        if (best.keypoints && best.keypoints.length >= 2) {
          const rightEye = best.keypoints[0];
          const leftEye = best.keypoints[1];
          if (rightEye && leftEye) {
            const rx = rightEye.x * width;
            const ry = rightEye.y * height;
            const lx = leftEye.x * width;
            const ly = leftEye.y * height;
            const dist = Math.hypot(lx - rx, ly - ry);
            if (dist > 2) {
              return {
                eyesCenterX: (rx + lx) / 2,
                eyesCenterY: (ry + ly) / 2,
                eyeDistance: dist,
              };
            }
          }
        }

        if (best.boundingBox && best.boundingBox.width > 0 && best.boundingBox.height > 0) {
          const bb = best.boundingBox;
          return {
            eyesCenterX: bb.originX + bb.width * 0.5,
            eyesCenterY: bb.originY + bb.height * 0.38,
            eyeDistance: bb.width * 0.38,
          };
        }
      }
    } catch (err) {
      console.warn('Face detection warning:', err);
    }
  }

  // 2. Try native browser Shape Detection API (window.FaceDetector) if available
  const win = window as unknown as {
    FaceDetector?: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
      detect: (
        source: HTMLCanvasElement
      ) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
    };
  };
  if (typeof win.FaceDetector === 'function') {
    try {
      const nativeDetector = new win.FaceDetector({
        fastMode: true,
        maxDetectedFaces: 3,
      });
      const faces = await nativeDetector.detect(canvas);
      if (faces && faces.length > 0) {
        const best = [...faces].sort(
          (a, b) =>
            b.boundingBox.width * b.boundingBox.height -
            a.boundingBox.width * a.boundingBox.height
        )[0].boundingBox;
        return {
          eyesCenterX: best.x + best.width * 0.5,
          eyesCenterY: best.y + best.height * 0.38,
          eyeDistance: best.width * 0.38,
        };
      }
    } catch {
      // Ignore native FaceDetector errors
    }
  }

  return null;
}

/**
 * Applies a 3x3 spatial feathering pass on an alpha mask [0..1] for smooth hair/shoulder edges.
 */
function featherAlphaMask(
  mask: Float32Array,
  width: number,
  height: number
): Float32Array {
  const out = new Float32Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let weightSum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const w = dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1;
          sum += mask[ny * width + nx] * w;
          weightSum += w;
        }
      }
      out[y * width + x] = sum / weightSum;
    }
  }
  return out;
}

/**
 * Fallback border-sampled background removal when WebAssembly/WebGL model is unreachable.
 */
function applyBorderFallbackMask(
  imgData: ImageData,
  width: number,
  height: number
): Float32Array {
  const data = imgData.data;
  const mask = new Float32Array(width * height).fill(1);

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;

  const samplePixel = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    if (data[idx + 3] < 128) return;
    rSum += data[idx];
    gSum += data[idx + 1];
    bSum += data[idx + 2];
    count++;
  };

  for (let x = 0; x < width; x += 4) {
    samplePixel(x, 2);
    samplePixel(x, 8);
  }
  for (let y = 0; y < Math.floor(height * 0.65); y += 4) {
    samplePixel(2, y);
    samplePixel(width - 3, y);
  }

  if (count === 0) return mask;
  const bgR = rSum / count;
  const bgG = gSum / count;
  const bgB = bSum / count;

  const tolerance = 46;
  const softRange = 24;

  for (let y = 0; y < height; y++) {
    const ny = y / height;
    for (let x = 0; x < width; x++) {
      const nx = (x / width - 0.5) * 2;
      const centerDist = Math.sqrt(nx * nx * 1.15 + Math.pow(ny - 0.52, 2) * 1.8);
      if (centerDist < 0.36) {
        mask[y * width + x] = 1;
        continue;
      }

      const idx = (y * width + x) * 4;
      const dr = data[idx] - bgR;
      const dg = data[idx + 1] - bgG;
      const db = data[idx + 2] - bgB;
      const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);

      if (colorDist < tolerance) {
        mask[y * width + x] = 0;
      } else if (colorDist < tolerance + softRange) {
        const t = (colorDist - tolerance) / softRange;
        mask[y * width + x] = t * t * (3 - 2 * t);
      } else {
        mask[y * width + x] = 1;
      }
    }
  }

  return featherAlphaMask(mask, width, height);
}

/**
 * Standard upload optimizer for player photos:
 * Keeps the original image proportions and full framing as-is for general profile/backoffice use,
 * only downscaling to a Firestore-safe max dimension (560px).
 */
export async function preprocessPlayerPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Seleziona un file immagine valido (JPG, PNG, WebP).');
  }

  const dataUrlInput = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Errore nella lettura del file.'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onerror = () => reject(new Error('Impossibile elaborare l’immagine selezionata.'));
    el.onload = () => resolve(el);
    el.src = dataUrlInput;
  });

  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  const maxDim = 560;
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const outW = Math.max(1, Math.round(srcW * scale));
  const outH = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context non disponibile.');
  }

  ctx.clearRect(0, 0, outW, outH);
  ctx.drawImage(img, 0, 0, outW, outH);

  let outputDataUrl = canvas.toDataURL('image/webp', 0.86);
  if (!outputDataUrl.startsWith('data:image/webp')) {
    outputDataUrl = canvas.toDataURL('image/jpeg', 0.86);
  }

  return outputDataUrl;
}

// In-memory cache so each player's FUT Card cutout is computed only once per avatar URL
const futCutoutCache = new Map<string, Promise<string>>();

/**
 * Dedicated preprocessing exclusively for the FUT Card (`FutCard.tsx`):
 * 1. Removes the background (MediaPipe Selfie Segmenter)
 * 2. Detects the eyes (MediaPipe BlazeFace keypoints)
 * 3. Scales the portrait so the distance between the eyes is 1/6 of the width of the card
 * 4. Aligns the eyes vertically at 60% from the bottom of the top half of the card
 *    (between y = 8 highest point of the card and y = 204 line below the name -> y = 86.4 in 1x)
 * 5. Centers the face horizontally at 2/3 of the card width from the left border
 * 6. Clips along the FUT Card Shield borders (FUT_SHIELD_INNER_PATH)
 */
export function renderFutCardCutout(avatarUrl: string): Promise<string> {
  if (!avatarUrl) return Promise.resolve('');
  const cached = futCutoutCache.get(avatarUrl);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onerror = () => reject(new Error('Errore caricamento avatar FUT.'));
        el.onload = () => resolve(el);
        el.src = avatarUrl;
      });

      const srcW = img.naturalWidth || img.width;
      const srcH = img.naturalHeight || img.height;

      const maxWorkDim = 768;
      const workScale = Math.min(1, maxWorkDim / Math.max(srcW, srcH));
      const workW = Math.max(1, Math.round(srcW * workScale));
      const workH = Math.max(1, Math.round(srcH * workScale));

      const workCanvas = document.createElement('canvas');
      workCanvas.width = workW;
      workCanvas.height = workH;
      const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });
      if (!workCtx) return avatarUrl;

      workCtx.clearRect(0, 0, workW, workH);
      workCtx.drawImage(img, 0, 0, workW, workH);

      // 1. Detect eyes on workCanvas
      const detectedEyes = await detectPrimaryEyes(workCanvas, workW, workH);

      // 2. Run AI Portrait Segmentation on the full image
      let alphaMask: Float32Array | null = null;
      const segmenter = await getPortraitSegmenter();

      if (segmenter) {
        try {
          const segResult = segmenter.segment(workCanvas);
          const masks = segResult.confidenceMasks;
          if (masks && masks.length > 0) {
            const personMaskObj = masks.length > 1 ? masks[1] : masks[0];
            const rawFloats = personMaskObj.getAsFloat32Array();
            const processedMask = new Float32Array(workW * workH);
            let foregroundCount = 0;

            const lowThresh = 0.25;
            const highThresh = 0.72;

            for (let i = 0; i < rawFloats.length; i++) {
              const conf = rawFloats[i];
              if (conf >= 0.5) foregroundCount++;
              const t = Math.max(
                0,
                Math.min(1, (conf - lowThresh) / (highThresh - lowThresh))
              );
              processedMask[i] = t * t * (3 - 2 * t);
            }

            if (foregroundCount > workW * workH * 0.03) {
              alphaMask = featherAlphaMask(processedMask, workW, workH);
            }
          }
          segResult.close();
        } catch (segErr) {
          console.warn('Errore durante la segmentazione ritratto FUT:', segErr);
        }
      }

      // Re-draw workCanvas with subtle FUT studio grading
      workCtx.clearRect(0, 0, workW, workH);
      workCtx.save();
      if ('filter' in workCtx) {
        workCtx.filter = 'contrast(1.06) saturate(1.06) brightness(1.02)';
      }
      workCtx.drawImage(img, 0, 0, workW, workH);
      workCtx.restore();

      const workFrame = workCtx.getImageData(0, 0, workW, workH);
      const workPixels = workFrame.data;

      if (!alphaMask) {
        alphaMask = applyBorderFallbackMask(workFrame, workW, workH);
      }

      let subjMinX = workW;
      let subjMaxX = 0;
      let subjMinY = workH;
      let subjMaxY = 0;
      let fgCount = 0;

      for (let y = 0; y < workH; y++) {
        for (let x = 0; x < workW; x++) {
          const a = alphaMask[y * workW + x];
          if (a > 0.35) {
            if (x < subjMinX) subjMinX = x;
            if (x > subjMaxX) subjMaxX = x;
            if (y < subjMinY) subjMinY = y;
            if (y > subjMaxY) subjMaxY = y;
            fgCount++;
          }
        }
      }

      if (fgCount < 100 || subjMaxY <= subjMinY || subjMaxX <= subjMinX) {
        subjMinX = 0;
        subjMaxX = workW - 1;
        subjMinY = 0;
        subjMaxY = workH - 1;
      }

      for (let i = 0; i < workW * workH; i++) {
        const pIdx = i * 4;
        workPixels[pIdx + 3] = Math.round(
          (workPixels[pIdx + 3] / 255) * alphaMask[i] * 255
        );
      }
      workCtx.putImageData(workFrame, 0, 0);

      // 3. Determine eyes center and inter-ocular distance
      let eyesCenterX: number;
      let eyesCenterY: number;
      let eyeDistance: number;

      if (detectedEyes) {
        eyesCenterX = detectedEyes.eyesCenterX;
        eyesCenterY = detectedEyes.eyesCenterY;
        eyeDistance = detectedEyes.eyeDistance;
      } else {
        // Fallback estimation from segmented head region
        const subjH = Math.max(24, subjMaxY - subjMinY);
        const estHeadW = Math.max(20, subjH * 0.28);
        eyesCenterX = (subjMinX + subjMaxX) / 2;
        eyesCenterY = subjMinY + subjH * 0.16;
        eyeDistance = estHeadW * 0.42;
      }

      // 4. Exact Eye-Based Geometric Formula on the 2x FUT Upper Card Canvas (520x412, 2x of 260x206):
      // - Card width: targetW = 520 (2x of 260)
      // - Top half of card: from highest point of card (y = 8 in 1x -> 16 in 2x)
      //   to line below the name (y = 204 in 1x -> 408 in 2x)
      // - Distance between the eyes = 1/8 of the width of the card
      // - Eyes vertically aligned at 60% from the bottom of the top half:
      //   y_1x = 204 - 0.60 * (204 - 8) = 86.4 -> y_2x = 172.8
      // - Face centered horizontally at 3/5 of the card from the left border:
      //   x_2x = (3 / 5) * targetW
      const targetW = TARGET_WIDTH; // 520 (2x of 260)
      const targetH = TARGET_HEIGHT; // 412 (2x of 206)

      const targetEyeDistance = targetW / 8;
      const scale = targetEyeDistance / Math.max(4, eyeDistance);

      const highestPointY = 8 * 2; // 16px in 2x
      const nameDividerLineY = 204 * 2; // 408px in 2x
      const targetEyesY =
        nameDividerLineY - 0.60 * (nameDividerLineY - highestPointY); // 172.8px in 2x
      const targetEyesX = (3 / 5) * targetW; // 312px in 2x

      const dstW = workW * scale;
      const dstH = workH * scale;
      const dx = targetEyesX - eyesCenterX * scale;
      const dy = targetEyesY - eyesCenterY * scale;

      const outCanvas = document.createElement('canvas');
      outCanvas.width = targetW;
      outCanvas.height = targetH;
      const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
      if (!outCtx) return avatarUrl;

      outCtx.clearRect(0, 0, targetW, targetH);

      // 5. Clip strictly along the FUT Card Shield inner border (FUT_SHIELD_INNER_PATH)
      outCtx.save();
      outCtx.scale(2, 2);
      if (typeof Path2D !== 'undefined') {
        const shieldClip = new Path2D(FUT_SHIELD_INNER_PATH);
        outCtx.clip(shieldClip);
      }
      outCtx.scale(0.5, 0.5);
      outCtx.drawImage(workCanvas, 0, 0, workW, workH, dx, dy, dstW, dstH);
      outCtx.restore();

      // 6. Smooth bottom fade into the line below the name
      const finalFrame = outCtx.getImageData(0, 0, targetW, targetH);
      const finalPixels = finalFrame.data;
      const fadeStartY = Math.floor(targetH * 0.88);
      for (let y = fadeStartY; y < targetH; y++) {
        const bottomFade = Math.max(0, (targetH - y) / (targetH - fadeStartY));
        for (let x = 0; x < targetW; x++) {
          const pIdx = (y * targetW + x) * 4;
          finalPixels[pIdx + 3] = Math.round(finalPixels[pIdx + 3] * bottomFade);
        }
      }
      outCtx.putImageData(finalFrame, 0, 0);

      let outputDataUrl = outCanvas.toDataURL('image/webp', 0.88);
      if (!outputDataUrl.startsWith('data:image/webp')) {
        outputDataUrl = outCanvas.toDataURL('image/png');
      }

      return outputDataUrl;
    } catch (err) {
      console.warn('Fallback to raw avatarUrl in FUT card:', err);
      return avatarUrl;
    }
  })();

  futCutoutCache.set(avatarUrl, promise);
  return promise;
}



