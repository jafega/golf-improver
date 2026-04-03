// Golf sound effects using Web Audio API (no external files needed)

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  // Resume if suspended (mobile browsers require user gesture)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Golf club impact sound - sharp "thwack" with a metallic ring
 * Simulates the sound of a club hitting a golf ball
 */
export function playGolfHitSound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // === Layer 1: Initial sharp impact (the "crack") ===
    const impactOsc = ctx.createOscillator();
    const impactGain = ctx.createGain();
    impactOsc.type = 'square';
    impactOsc.frequency.setValueAtTime(800, now);
    impactOsc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
    impactGain.gain.setValueAtTime(0.4, now);
    impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    impactOsc.connect(impactGain);
    impactGain.connect(ctx.destination);
    impactOsc.start(now);
    impactOsc.stop(now + 0.1);

    // === Layer 2: Metallic ping (the "ting" of the club face) ===
    const pingOsc = ctx.createOscillator();
    const pingGain = ctx.createGain();
    pingOsc.type = 'sine';
    pingOsc.frequency.setValueAtTime(3200, now);
    pingOsc.frequency.exponentialRampToValueAtTime(2400, now + 0.15);
    pingGain.gain.setValueAtTime(0.15, now);
    pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    pingOsc.connect(pingGain);
    pingGain.connect(ctx.destination);
    pingOsc.start(now);
    pingOsc.stop(now + 0.2);

    // === Layer 3: Low thud (body of the impact) ===
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(150, now);
    thudOsc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
    thudGain.gain.setValueAtTime(0.3, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    thudOsc.connect(thudGain);
    thudGain.connect(ctx.destination);
    thudOsc.start(now);
    thudOsc.stop(now + 0.15);

    // === Layer 4: Noise burst (the "whoosh" texture) ===
    const bufferSize = ctx.sampleRate * 0.08;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const noiseSource = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    noiseSource.buffer = noiseBuffer;
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(2000, now);
    noiseFilter.Q.setValueAtTime(1, now);
    noiseGain.gain.setValueAtTime(0.25, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSource.start(now);

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate([15, 30, 15]);
    }
  } catch (e) {
    console.warn('Could not play golf hit sound:', e);
  }
}

/**
 * New personal record celebration sound - ascending chime
 */
export function playRecordSound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.2, now + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.3);
    });

    if (navigator.vibrate) {
      navigator.vibrate([50, 50, 50, 50, 100]);
    }
  } catch (e) {
    console.warn('Could not play record sound:', e);
  }
}

/**
 * "Ready" detection sound - short friendly double-beep
 * Plays when ball + club are detected in frame
 */
export function playReadySound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Two short ascending beeps
    [880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.12 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.12);
    });

    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
  } catch (e) {
    console.warn('Could not play ready sound:', e);
  }
}

/**
 * Speak "Ready" using text-to-speech
 */
export function speakReady(): void {
  try {
    if (!('speechSynthesis' in window)) return;
    // Don't interrupt ongoing speech
    if (window.speechSynthesis.speaking) return;

    const utterance = new SpeechSynthesisUtterance('Ready');
    utterance.lang = 'en-US';
    utterance.rate = 1.1;
    utterance.pitch = 1.2;
    utterance.volume = 0.8;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore
  }
}

/**
 * Warm up audio context on first user interaction
 * Call this on a button press to unlock audio on mobile
 */
export function warmUpAudio(): void {
  try {
    const ctx = getAudioContext();
    // Create a silent buffer to unlock audio
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // Ignore
  }
}
