import '../styles/reading-journey.css';

type ReadingState={progress:number;scrollY:number;title:string;updatedAt:number;favorite?:boolean};
const PREFIX='askuary:reading:';
let controller:AbortController|null=null;

function readState(key:string):ReadingState|null{
  try{return JSON.parse(localStorage.getItem(key)||'null') as ReadingState|null;}catch{return null;}
}

export function mountReadingJourney(root:ParentNode=document):void{
  controller?.abort();controller=new AbortController();
  document.getElementById('readingJourney')?.remove();
  const article=root.querySelector<HTMLElement>('.ask-read-card,#postContent,.post-content,.home-prose');
  if(!article||article.innerText.trim().length<180)return;
  const key=`${PREFIX}${location.pathname}`;
  const saved=readState(key);
  const title=document.querySelector('h1')?.textContent?.trim()||document.title;
  const words=article.innerText.replace(/\s+/g,'').length;
  const minutes=Math.max(1,Math.ceil(words/420));
  const ui=document.createElement('div');
  ui.id='readingJourney';
  ui.className='reading-journey';
  ui.innerHTML=`<div class="reading-progress" aria-hidden="true"><i></i></div>
    <aside><button type="button" data-reading-favorite aria-label="收藏本文" title="收藏本文">☆</button><span><strong id="readingPercent">0%</strong><em id="readingRemain">约 ${minutes} 分钟</em></span></aside>
    ${saved&&saved.progress>8&&saved.progress<92?`<div class="reading-resume"><span>上次航行至 ${Math.round(saved.progress)}%</span><button data-reading-resume>继续阅读</button><button data-reading-dismiss aria-label="关闭">×</button></div>`:''}`;
  document.body.appendChild(ui);
  const bar=ui.querySelector<HTMLElement>('.reading-progress i')!;
  const percent=ui.querySelector<HTMLElement>('#readingPercent')!;
  const remain=ui.querySelector<HTMLElement>('#readingRemain')!;
  const favorite=ui.querySelector<HTMLButtonElement>('[data-reading-favorite]')!;
  let state=saved||{progress:0,scrollY:0,title,updatedAt:Date.now()};
  const syncFavorite=()=>{favorite.textContent=state.favorite?'★':'☆';favorite.classList.toggle('is-active',Boolean(state.favorite));};
  const update=()=>{
    const start=article.getBoundingClientRect().top+scrollY;
    const end=start+article.offsetHeight-innerHeight*.72;
    const value=Math.max(0,Math.min(100,(scrollY-start)/Math.max(1,end-start)*100));
    bar.style.width=`${value}%`;percent.textContent=`${Math.round(value)}%`;
    remain.textContent=value>=99?'本次航行完成':`剩余约 ${Math.max(1,Math.ceil(minutes*(1-value/100)))} 分钟`;
    state={...state,progress:value,scrollY,title,updatedAt:Date.now()};
    try{localStorage.setItem(key,JSON.stringify(state));}catch{/* ignore */}
  };
  syncFavorite();update();
  addEventListener('scroll',update,{passive:true,signal:controller.signal});
  addEventListener('resize',update,{passive:true,signal:controller.signal});
  favorite.addEventListener('click',()=>{state.favorite=!state.favorite;syncFavorite();localStorage.setItem(key,JSON.stringify(state));});
  ui.querySelector('[data-reading-resume]')?.addEventListener('click',()=>{scrollTo({top:saved?.scrollY||0,behavior:'smooth'});ui.querySelector('.reading-resume')?.remove();});
  ui.querySelector('[data-reading-dismiss]')?.addEventListener('click',()=>ui.querySelector('.reading-resume')?.remove());
}
