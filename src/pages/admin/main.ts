import '../../styles/admin-starport.css';
import '../../styles/visual-consistency.css';

type Section = 'overview' | 'content' | 'media' | 'photos' | 'friends' | 'comments' | 'library' | 'settings';

const root = document.getElementById('adminRoot');
const TOKEN_KEY = 'askuary:admin-session';
const API_KEY = 'askuary:admin-api';
let token = sessionStorage.getItem(TOKEN_KEY) || '';
let apiBase = localStorage.getItem(API_KEY) || '';
let active: Section = 'overview';
let cache: Record<string, any[]> = {};
let portalConfig: Record<string, any> = {};
let dashboardData: Record<string, any> = {};

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function api(path: string): string {
  return `${apiBase.replace(/\/$/, '')}${path}`;
}

async function request(path: string, init: RequestInit = {}): Promise<any> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(api(path), { ...init, headers, cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    token = '';
    sessionStorage.removeItem(TOKEN_KEY);
    renderLogin('会话已过期，请重新登录。');
    throw new Error('unauthorized');
  }
  if (!res.ok) throw new Error(body.message || `请求失败 (${res.status})`);
  return body;
}

function toast(message: string, tone: 'ok' | 'bad' = 'ok'): void {
  let el = document.getElementById('adminToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'adminToast';
    el.className = 'admin-toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.dataset.tone = tone;
  el.classList.add('is-on');
  window.setTimeout(() => el?.classList.remove('is-on'), 2600);
}

function renderLogin(message = ''): void {
  if (!root) return;
  root.innerHTML = `
    <main class="admin-login">
      <section class="admin-login-card">
        <img src="/brand/avatar.png" alt="" width="58" height="58" />
        <p class="admin-kicker">CONTROL DECK · PRIVATE</p>
        <h1>星港控制台</h1>
        <p>仅供站长使用。内容、信标、评论与资料舱都从这里调度。</p>
        ${message ? `<div class="admin-alert">${esc(message)}</div>` : ''}
        <form id="adminLoginForm">
          <label>API 地址<input name="apiBase" type="url" required value="${esc(apiBase)}" placeholder="https://www.askuary.cn" /></label>
          <label>管理密码<input name="password" type="password" required autocomplete="current-password" autofocus /></label>
          <button type="submit">连接控制台</button>
        </form>
        <a href="/home/">← 返回星港</a>
      </section>
    </main>`;
  document.getElementById('adminLoginForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    apiBase = String(form.get('apiBase') || '').replace(/\/$/, '');
    localStorage.setItem(API_KEY, apiBase);
    const button = (event.currentTarget as HTMLFormElement).querySelector('button')!;
    button.disabled = true;
    button.textContent = '正在验证…';
    try {
      const data = await request('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password: String(form.get('password') || '') }),
      });
      token = data.token;
      sessionStorage.setItem(TOKEN_KEY, token);
      await bootConsole();
    } catch (error) {
      renderLogin(error instanceof Error ? error.message : '连接失败');
    }
  });
}

const NAV: Array<[Section, string, string]> = [
  ['overview', '总览', '◉'], ['content', '内容', '✎'], ['friends', '信标', '◇'],
  ['media', '资源', '⬡'], ['photos', '照片', '▧'], ['comments', '评论', '◌'], ['library', '馆藏', '▣'], ['settings', '设置', '⚙'],
];

function shell(): void {
  if (!root) return;
  root.innerHTML = `
    <div class="admin-shell">
      <aside class="admin-side">
        <a class="admin-brand" href="/home/"><img src="/brand/avatar.png" alt="" /><span>ASKUARY<small>CONTROL DECK</small></span></a>
        <nav>${NAV.map(([id,label,icon]) => `<button data-section="${id}" class="${active===id?'is-active':''}"><span>${icon}</span>${label}</button>`).join('')}</nav>
        <div class="admin-side-foot"><span class="admin-online">SYSTEM ONLINE</span><button id="adminLogout">退出</button></div>
      </aside>
      <main class="admin-main">
        <header class="admin-top"><div><p class="admin-kicker">PRIVATE CONSOLE · LINK STABLE</p><h1 id="adminTitle">控制台</h1></div><div class="admin-top-actions"><button id="adminCreate" hidden>新建</button><button id="adminRefresh">刷新数据</button></div></header>
        <div id="adminView" class="admin-view"><div class="admin-loading">正在同步星港数据…</div></div>
      </main>
    </div>`;
  root.querySelectorAll<HTMLElement>('[data-section]').forEach((button) => {
    button.addEventListener('click', () => {
      active = button.dataset.section as Section;
      shell();
      void loadSection();
    });
  });
  document.getElementById('adminLogout')?.addEventListener('click', () => {
    token = ''; sessionStorage.removeItem(TOKEN_KEY); renderLogin();
  });
  document.getElementById('adminRefresh')?.addEventListener('click', () => void loadSection(true));
}

