'use client';

interface RecordButtonProps {
  isRecording: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export default function RecordButton({ isRecording, onPress, disabled }: RecordButtonProps) {
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      className={`relative flex h-20 w-20 items-center justify-center rounded-full transition-all active:scale-95 ${
        disabled ? 'opacity-50' : ''
      } ${isRecording ? 'recording-pulse' : ''}`}
      aria-label={isRecording ? 'Parar grabacion' : 'Grabar tiro'}
    >
      {/* Outer ring */}
      <span
        className={`absolute inset-0 rounded-full border-4 ${
          isRecording ? 'border-danger' : 'border-white'
        }`}
      />
      {/* Inner shape */}
      <span
        className={`transition-all ${
          isRecording
            ? 'h-7 w-7 rounded-md bg-danger'
            : 'h-16 w-16 rounded-full bg-danger'
        }`}
      />
    </button>
  );
}
