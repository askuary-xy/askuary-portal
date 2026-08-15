/** 评论区表情包（Unicode，无需外链资源） */

export type EmojiGroup = {
  id: string;
  label: string;
  items: string[];
};

export const COMMENT_EMOJI_GROUPS: EmojiGroup[] = [
  {
    id: 'face',
    label: '表情',
    items: [
      '😀', '😁', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰',
      '😘', '😜', '🤔', '🤨', '😐', '😏', '😴', '😭', '😤', '😡',
      '🤯', '🥳', '😎', '🤩', '🥺', '😢', '🤗', '🤭', '🫡', '🫠',
    ],
  },
  {
    id: 'hand',
    label: '手势',
    items: [
      '👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '🤟', '👊', '👋',
      '🫶', '❤️', '💔', '💯', '✨', '🔥', '⭐', '🌟', '💫', '🎉',
    ],
  },
  {
    id: 'life',
    label: '日常',
    items: [
      '☕', '🍵', '🍺', '🧋', '🍜', '🍣', '🍰', '🍓', '🌸', '🍀',
      '🌈', '☀️', '🌙', '☁️', '🌧️', '❄️', '📷', '🎵', '📚', '✈️',
    ],
  },
  {
    id: 'animal',
    label: '动物',
    items: [
      '🐱', '🐶', '🐰', '🐻', '🐼', '🦊', '🐯', '🦁', '🐷', '🐸',
      '🐵', '🦄', '🐝', '🦋', '🐙', '🐧', '🐦', '🐣', '🐲', '🦈',
    ],
  },
];

export function insertAtCursor(textarea: HTMLTextAreaElement, text: string): void {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? start;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  textarea.value = `${before}${text}${after}`;
  const next = start + text.length;
  textarea.focus();
  textarea.setSelectionRange(next, next);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

export function bindEmojiPicker(
  root: HTMLElement,
  textarea: HTMLTextAreaElement,
): void {
  const toggle = root.querySelector<HTMLButtonElement>('[data-emoji-toggle]');
  const panel = root.querySelector<HTMLElement>('[data-emoji-panel]');
  const tabs = root.querySelectorAll<HTMLButtonElement>('[data-emoji-tab]');
  const grids = root.querySelectorAll<HTMLElement>('[data-emoji-grid]');
  if (!toggle || !panel) return;

  const close = () => {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  };

  const open = () => {
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
  };

  toggle.addEventListener('click', (event) => {
    event.preventDefault();
    if (panel.hidden) open();
    else close();
  });

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.emojiTab || '';
      tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
      grids.forEach((grid) => {
        grid.hidden = grid.dataset.emojiGrid !== id;
      });
    });
  });

  panel.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest(
      '[data-emoji]',
    ) as HTMLButtonElement | null;
    if (!btn?.dataset.emoji) return;
    insertAtCursor(textarea, btn.dataset.emoji);
  });

  document.addEventListener('click', (event) => {
    const target = event.target as Node;
    if (!root.contains(target)) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
}

export function renderEmojiPickerHtml(): string {
  const tabs = COMMENT_EMOJI_GROUPS.map(
    (group, index) =>
      `<button type="button" class="fp-emoji-tab${index === 0 ? ' is-active' : ''}" data-emoji-tab="${group.id}">${group.label}</button>`,
  ).join('');

  const grids = COMMENT_EMOJI_GROUPS.map(
    (group, index) =>
      `<div class="fp-emoji-grid" data-emoji-grid="${group.id}" ${index === 0 ? '' : 'hidden'}>` +
      group.items
        .map(
          (emoji) =>
            `<button type="button" class="fp-emoji-item" data-emoji="${emoji}" aria-label="插入 ${emoji}">${emoji}</button>`,
        )
        .join('') +
      `</div>`,
  ).join('');

  return (
    `<div class="fp-emoji-picker">` +
    `<button type="button" class="fp-emoji-toggle" data-emoji-toggle aria-expanded="false" aria-label="表情包">😊 表情</button>` +
    `<div class="fp-emoji-panel" data-emoji-panel hidden>` +
    `<div class="fp-emoji-tabs">${tabs}</div>` +
    grids +
    `</div></div>`
  );
}