function rows(items: any[], kind: Section): string {
  if (!items.length) return `<div class="admin-empty">当前没有记录</div>`;
  return `<div class="admin-table">${items.map((item) => {
    const title = item.title || item.name || item.author || item.slug || '未命名';
    const meta = kind === 'content' ? `${item.kind || ''} · ${item.date || ''}` :
      kind === 'comments' ? `${item.path || ''} · ${item.date || ''}` :
      kind === 'library' ? `${item.typeLabel || item.type || ''} · ${item.statusLabel || item.status || ''}` :
      `${item.url || ''} · ${item.createdAt || ''}`;
    const text = item.summary || item.description || item.content || item.author || '';
    const status = item.status || 'published';
    let actions = '';
    if (kind === 'content') actions = `<button data-action="content-status" data-id="${esc(item.id)}" data-status="${status==='published'?'draft':'published'}">${status==='published'?'转为草稿':'发布'}</button>`;
    if (kind === 'content') actions = `<button data-action="content-edit" data-id="${esc(item.id)}">编辑</button>` + actions + `<button class="is-danger" data-action="content-delete" data-id="${esc(item.id)}">删除</button>`;
    if (kind === 'friends' && status === 'pending') actions = `<button data-action="friend-status" data-id="${esc(item.id)}" data-status="approved">通过</button><button data-action="friend-status" data-id="${esc(item.id)}" data-status="rejected">拒绝</button>`;
    if (kind === 'comments' && status === 'pending') actions = `<button data-action="comment-status" data-id="${esc(item.id)}" data-status="published">发布</button>`;
    if (kind === 'library') actions = `<button data-action="library-edit" data-id="${esc(item.id || item.slug)}">编辑</button><button class="is-danger" data-action="library-delete" data-id="${esc(item.id || item.slug)}">删除</button>`;
    if (kind === 'photos') actions = `<button data-action="photo-edit" data-id="${esc(item.id)}">编辑</button><button class="is-danger" data-action="photo-delete" data-id="${esc(item.id)}">隐藏</button>`;
    return `<article class="admin-row"><div><div class="admin-row-head"><strong>${esc(title)}</strong><span data-status="${esc(status)}">${esc(status)}</span></div><small>${esc(meta)}</small><p>${esc(text).slice(0,180)}</p></div><div class="admin-row-actions">${actions}</div></article>`;
  }).join('')}</div>`;
}

function overview(): string {
  const counts = dashboardData.counts || {};
  const pending = (counts.pendingFriends || 0) + (counts.pendingComments || 0);
  const total = counts.content || 0;
  const published = Math.max(0,total-(counts.drafts || 0));
  const uptimeHours = Math.floor((dashboardData.uptimeSeconds || 0)/3600);
  return `<section class="admin-cards">
    <article><span>CONTENT</span><strong>${counts.content || 0}</strong><p>数据库内容 · ${counts.drafts || 0} 篇草稿</p></article>
    <article><span>MEDIA</span><strong>${dashboardData.media?.files || 0}</strong><p>资源库 · ${formatBytes(dashboardData.media?.bytes || 0)}</p></article>
    <article><span>PENDING</span><strong>${pending}</strong><p>待处理事项</p></article>
    <article><span>UPTIME</span><strong>${uptimeHours}<small>h</small></strong><p>API 本次连续运行</p></article>
  </section><div class="admin-dashboard-grid"><section class="admin-panel"><h2>内容状态</h2><div class="admin-bars">
    ${bar('已发布',published,total)}${bar('草稿',counts.drafts || 0,total)}
    ${bar('照片',counts.photos || 0,Math.max(counts.photos || 0,counts.library || 0,1))}
    ${bar('馆藏',counts.library || 0,Math.max(counts.photos || 0,counts.library || 0,1))}
  </div></section><section class="admin-panel"><h2>系统状态</h2><div class="admin-status-grid">
    <div><i></i>管理 API 已连接</div><div><i></i>会话凭证有效</div>
    <div><i></i>${counts.portal || 0} 组动态设置</div><div><i></i>${counts.comments || 0} 条评论记录</div>
  </div></section></div>${serverAuditHtml()}${auditHtml()}`;
}

function bar(label:string,value:number,total:number):string {
  const percent=Math.min(100,Math.round(value/Math.max(1,total)*100));
  return `<div><span><b>${esc(label)}</b><em>${value}</em></span><i style="--value:${percent}%"></i></div>`;
}

