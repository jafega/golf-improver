let speaking = false;

export function speakTips(tips: string[], rating?: number): void {
  if (!('speechSynthesis' in window) || tips.length === 0) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  speaking = true;

  const parts: string[] = [];

  if (rating != null) {
    parts.push(`Puntuación: ${rating} de 10.`);
  }

  parts.push('Consejos de mejora:');
  tips.forEach((tip, i) => {
    parts.push(`${i + 1}. ${tip}`);
  });

  const text = parts.join(' ');
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-ES';
  utterance.rate = 1.05;
  utterance.pitch = 1;

  // Try to pick a Spanish voice
  const voices = window.speechSynthesis.getVoices();
  const spanishVoice = voices.find(
    (v) => v.lang.startsWith('es') && v.localService
  ) ?? voices.find((v) => v.lang.startsWith('es'));
  if (spanishVoice) utterance.voice = spanishVoice;

  utterance.onend = () => { speaking = false; };
  utterance.onerror = () => { speaking = false; };

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    speaking = false;
  }
}

export function isSpeaking(): boolean {
  return speaking;
}
