export interface CameraConfig {
  facingMode: 'environment' | 'user';
  width: number;
  height: number;
}

const DEFAULT_CONFIG: CameraConfig = {
  facingMode: 'environment',
  width: 1280,
  height: 720,
};

export function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export async function requestCamera(
  config: Partial<CameraConfig> = {}
): Promise<MediaStream> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const constraints: MediaStreamConstraints = {
    video: {
      facingMode: { ideal: cfg.facingMode },
      width: { ideal: cfg.width },
      height: { ideal: cfg.height },
      frameRate: { ideal: 30 },
    },
    audio: false,
  };
  return navigator.mediaDevices.getUserMedia(constraints);
}

export function stopStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

export function createRecorder(
  stream: MediaStream,
  onDataAvailable: (blob: Blob) => void,
  onStop: () => void
): MediaRecorder {
  const mimeType = getSupportedMimeType();
  const recorder = new MediaRecorder(stream, {
    mimeType: mimeType || undefined,
    videoBitsPerSecond: 2_500_000,
  });

  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
    onDataAvailable(blob);
    onStop();
  };

  return recorder;
}

export function getVideoExtension(): string {
  const mimeType = getSupportedMimeType();
  if (mimeType.includes('mp4')) return 'mp4';
  return 'webm';
}
