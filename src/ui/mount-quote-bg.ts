import '../styles/quote-bg.css';
import { escapeHtml } from '../pages/home/shared';

const DEFAULT_QUOTES = [
  '自信人生二百年，会当水击三千里。 —— 毛泽东',
  '俱往矣，数风流人物，还看今朝。 —— 毛泽东',
  '雄关漫道真如铁，而今迈步从头越。 —— 毛泽东',
  '世上无难事，只要肯登攀。 —— 毛泽东',
  '天若有情天亦老，人间正道是沧桑。 —— 毛泽东',
  '长风破浪会有时，直挂云帆济沧海。 —— 李白',
  '会当凌绝顶，一览众山小。 —— 杜甫',
  '千磨万击还坚劲，任尔东西南北风。 —— 郑燮',
  '宝剑锋从磨砺出，梅花香自苦寒来。',
  '路漫漫其修远兮，吾将上下而求索。 —— 屈原',
  '不积跬步，无以至千里。 —— 荀子',
  '穷且益坚，不坠青云之志。 —— 王勃',
  '山重水复疑无路，柳暗花明又一村。 —— 陆游',
  '人生自古谁无死，留取丹心照汗青。 —— 文天祥',
  '少年易老学难成，一寸光阴不可轻。 —— 朱熹',
  '纸上得来终觉浅，绝知此事要躬行。 —— 陆游',
  '落红不是无情物，化作春泥更护花。 —— 龚自珍',
  '海内存知己，天涯若比邻。 —— 王勃',
  '欲穷千里目，更上一层楼。 —— 王之涣',
  '莫听穿林打叶声，何妨吟啸且徐行。 —— 苏轼',
  '竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。 —— 苏轼',
  '愿你眼里有光，心中有爱，脚下有路。',
  '星光不问赶路人，时光不负有心人。',
  '凡是过往，皆为序章。',
  '心有丘壑，目有星辰。',
];

/** XingHui 感：背景多列缓慢滚动的透明励志字（列距拉开，避免重叠） */
export function mountQuoteBackground(quotes?: string[]): void {
  document.getElementById('quoteBg')?.remove();
  const lines = (quotes || [])
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  const pool = lines.length >= 8 ? lines : [...lines, ...DEFAULT_QUOTES];

  const root = document.createElement('div');
  root.id = 'quoteBg';
  root.className = 'quote-bg';
  root.setAttribute('aria-hidden', 'true');

  const cols = 4;
  for (let c = 0; c < cols; c++) {
    const col = document.createElement('div');
    col.className = 'quote-bg-col';
    col.style.setProperty('--quote-dur', `${48 + c * 9}s`);
    col.style.setProperty('--quote-delay', `${-c * 11}s`);
    col.style.setProperty('--quote-opacity', String(0.68 + (c % 2) * 0.08));

    // 每列错开取样 + 行间插入空白，减少视觉叠字
    const step = Math.max(1, Math.floor(pool.length / cols));
    const shifted = [...pool.slice(c * step), ...pool.slice(0, c * step)];
    const spaced: string[] = [];
    shifted.forEach((t, i) => {
      spaced.push(t);
      if (i % 2 === 1) spaced.push('');
    });
    const doubled = [...spaced, ...spaced];
    col.innerHTML = doubled
      .map((t) =>
        t
          ? `<span class="quote-bg-line">${escapeHtml(t.replace(/\s*—+\s*/g, ' · '))}</span>`
          : `<span class="quote-bg-gap" aria-hidden="true"></span>`,
      )
      .join('');
    root.appendChild(col);
  }

  const particles = document.getElementById('homeParticles');
  if (particles?.parentNode) {
    particles.parentNode.insertBefore(root, particles);
  } else {
    document.body.insertBefore(root, document.body.firstChild);
  }
}

export { DEFAULT_QUOTES };
