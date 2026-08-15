import '../styles/star-search.css';

type SearchItem = {
  title: string;
  summary?: string;
  path: string;
  source: string;
  tags?: string[];
  cover?: string;
};

let mounted = false;
let indexPromise: Promise<SearchItem[]> | null = null;

function esc(value: unknown): string {
  return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g,'').replace(/[·—\-_/《》「」『』]/g,'');
}

async function loadIndex(): Promise<SearchItem[]> {
  if (indexPromise) return indexPromise;
  indexPromise = Promise.all([
    fetch('/data/archive-index.json',{cache:'no-store'}).then<any>(r=>r.ok?r.json():{}),
    fetch('/data/library.json',{cache:'no-store'}).then<any>(r=>r.ok?r.json():{}),
  ]).then(([archive,library]) => {
    const content = (archive.entries || []).map((item:any)=>({
      title:item.title,summary:item.summary,path:item.path,source:item.source==='blog'?'宇宙博客':'航行记录',
      tags:item.tags || [],cover:item.cover,
    }));
    const books = (library.items || []).map((item:any)=>({
      title:item.title,summary:[item.author,item.genre,item.summary].filter(Boolean).join(' · '),
      path:`/library/?q=${encodeURIComponent(item.title)}`,source:'资料舱',tags:[item.typeLabel,item.statusLabel].filter(Boolean),cover:item.cover,
    }));
    return [...content,...books];
  });
  return indexPromise;
}

function score(item: SearchItem, query: string): number {
  const q=normalize(query), title=normalize(item.title), tags=normalize((item.tags||[]).join(' ')), text=normalize(item.summary||'');
  if (!q) return 1;
  if (title === q) return 100;
  if (title.startsWith(q)) return 70;
  if (title.includes(q)) return 50;
  if (tags.includes(q)) return 30;
  if (text.includes(q)) return 15;
  const chars=[...q];
  return chars.every(char=>`${title}${tags}${text}`.includes(char)) ? 4 : 0;
}

function render(items: SearchItem[], query: string): void {
  const target=document.getElementById('starSearchResults');
  if (!target) return;
  const matches=items.map(item=>({item,score:score(item,query)})).filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score).slice(0,12);
  target.innerHTML=matches.length ? matches.map(({item})=>`
    <a href="${esc(item.path)}">
      <span class="star-search-cover">${item.cover?`<img src="${esc(item.cover)}" alt="" loading="lazy" />`:'✦'}</span>
      <span><small>${esc(item.source)}</small><strong>${esc(item.title)}</strong><em>${esc(item.summary).slice(0,90)}</em></span>
      <i>↗</i>
    </a>`).join('') : `<div class="star-search-empty">这片星域没有找到相关记录</div>`;
  const count=document.getElementById('starSearchCount');
  if(count) count.textContent=`${matches.length} 个坐标`;
}

export function mountStarSearch(): void {
  if (mounted || document.getElementById('starSearch')) return;
  mounted=true;
  const root=document.createElement('div');
  root.id='starSearch';
  root.innerHTML=`<a class="star-search-trigger" href="#star-search-open" aria-label="搜索全站" title="搜索全站（按 /）"><span>⌕</span><em>搜索</em><kbd>/</kbd></a>
    <div class="star-search-dialog" id="star-search-open">
      <a class="star-search-backdrop" href="#" data-search-close></a>
      <section role="dialog" aria-modal="true" aria-label="星图搜索">
        <header><div><small>ASKUARY STAR MAP</small><strong>检索宇宙坐标</strong></div><a href="#" role="button" data-search-close>×</a></header>
        <label><span>⌕</span><input id="starSearchInput" autocomplete="off" placeholder="搜索文章、碎念、标签或馆藏…" /><kbd>ESC</kbd></label>
        <div class="star-search-meta"><span id="starSearchCount">正在连接星图…</span><em>↑↓ 浏览 · Enter 打开</em></div>
        <div class="star-search-results" id="starSearchResults"></div>
      </section>
    </div>`;
  document.body.appendChild(root);
  const input=root.querySelector<HTMLInputElement>('#starSearchInput')!;
  let items:SearchItem[]=[];
  const open=async()=>{
    location.hash='star-search-open'; document.body.classList.add('star-search-open'); input.focus();
    items=await loadIndex(); render(items,input.value);
  };
  const close=()=>{history.replaceState(history.state,'',`${location.pathname}${location.search}`);document.body.classList.remove('star-search-open');};
  window.addEventListener('hashchange',()=>{
    if(location.hash==='#star-search-open') void open();
    else close();
  });
  input.addEventListener('input',()=>render(items,input.value));
  input.addEventListener('keydown',(event)=>{
    const links=[...root.querySelectorAll<HTMLAnchorElement>('.star-search-results a')];
    const current=links.indexOf(document.activeElement as HTMLAnchorElement);
    if(event.key==='ArrowDown'){event.preventDefault();(links[Math.min(links.length-1,current+1)]||links[0])?.focus();}
  });
  root.querySelector('.star-search-results')?.addEventListener('keydown',(rawEvent)=>{
    const event=rawEvent as KeyboardEvent;
    const links=[...root.querySelectorAll<HTMLAnchorElement>('.star-search-results a')];
    const current=links.indexOf(document.activeElement as HTMLAnchorElement);
    if(event.key==='ArrowDown'){event.preventDefault();links[Math.min(links.length-1,current+1)]?.focus();}
    if(event.key==='ArrowUp'){event.preventDefault();current<=0?input.focus():links[current-1]?.focus();}
  });
  document.addEventListener('keydown',(event)=>{
    const typing=['INPUT','TEXTAREA','SELECT'].includes((event.target as HTMLElement)?.tagName);
    if(event.key==='/'&&!typing&&location.hash!=='#star-search-open'){event.preventDefault();void open();}
    if(event.key==='Escape'&&location.hash==='#star-search-open')close();
  });
}
