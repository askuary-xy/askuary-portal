/** 轻量打字机效果 */
export function mountTypewriter(
  el: HTMLElement,
  lines: string[],
  options: { speed?: number; pause?: number; loop?: boolean } = {},
): () => void {
  const speed = options.speed ?? 58;
  const pause = options.pause ?? 2200;
  const loop = options.loop ?? true;
  let lineIndex = 0;
  let charIndex = 0;
  let deleting = false;
  let timer = 0;
  let stopped = false;

  el.classList.add('fp-typewriter');
  el.innerHTML = '<span class="fp-typewriter-text"></span><span class="fp-typewriter-cursor" aria-hidden="true">|</span>';
  const textEl = el.querySelector('.fp-typewriter-text')!;

  const tick = (): void => {
    if (stopped || !lines.length) return;
    const line = lines[lineIndex] ?? '';

    if (!deleting) {
      charIndex += 1;
      textEl.textContent = line.slice(0, charIndex);
      if (charIndex >= line.length) {
        timer = window.setTimeout(() => {
          deleting = true;
          tick();
        }, pause);
        return;
      }
      timer = window.setTimeout(tick, speed);
      return;
    }

    charIndex -= 1;
    textEl.textContent = line.slice(0, charIndex);
    if (charIndex <= 0) {
      deleting = false;
      lineIndex = loop ? (lineIndex + 1) % lines.length : Math.min(lineIndex + 1, lines.length - 1);
      if (!loop && lineIndex >= lines.length - 1 && charIndex <= 0) return;
      timer = window.setTimeout(tick, speed * 0.55);
      return;
    }
    timer = window.setTimeout(tick, speed * 0.38);
  };

  tick();

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
