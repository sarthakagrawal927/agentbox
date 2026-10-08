// Local, short cues. No files, network, background loop or context until played.
type SoundState = { expanded: boolean; ready?: boolean; soundEnabled?: boolean; noticeSequence?: number };
export function soundForTransition(previous: SoundState | null, next: SoundState): 'drop' | 'whoosh' | null {
  if (!previous || previous.ready === false || !next.soundEnabled) return null;
  if (!previous.soundEnabled) return 'drop';
  if ((next.noticeSequence ?? 0) > (previous.noticeSequence ?? 0)) return 'drop';
  return previous.expanded !== next.expanded ? 'whoosh' : null;
}

export function createCompanionAudio(factory: () => AudioContext = () => new AudioContext()) {
  let context: AudioContext | null = null, disposed = false, busy = false;
  let stop: (() => void) | null = null;
  return {
    async play(kind: 'drop' | 'whoosh'): Promise<boolean> {
      if (disposed || busy) return false;
      busy = true;
      const nodes: AudioNode[] = [];
      try {
        context ??= factory();
        await context.resume();
        if (disposed) return false;
        const ctx = context, start = ctx.currentTime, gain = ctx.createGain();
        nodes.push(gain);
        gain.connect(ctx.destination);
        let source: AudioBufferSourceNode | OscillatorNode;
        if (kind === 'whoosh') {
          const duration = .24, buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
          const samples = buffer.getChannelData(0); let seed = 211;
          for (let i = 0; i < samples.length; i++) {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            samples[i] = (seed / 2 ** 32 * 2 - 1);
          }
          const noise = ctx.createBufferSource(); nodes.push(noise);
          const filter = ctx.createBiquadFilter(); nodes.push(filter);
          noise.buffer = buffer; filter.type = 'bandpass'; filter.Q.value = .45;
          filter.frequency.setValueAtTime(850, start);
          filter.frequency.exponentialRampToValueAtTime(220, start + duration);
          noise.connect(filter); filter.connect(gain); source = noise;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(.1, start + .055);
          gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
        } else {
          const oscillator = ctx.createOscillator(); oscillator.type = 'sine';
          nodes.push(oscillator);
          oscillator.frequency.setValueAtTime(1250, start);
          oscillator.frequency.exponentialRampToValueAtTime(560, start + .09);
          oscillator.connect(gain); source = oscillator;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(.055, start + .007);
          gain.gain.exponentialRampToValueAtTime(.0001, start + .22);
        }
        let ended = false;
        const cleanup = () => {
          if (ended) return; ended = true;
          for (const node of nodes) { try { node.disconnect(); } catch { /* Output was lost. */ } }
          busy = false; stop = null;
        };
        stop = () => { try { source.stop(); } catch { /* Already ended. */ } cleanup(); };
        source.onended = cleanup;
        source.start(start); source.stop(start + .24);
        return true;
      } catch {
        busy = false;
        if (stop) stop();
        else for (const node of nodes) { try { node.disconnect(); } catch { /* Output was lost. */ } }
        return false;
      }
    },
    dispose() {
      if (disposed) return; disposed = true;
      stop?.();
      if (context) void context.close().catch(() => {});
    },
  };
}
