let timer = 0;

export function showToast(message: string, durationMs = 2800): void {
  let root = document.getElementById('fpToast');
  if (!root) {
    root = document.createElement('div');
    root.id = 'fpToast';
    root.className = 'fp-toast';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
  }

  clearTimeout(timer);
  root.textContent = message;
  root.classList.add('is-visible');

  timer = window.setTimeout(() => {
    root?.classList.remove('is-visible');
  }, durationMs);
}
