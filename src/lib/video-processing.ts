export interface ExtractedFrame {
  dataUrl: string;
  timestamp: number;
  label: string;
}

export async function extractFrames(
  videoBlob: Blob,
  frameCount: number = 5
): Promise<ExtractedFrame[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(videoBlob);
    video.src = url;

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      if (duration <= 0 || !isFinite(duration)) {
        URL.revokeObjectURL(url);
        reject(new Error('Invalid video duration'));
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      // Scale down for API efficiency
      const scale = Math.min(1, 720 / video.videoWidth);
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;

      const frames: ExtractedFrame[] = [];
      const labels = getFrameLabels(frameCount);

      for (let i = 0; i < frameCount; i++) {
        const time = (duration * i) / (frameCount - 1);
        try {
          await seekTo(video, time);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          frames.push({
            dataUrl,
            timestamp: time,
            label: labels[i] || `Frame ${i + 1}`,
          });
        } catch (e) {
          console.warn(`Failed to extract frame at ${time}s`, e);
        }
      }

      URL.revokeObjectURL(url);
      resolve(frames);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video'));
    };
  });
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    video.currentTime = time;
    video.onseeked = () => resolve();
  });
}

function getFrameLabels(count: number): string[] {
  if (count === 5) {
    return ['Posicion inicial', 'Backswing', 'Impacto', 'Follow-through', 'Vuelo de bola'];
  }
  if (count === 4) {
    return ['Posicion inicial', 'Backswing', 'Impacto', 'Follow-through'];
  }
  return Array.from({ length: count }, (_, i) => `Frame ${i + 1}`);
}

export async function generateThumbnail(videoBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(videoBlob);
    video.src = url;

    video.onloadedmetadata = () => {
      // Seek to 40% of the video (roughly impact frame)
      video.currentTime = video.duration * 0.4;
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 320 / video.videoWidth);
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to generate thumbnail'));
    };
  });
}