function serverAuditHtml(): string {
  const items = dashboardData.audit || [];
  if (!items.length) return '';
  return `<section class="admin-panel"><h2>服务器审计记录</h2><div class="admin-server-audit">${items.map((item:any)=>`
    <div data-ok="${item.ok}"><time>${esc(new Date(item.at).toLocaleString('zh-CN'))}</time><strong>${item.ok?'成功':'失败'}</strong><span>${esc(item.action)}</span></div>`).join('')}</div></section>`;
}

function mediaGrid(): string {
  const items = cache.media || [];
  return `<section class="admin-upload">
    <input id="mediaFiles" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden />
    <button class="admin-dropzone" id="mediaDropzone" type="button">
      <strong>拖入图片，或点击选择</strong><span>JPEG / PNG / WebP / GIF · 单张最大 8MB · 自动生成唯一文件名</span>
      <i id="mediaProgress"></i>
    </button>
  </section>${items.length ? `<div class="admin-media-grid">${items.map(item=>`
    <article><img src="${esc(api(item.url))}" alt="" loading="lazy" />
      <div><strong>${esc(item.name)}</strong><small>${formatBytes(item.size)} · ${esc(String(item.updatedAt || '').slice(0,10))}</small>
      <span><button data-action="media-copy" data-url="${esc(api(item.url))}">复制地址</button><button class="is-danger" data-action="media-delete" data-id="${esc(item.name)}">移至回收区</button></span></div>
    </article>`).join('')}</div>` : '<div class="admin-empty">还没有上传资源</div>'}`;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

const PORTAL_LABELS: Record<string,[string,string]> = {
  'nav-stars':['宇宙导航信标','门户页四周的可点击星点'],
  notices:['站内公告','主页展示的更新和通知'],
  'meteor-words':['流星短句','宇宙入口随机划过的文字'],
  'bg-quotes':['背景语录','内页背景出现的短句'],
  spots:['地球光点','经纬度、标题与地点故事'],
  'site-widgets':['全站组件','天气、挂件等运行配置'],
};

function settingsView(): string {
  const keys = Array.isArray(portalConfig.keys) ? portalConfig.keys : Object.keys(PORTAL_LABELS);
  return `<div class="admin-settings-intro"><strong>动态站点设置</strong><p>保存后立即写入 API 数据库，无需重新构建前端。恢复默认会删除数据库覆盖并重新使用静态配置。</p></div>
    <div class="admin-settings-grid">${keys.map((key:string)=>{
      const [label,desc] = PORTAL_LABELS[key] || [key,''];
      const value = portalConfig[key];
      return `<section class="admin-setting-card" data-setting="${esc(key)}"><header><div><h2>${esc(label)}</h2><p>${esc(desc)}</p></div><span>${value == null ? 'STATIC' : 'LIVE'}</span></header>
        <textarea spellcheck="false">${esc(JSON.stringify(value ?? [],null,2))}</textarea>
        <footer><button data-action="setting-format" data-id="${esc(key)}">格式化检查</button><button class="is-danger" data-action="setting-reset" data-id="${esc(key)}">恢复默认</button><button data-action="setting-save" data-id="${esc(key)}">保存上线</button></footer>
      </section>`;
    }).join('')}</div>`;
}

async function fetchAll(): Promise<void> {
  const [content, media, photos, friends, comments, library, portal, dashboard] = await Promise.all([
    request('/api/content?status=all'), request('/api/media'),
    request('/api/photos'), request('/api/friend-applications'), request('/api/comments?path=all'), request('/api/library'), request('/api/portal'), request('/api/admin/dashboard'),
  ]);
  cache = {
    content: content.items || [], media: media.items || [], photos: photos.photos || [], friends: friends.applications || [],
    comments: comments.items || [], library: library.items || [], albums: photos.albums || [],
  };
  portalConfig = portal || {};
  dashboardData = dashboard || {};
}

async function loadSection(force = false): Promise<void> {
  const view = document.getElementById('adminView');
  const title = document.getElementById('adminTitle');
  if (!view || !title) return;
  title.textContent = NAV.find(([id])=>id===active)?.[1] || '控制台';
  const create = document.getElementById('adminCreate') as HTMLButtonElement | null;
  if (create) {
    create.hidden = !['content', 'media', 'photos', 'library'].includes(active);
    create.textContent = active === 'content' ? '新建内容' : active === 'media' ? '上传资源' : active === 'photos' ? '同步照片' : '新增馆藏';
    create.onclick = () => active === 'content' ? openContentEditor() : active === 'media' ? document.getElementById('mediaFiles')?.click() : active === 'photos' ? void syncPhotos() : openLibraryEditor();
  }
  view.innerHTML = `<div class="admin-loading">正在同步数据…</div>`;
  try {
    if (force || !Object.keys(cache).length) await fetchAll();
    view.innerHTML = active === 'overview' ? overview() : active === 'media' ? mediaGrid() : active === 'settings' ? settingsView() : rows(cache[active] || [], active);
    bindActions(view);
    if (active === 'media') bindMediaUpload(view);
  } catch (error) {
    view.innerHTML = `<div class="admin-error">${esc(error instanceof Error ? error.message : '数据加载失败')}</div>`;
  }
}

function bindActions(view: HTMLElement): void {
  view.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const { action, id, status } = button.dataset;
      if (action?.startsWith('setting-') && id) {
        const card = button.closest<HTMLElement>('[data-setting]')!;
        const editor = card.querySelector<HTMLTextAreaElement>('textarea')!;
        try {
          if (action === 'setting-reset') {
            if (!window.confirm('删除这项动态配置并恢复使用静态默认值？')) return;
            await request(`/api/portal/${encodeURIComponent(id)}`,{method:'DELETE'});
            logAction('恢复站点默认配置',id); toast('已恢复默认配置');
          } else {
            const items = JSON.parse(editor.value);
            if (!Array.isArray(items)) throw new Error('配置最外层必须是数组');
            editor.value = JSON.stringify(items,null,2);
            if (action === 'setting-format') { toast('JSON 格式正确'); return; }
            await request(`/api/portal/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify({items})});
            logAction('更新站点配置',id); toast('配置已保存上线');
          }
          await fetchAll(); await loadSection(); return;
        } catch (error) { toast(error instanceof Error?error.message:'配置无效','bad'); return; }
      }
      if (action === 'media-copy') {
        await navigator.clipboard.writeText(button.dataset.url || '');
        toast('资源地址已复制'); return;
      }
      if (action === 'media-delete' && id) {
        if (!window.confirm('将该资源移至服务器回收区？引用它的页面可能无法继续显示。')) return;
        await request(`/api/media/${encodeURIComponent(id)}`, { method:'DELETE' });
        logAction('资源移至回收区', id); toast('已移至回收区');
        await fetchAll(); await loadSection(); return;
      }
      if (!id || !status) return;
      button.disabled = true;
      try {
        if (action === 'content-edit') {
          const item = (cache.content || []).find(x=>x.id===id);
          if (item) openContentEditor(item);
          return;
        }
        if (action === 'library-edit') {
          const item = (cache.library || []).find(x=>(x.id || x.slug)===id);
          if (item) openLibraryEditor(item);
          return;
        }
        if (action === 'photo-edit') {
          const item = (cache.photos || []).find(x=>x.id===id);
          if (item) openPhotoEditor(item);
          return;
        }
        if (action?.endsWith('-delete')) {
          const label = action.startsWith('photo') ? '隐藏这张照片' : '删除这条记录';
          if (!window.confirm(`${label}？此操作会立即影响线上数据。`)) { button.disabled = false; return; }
          if (action === 'content-delete') await request(`/api/content/${encodeURIComponent(id)}`, {method:'DELETE'});
          if (action === 'library-delete') await request(`/api/library/${encodeURIComponent(id)}`, {method:'DELETE'});
          if (action === 'photo-delete') await request(`/api/photos/item?id=${encodeURIComponent(id)}`, {method:'DELETE'});
          logAction(label, id); toast('操作已完成'); await fetchAll(); await loadSection(); return;
        }
        if (action === 'content-status') await request(`/api/content/${encodeURIComponent(id)}`, { method:'PATCH', body:JSON.stringify({status}) });
        if (action === 'friend-status') await request(`/api/friend-applications/${encodeURIComponent(id)}`, { method:'PATCH', body:JSON.stringify({status}) });
        if (action === 'comment-status') await request(`/api/comments/${encodeURIComponent(id)}/status`, { method:'PATCH', body:JSON.stringify({status}) });
        logAction('更新状态', `${action}:${id} → ${status}`);
        toast('操作已完成'); await fetchAll(); await loadSection();
      } catch (error) {
        toast(error instanceof Error ? error.message : '操作失败', 'bad');
        button.disabled = false;
      }
    });
  });
}

function bindMediaUpload(view: HTMLElement): void {
  const input = view.querySelector<HTMLInputElement>('#mediaFiles')!;
  const zone = view.querySelector<HTMLButtonElement>('#mediaDropzone')!;
  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', () => void uploadMedia(Array.from(input.files || [])));
  for (const eventName of ['dragenter','dragover']) zone.addEventListener(eventName, (event) => {
    event.preventDefault(); zone.classList.add('is-dragging');
  });
  for (const eventName of ['dragleave','drop']) zone.addEventListener(eventName, (event) => {
    event.preventDefault(); zone.classList.remove('is-dragging');
  });
  zone.addEventListener('drop', (event) => void uploadMedia(Array.from(event.dataTransfer?.files || [])));
}

async function uploadMedia(files: File[]): Promise<void> {
  const images = files.filter(file => file.type.startsWith('image/'));
  if (!images.length) return toast('请选择图片文件', 'bad');
  const progress = document.getElementById('mediaProgress') as HTMLElement | null;
  for (let index = 0; index < images.length; index += 1) {
    const file = images[index];
    try {
      await uploadOne(file, (value) => {
        if (progress) progress.style.setProperty('--progress', `${((index + value) / images.length) * 100}%`);
      });
      logAction('上传资源', file.name);
    } catch (error) {
      toast(`${file.name}：${error instanceof Error ? error.message : '上传失败'}`, 'bad');
    }
  }
  toast(`资源上传完成（${images.length} 个）`);
  await fetchAll(); await loadSection();
}

function uploadOne(file: File, onProgress: (value: number) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', api('/api/media'));
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = event => event.lengthComputable && onProgress(event.loaded / event.total);
    xhr.onerror = () => reject(new Error('网络连接失败'));
    xhr.onload = () => {
      const body = JSON.parse(xhr.responseText || '{}');
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new Error(body.message || `上传失败 (${xhr.status})`));
    };
    const data = new FormData(); data.append('file', file); xhr.send(data);
  });
}

function modal(title: string, body: string): HTMLElement {
  document.getElementById('adminModal')?.remove();
  const wrap = document.createElement('div');
  wrap.id = 'adminModal';
  wrap.className = 'admin-modal';
  wrap.innerHTML = `<div class="admin-modal-backdrop" data-close></div><section class="admin-modal-card"><header><div><p class="admin-kicker">EDITOR MODULE</p><h2>${esc(title)}</h2></div><button type="button" data-close>×</button></header>${body}</section>`;
  document.body.appendChild(wrap);
  wrap.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',()=>wrap.remove()));
  return wrap;
}

function logAction(action: string, target: string): void {
  const key = 'askuary:admin-audit';
  const list = JSON.parse(localStorage.getItem(key) || '[]') as any[];
  list.unshift({ action, target, at: new Date().toLocaleString('zh-CN') });
  localStorage.setItem(key, JSON.stringify(list.slice(0, 20)));
}

function auditHtml(): string {
  const list = JSON.parse(localStorage.getItem('askuary:admin-audit') || '[]') as any[];
  if (!list.length) return '';
  return `<section class="admin-panel"><h2>本机操作记录</h2><div class="admin-audit">${list.slice(0,6).map(x=>`<div><time>${esc(x.at)}</time><strong>${esc(x.action)}</strong><span>${esc(x.target)}</span></div>`).join('')}</div></section>`;
}

async function syncPhotos(): Promise<void> {
  if (!window.confirm('从服务器 photowall-index.json 同步照片索引？已有人工元数据和未出现在本次索引中的记录都会保留。')) return;
  try {
    const result = await request('/api/photos/sync', {method:'POST',body:JSON.stringify({prune:false})});
    logAction('同步照片索引', `${result.photos || 0} photos`);
    toast(`已同步 ${result.photos || 0} 张照片`);
    await fetchAll(); await loadSection();
  } catch (error) { toast(error instanceof Error?error.message:'同步失败','bad'); }
}

function openContentEditor(item: any = null): void {
  const isEdit = Boolean(item?.id);
  const wrap = modal(isEdit ? '编辑内容' : '新建内容', `
    <form class="admin-editor" id="contentEditor">
      <div class="admin-form-grid">
        <label>类型<select name="kind"><option value="journal">日记 / 文章</option><option value="blog">宇宙博客</option></select></label>
        <label>模式<select name="mode"><option value="article">文章</option><option value="shuoshuo">碎念</option><option value="blog">博客</option></select></label>
        <label class="is-wide">标题<input name="title" required value="${esc(item?.title)}" /></label>
        <label>Slug<input name="slug" value="${esc(item?.slug)}" placeholder="留空自动生成" /></label>
        <label>日期<input name="date" type="date" value="${esc((item?.date || '').slice(0,10))}" /></label>
        <label class="is-wide">标签<input name="tags" value="${esc((item?.tags || []).join(', '))}" placeholder="摄影, 随笔" /></label>
        <label class="is-wide">摘要<textarea name="summary" rows="2">${esc(item?.summary)}</textarea></label>
        <label class="is-wide">封面<div class="admin-field-action"><input name="cover" value="${esc(item?.cover)}" placeholder="留空使用自动封面" /><button type="button" data-cover-picker>资源库 / 裁切</button></div></label>
      </div>
      <div class="admin-editor-split">
        <label>Markdown 正文<textarea name="markdown" id="contentMarkdown" required>${esc(item?.markdown || '')}</textarea></label>
        <div><div class="admin-preview-head">发布效果预览</div><div class="admin-preview" id="contentPreview">点击“预览”查看效果</div></div>
      </div>
      <footer><button type="button" id="contentPreviewBtn">预览</button><select name="status"><option value="draft">保存草稿</option><option value="published">直接发布</option></select><button type="submit">${isEdit?'保存修改':'创建内容'}</button></footer>
    </form>`);
  const form = wrap.querySelector<HTMLFormElement>('#contentEditor')!;
  bindCoverPicker(form, wrap);
  const draftKey = `askuary:admin-draft:${item?.id || 'new'}`;
  const savedDraft = localStorage.getItem(draftKey);
  if (savedDraft && window.confirm('发现尚未提交的本地草稿，是否恢复？')) {
    try {
      const saved = JSON.parse(savedDraft);
      for (const [key,value] of Object.entries(saved)) {
        const field = form.elements.namedItem(key) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
        if (field && typeof value === 'string') field.value = value;
      }
      toast('已恢复上次未提交的草稿');
    } catch { /* ignore invalid local draft */ }
  }
  (form.elements.namedItem('kind') as HTMLSelectElement).value = item?.kind || 'journal';
  (form.elements.namedItem('mode') as HTMLSelectElement).value = item?.mode || (item?.kind==='blog'?'blog':'article');
  (form.elements.namedItem('status') as HTMLSelectElement).value = item?.status || 'draft';
  let saveTimer = 0;
  form.addEventListener('input', () => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      const values: Record<string,string> = {};
      new FormData(form).forEach((value,key)=>{ values[key]=String(value); });
      localStorage.setItem(draftKey, JSON.stringify(values));
    }, 500);
  });
  wrap.querySelector('#contentPreviewBtn')?.addEventListener('click', async () => {
    const preview = wrap.querySelector('#contentPreview')!;
    preview.textContent = '正在渲染…';
    try {
      const data = await request('/api/content/preview', {method:'POST',body:JSON.stringify({markdown:(form.elements.namedItem('markdown') as HTMLTextAreaElement).value})});
      preview.innerHTML = data.html || '<p>暂无内容</p>';
    } catch (error) { preview.textContent = error instanceof Error ? error.message : '预览失败'; }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const payload = {
      kind: fd.get('kind'), mode: fd.get('mode'), title: fd.get('title'),
      slug: fd.get('slug') || undefined, date: fd.get('date') || undefined,
      tags: String(fd.get('tags')||'').split(/[,，]/).map(x=>x.trim()).filter(Boolean),
      summary: fd.get('summary'), cover: fd.get('cover'), markdown: fd.get('markdown'),
      status: fd.get('status'),
    };
    try {
      const body: Record<string, unknown> = { ...payload };
      if (isEdit) delete body.kind;
      await request(isEdit?`/api/content/${encodeURIComponent(item.id)}`:'/api/content',{method:isEdit?'PATCH':'POST',body:JSON.stringify(body)});
      localStorage.removeItem(draftKey);
      logAction(isEdit?'更新内容':'创建内容', String(payload.title));
      wrap.remove(); toast(isEdit?'内容已更新':'内容已创建'); await fetchAll(); await loadSection();
    } catch (error) { toast(error instanceof Error?error.message:'保存失败','bad'); }
  });
}

function openLibraryEditor(item: any = null): void {
  const isEdit = Boolean(item?.id);
  const wrap = modal(isEdit ? '编辑馆藏' : '新增馆藏', `
    <form class="admin-editor" id="libraryEditor">
      <div class="admin-form-grid">
        <label class="is-wide">标题<input name="title" required value="${esc(item?.title)}" /></label>
        <label>作者<input name="author" value="${esc(item?.author)}" /></label>
        <label>类型<select name="type">${['book','novel','manga','game','anime','movie','drama','variety'].map(x=>`<option value="${x}">${x}</option>`).join('')}</select></label>
        <label>状态<select name="status"><option value="reading">进行中</option><option value="finished">已完成</option><option value="planned">计划</option><option value="dropped">搁置</option></select></label>
        <label>评分（0-10）<input name="rating" type="number" min="0" max="10" step=".5" value="${esc(item?.rating || 0)}" /></label>
        <label class="is-wide">封面<div class="admin-field-action"><input name="cover" value="${esc(item?.cover)}" /><button type="button" data-cover-picker>资源库 / 裁切</button></div></label>
        <label class="is-wide">简介<textarea name="summary" rows="4">${esc(item?.summary)}</textarea></label>
        <label class="is-wide">笔记<textarea name="thoughts" rows="5">${esc(item?.thoughts)}</textarea></label>
      </div>
      <footer><button type="submit">${isEdit?'保存馆藏':'添加馆藏'}</button></footer>
    </form>`);
  const form = wrap.querySelector<HTMLFormElement>('#libraryEditor')!;
  bindCoverPicker(form, wrap);
  (form.elements.namedItem('type') as HTMLSelectElement).value = item?.type || 'book';
  (form.elements.namedItem('status') as HTMLSelectElement).value = item?.status || 'planned';
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const payload = {title:fd.get('title'),author:fd.get('author'),type:fd.get('type'),status:fd.get('status'),rating:Number(fd.get('rating')||0),cover:fd.get('cover'),summary:fd.get('summary'),thoughts:fd.get('thoughts')};
    const slug = item?.id || item?.slug;
    try {
      await request(isEdit?`/api/library/${encodeURIComponent(slug)}`:'/api/library',{method:isEdit?'PATCH':'POST',body:JSON.stringify(payload)});
      logAction(isEdit?'更新馆藏':'新增馆藏', String(payload.title));
      wrap.remove(); toast(isEdit?'馆藏已更新':'馆藏已添加'); await fetchAll(); await loadSection();
    } catch (error) { toast(error instanceof Error?error.message:'保存失败','bad'); }
  });
}

function openPhotoEditor(item: any): void {
  const albums = (cache.albums || []).map((x:any)=>x.key);
  const wrap = modal('编辑照片信息', `
    <form class="admin-editor" id="photoEditor">
      <div class="admin-photo-head"><img src="${esc(item.thumb || item.src)}" alt="" /><div><strong>${esc(item.id)}</strong><p>仅编辑数据库元数据，不修改原图文件。</p></div></div>
      <div class="admin-form-grid">
        <label class="is-wide">标题<input name="title" value="${esc(item.title)}" /></label>
        <label>日期<input name="date" type="date" value="${esc(item.date)}" /></label>
        <label>分类<input name="category" value="${esc(item.category)}" /></label>
        <label>地点<input name="location" value="${esc(item.location)}" /></label>
        <label>设备<input name="device" value="${esc(item.device)}" /></label>
        <label class="is-wide">相册<select name="albumKey">${albums.map((x:string)=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></label>
        <label class="is-wide">说明<textarea name="note" rows="4">${esc(item.note)}</textarea></label>
        <label class="is-wide">照片故事<textarea name="storyIntro" rows="6">${esc(item.story?.intro)}</textarea></label>
      </div>
      <footer><button type="submit">保存照片信息</button></footer>
    </form>`);
  const form = wrap.querySelector<HTMLFormElement>('#photoEditor')!;
  (form.elements.namedItem('albumKey') as HTMLSelectElement).value = item.album || '';
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const payload = {title:fd.get('title'),date:fd.get('date'),category:fd.get('category'),location:fd.get('location'),device:fd.get('device'),albumKey:fd.get('albumKey'),note:fd.get('note'),story:{...(item.story || {}),intro:fd.get('storyIntro')}};
    try {
      await request(`/api/photos/item?id=${encodeURIComponent(item.id)}`,{method:'PATCH',body:JSON.stringify(payload)});
      logAction('更新照片', item.id); wrap.remove(); toast('照片信息已更新'); await fetchAll(); await loadSection();
    } catch (error) { toast(error instanceof Error?error.message:'保存失败','bad'); }
  });
}

function bindCoverPicker(form: HTMLFormElement, scope: HTMLElement): void {
  scope.querySelector('[data-cover-picker]')?.addEventListener('click', () => {
    openMediaPicker((url) => {
      const field = form.elements.namedItem('cover') as HTMLInputElement;
      field.value = url;
      field.dispatchEvent(new Event('input', { bubbles:true }));
      toast('封面地址已回填');
    });
  });
}

function openMediaPicker(onSelect: (url: string) => void): void {
  document.getElementById('adminMediaPicker')?.remove();
  const picker = document.createElement('div');
  picker.id = 'adminMediaPicker';
  picker.className = 'admin-picker';
  const items = cache.media || [];
  picker.innerHTML = `<div class="admin-picker-backdrop" data-picker-close></div><section>
    <header><div><p class="admin-kicker">COVER SELECTOR</p><h2>选择或裁切封面</h2></div><button data-picker-close>×</button></header>
    <div class="admin-picker-tools"><input type="file" id="coverCropFile" accept="image/jpeg,image/png,image/webp" hidden /><button id="coverCropChoose">上传并裁切新图片</button><span>推荐比例 16:9</span></div>
    <div class="admin-picker-grid">${items.map(item=>`<button data-media-url="${esc(item.url)}"><img src="${esc(api(item.url))}" alt="" loading="lazy" /><span>${esc(item.name)}</span></button>`).join('') || '<p>资源库为空，可先上传并裁切一张图片。</p>'}</div>
  </section>`;
  document.body.appendChild(picker);
  picker.querySelectorAll('[data-picker-close]').forEach(el=>el.addEventListener('click',()=>picker.remove()));
  picker.querySelectorAll<HTMLElement>('[data-media-url]').forEach(el=>el.addEventListener('click',()=>{
    onSelect(el.dataset.mediaUrl || ''); picker.remove();
  }));
  const input = picker.querySelector<HTMLInputElement>('#coverCropFile')!;
  picker.querySelector('#coverCropChoose')?.addEventListener('click',()=>input.click());
  input.addEventListener('change',()=> {
    const file = input.files?.[0];
    if (file) { picker.remove(); openCropper(file, onSelect); }
  });
}

function openCropper(file: File, onSelect: (url: string) => void): void {
  const wrap = document.createElement('div');
  wrap.className = 'admin-picker admin-cropper';
  wrap.innerHTML = `<div class="admin-picker-backdrop"></div><section>
    <header><div><p class="admin-kicker">COVER CROPPER · 16:9</p><h2>调整封面构图</h2></div><button data-crop-close>×</button></header>
    <div class="admin-crop-stage"><canvas width="1200" height="675"></canvas></div>
    <div class="admin-crop-controls"><label>缩放<input type="range" min="1" max="3" value="1" step=".01" /></label><span>拖动画面调整中心</span><button id="cropSave">裁切并上传</button></div>
  </section>`;
  document.body.appendChild(wrap);
  const canvas = wrap.querySelector('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const slider = wrap.querySelector<HTMLInputElement>('input[type=range]')!;
  const image = new Image();
  let zoom = 1, offsetX = 0, offsetY = 0, dragging = false, lastX = 0, lastY = 0;
  const draw = () => {
    const base = Math.max(canvas.width / image.width, canvas.height / image.height);
    const width = image.width * base * zoom, height = image.height * base * zoom;
    offsetX = Math.max((canvas.width-width)/2, Math.min((width-canvas.width)/2, offsetX));
    offsetY = Math.max((canvas.height-height)/2, Math.min((height-canvas.height)/2, offsetY));
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image,(canvas.width-width)/2+offsetX,(canvas.height-height)/2+offsetY,width,height);
  };
  image.onload = draw;
  image.src = URL.createObjectURL(file);
  slider.addEventListener('input',()=>{ zoom=Number(slider.value); draw(); });
  canvas.addEventListener('pointerdown',event=>{ dragging=true; lastX=event.clientX; lastY=event.clientY; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointermove',event=>{ if(!dragging)return; offsetX+=(event.clientX-lastX)*canvas.width/canvas.clientWidth; offsetY+=(event.clientY-lastY)*canvas.height/canvas.clientHeight; lastX=event.clientX; lastY=event.clientY; draw(); });
  canvas.addEventListener('pointerup',()=>{dragging=false;});
  wrap.querySelector('[data-crop-close]')?.addEventListener('click',()=>{URL.revokeObjectURL(image.src);wrap.remove();});
  wrap.querySelector('#cropSave')?.addEventListener('click',async(event)=>{
    const button=event.currentTarget as HTMLButtonElement; button.disabled=true; button.textContent='正在上传…';
    try {
      const blob = await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('裁切失败')),'image/jpeg',.9));
      const result = await uploadOne(new File([blob],`cover-${Date.now()}.jpg`,{type:'image/jpeg'}),()=>{});
      cache.media = [result,...(cache.media||[])]; onSelect(result.url); logAction('裁切并上传封面',result.name);
      URL.revokeObjectURL(image.src); wrap.remove(); toast('新封面已上传并回填');
    } catch(error) { button.disabled=false; button.textContent='裁切并上传'; toast(error instanceof Error?error.message:'上传失败','bad'); }
  });
}

async function bootConsole(): Promise<void> {
  shell();
  try {
    await request('/api/admin/session');
    await loadSection(true);
  } catch (error) {
    if (token) toast(error instanceof Error ? error.message : '连接失败', 'bad');
  }
}

async function init(): Promise<void> {
  if (!apiBase) {
    try {
      const site = await fetch('/data/site.json', { cache:'no-store' }).then(r=>r.json());
      apiBase = String(site.apiBase || location.origin);
    } catch { apiBase = location.origin; }
  }
  if (token) await bootConsole(); else renderLogin();
}

void init();
