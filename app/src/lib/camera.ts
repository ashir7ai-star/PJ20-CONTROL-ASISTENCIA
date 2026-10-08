/**
 * Live front-camera selfie (CLAUDE.md §2B.6): the image always comes from the
 * camera stream at the moment of marking — there is no file input, so the
 * gallery can never be used.
 */

export type CameraError = 'permission-denied' | 'unavailable';

export class CameraFailure extends Error {
  constructor(readonly reason: CameraError) {
    super(reason);
    this.name = 'CameraFailure';
  }
}

/** Longest side of the uploaded photo: enough to see face and place, light on 3G. */
const MAX_SIDE_PX = 1280;
const JPEG_QUALITY = 0.8;

export async function openFrontCamera(): Promise<MediaStream> {
  // Absent outside HTTPS or on very old browsers (the DOM types assume it exists).
  if (!('mediaDevices' in navigator)) throw new CameraFailure('unavailable');
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
    });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    throw new CameraFailure(
      name === 'NotAllowedError' || name === 'SecurityError' ? 'permission-denied' : 'unavailable',
    );
  }
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}

/**
 * Current video frame as a JPEG (base64, no data: prefix), scaled down so the
 * longest side is at most 1280 px. Not mirrored: the admin sees the real scene.
 */
export async function captureFrame(video: HTMLVideoElement): Promise<string> {
  const { videoWidth: width, videoHeight: height } = video;
  if (!width || !height) throw new CameraFailure('unavailable');
  const scale = Math.min(1, MAX_SIDE_PX / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new CameraFailure('unavailable');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
  });
  if (!blob) throw new CameraFailure('unavailable');
  return toBase64(new Uint8Array(await blob.arrayBuffer()));
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
