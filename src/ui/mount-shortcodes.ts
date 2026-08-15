/** 文章内短代码交互：折叠、剧透、tabs */

export function mountShortcodes(root: ParentNode | null = document): void {
  if (!root) return;

  root.querySelectorAll('.collapse-block-title').forEach((title) => {
    const el = title as HTMLElement;
    if (el.dataset.scBound === '1') return;
    el.dataset.scBound = '1';
    const toggle = () => {
      const block = el.closest('.collapse-block');
      const body = block?.querySelector('.collapse-block-body') as HTMLElement | null;
      if (!block || !body) return;
      const collapsed = block.classList.toggle('collapsed');
      body.hidden = collapsed;
    };
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        toggle();
      }
    });
  });

  root.querySelectorAll('.argon-hidden-text').forEach((node) => {
    const el = node as HTMLElement;
    if (el.dataset.scBound === '1') return;
    el.dataset.scBound = '1';
    el.addEventListener('click', () => el.classList.add('revealed'));
  });

  root.querySelectorAll<HTMLElement>('[data-ask-tabs]').forEach((tabs) => {
    if (tabs.dataset.scBound === '1') return;
    tabs.dataset.scBound = '1';
    const buttons = [...tabs.querySelectorAll<HTMLButtonElement>('[data-ask-tab]')];
    const panels = [...tabs.querySelectorAll<HTMLElement>('[data-ask-panel]')];
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.askTab;
        buttons.forEach((b) => {
          const on = b.dataset.askTab === id;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        panels.forEach((p) => {
          const on = p.dataset.askPanel === id;
          p.classList.toggle('is-active', on);
          p.hidden = !on;
        });
      });
    });
  });
}
