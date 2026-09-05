import { useSettingsStore } from './settings';

// Lazy initialize AudioContext to comply with browser autoplay policies
let audioCtx: AudioContext | null = null;

const getContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

// --- Startup Chime ---
export const playStartupChime = () => {
  if (useSettingsStore.getState().systemMuted) return;
  
  const ctx = getContext();
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const osc3 = ctx.createOscillator();
  const gain = ctx.createGain();

  // A nice bright major chord (C Major: C5, E5, G5)
  osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
  osc2.frequency.setValueAtTime(659.25, ctx.currentTime);
  osc3.frequency.setValueAtTime(783.99, ctx.currentTime);
  
  osc1.type = 'sine';
  osc2.type = 'triangle';
  osc3.type = 'sine';

  // Envelope
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);

  osc1.connect(gain);
  osc2.connect(gain);
  osc3.connect(gain);
  gain.connect(ctx.destination);

  osc1.start();
  osc2.start();
  osc3.start();
  
  osc1.stop(ctx.currentTime + 1.5);
  osc2.stop(ctx.currentTime + 1.5);
  osc3.stop(ctx.currentTime + 1.5);
};

// --- Notification Sound ---
export const playNotificationSound = () => {
  if (useSettingsStore.getState().systemMuted) return;

  const ctx = getContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Short, crisp high-pitched pluck
  osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
  osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
  osc.type = 'sine';

  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.3);
};

// --- Error Bzzzt ---
export const playErrorSound = () => {
  if (useSettingsStore.getState().systemMuted) return;

  const ctx = getContext();
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  // Dissonant low frequencies
  osc1.frequency.setValueAtTime(150, ctx.currentTime);
  osc2.frequency.setValueAtTime(156, ctx.currentTime);
  
  osc1.type = 'square';
  osc2.type = 'sawtooth';

  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
  gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.1);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start();
  osc2.start();
  
  osc1.stop(ctx.currentTime + 0.2);
  osc2.stop(ctx.currentTime + 0.2);
};
