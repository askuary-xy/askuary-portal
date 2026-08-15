/** 轻量深空环境音（Web Audio 合成，默认静音，需用户开启） */

export interface AmbientAudioController {
  destroy: () => void;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function mountAmbientAudio(root: HTMLElement): AmbientAudioController {
  if (prefersReducedMotion()) return { destroy: () => {} };

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'fp-ambient-toggle';
  btn.setAttribute('aria-pressed', 'false');
  btn.setAttribute('aria-label', '开启深空环境音');
  btn.title = '深空环境音';
  btn.innerHTML = '<span aria-hidden="true">♪</span>';
  root.appendChild(btn);

  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let nodes: AudioNode[] = [];
  let enabled = false;
  let started = false;

  const stopGraph = (): void => {
    for (const n of nodes) {
      try {
        if ('stop' in n && typeof (n as OscillatorNode).stop === 'function') {
          (n as OscillatorNode).stop();
        }
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
    nodes = [];
    master = null;
    if (ctx) {
      void ctx.close().catch(() => {});
      ctx = null;
    }
    started = false;
  };

  const startGraph = async (): Promise<void> => {
    if (started) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    if (ctx.state === 'suspended') await ctx.resume();

    master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);

    // 粉噪近似：缓冲噪声 + 低通
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 280;
    noiseFilter.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.07;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start();
    nodes.push(noise, noiseFilter, noiseGain);

    // 两路极轻正弦垫音
    const tones = [55, 82.5];
    for (const freq of tones) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.02;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 420;
      osc.connect(f);
      f.connect(g);
      g.connect(master);
      osc.start();
      nodes.push(osc, f, g);
    }

    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.85, now + 2.2);
    started = true;
  };

  const setEnabled = async (on: boolean): Promise<void> => {
    enabled = on;
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? '关闭深空环境音' : '开启深空环境音');
    if (on) {
      await startGraph();
      if (ctx && master) {
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
        master.gain.exponentialRampToValueAtTime(0.85, t + 0.8);
      }
    } else if (ctx && master) {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
      master.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      window.setTimeout(() => {
        if (!enabled) stopGraph();
      }, 600);
    }
  };

  const onClick = (): void => {
    void setEnabled(!enabled);
  };
  btn.addEventListener('click', onClick);

  return {
    destroy: () => {
      btn.removeEventListener('click', onClick);
      stopGraph();
      btn.remove();
    },
  };
}
