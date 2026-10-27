/* =========================================================
   GameHub 交互逻辑
   ---------------------------------------------------------
   思路很简单，一共三步：
     1. 把用户的筛选条件记在 state 里（分类 / 关键词 / 排序）
     2. 根据 state 从 allGames 里挑出要显示的游戏
     3. 用模板字符串拼出 HTML，塞进页面
   每次用户操作，重复 2、3 两步即可（这叫「数据驱动视图」）。

   数据来源有两份：
     GAMES        —— js/data.js 里写死的 16 款
     customGames  —— 用户自己添加的，存在 localStorage
   两者合并成 allGames，后面的筛选、搜索、渲染都只看 allGames。
   ========================================================= */

/* ---------- 全局状态 ---------- */
const state = {
  category: '全部', // 当前分类
  keyword: '',      // 搜索关键词
  sort: 'rating'    // 排序方式
};

const FAV_KEY = 'gamehub:favorites';
const CUSTOM_KEY = 'gamehub:custom-games';
const HIDDEN_KEY = 'gamehub:hidden-games';
const COMMENTS_KEY = 'gamehub:comments';
const USERS_KEY = 'gamehub:users';
const SESSION_KEY = 'gamehub:session';
const ALL = '全部';
const FAV_CATEGORY = '收藏';

/* ---------- 页面元素 ---------- */
const els = {
  grid: document.getElementById('grid'),
  filters: document.getElementById('filters'),
  stats: document.getElementById('stats'),
  resultCount: document.getElementById('resultCount'),
  empty: document.getElementById('empty'),
  searchInput: document.getElementById('searchInput'),
  sortSelect: document.getElementById('sortSelect'),
  // 详情弹窗
  modal: document.getElementById('modal'),
  modalCover: document.getElementById('modalCover'),
  modalTitle: document.getElementById('modalTitle'),
  modalSub: document.getElementById('modalSub'),
  modalRating: document.getElementById('modalRating'),
  modalDesc: document.getElementById('modalDesc'),
  modalTags: document.getElementById('modalTags'),
  modalMeta: document.getElementById('modalMeta'),
  modalFav: document.getElementById('modalFav'),
  modalDelete: document.getElementById('modalDelete'),
  // 评论区
  commentList: document.getElementById('commentList'),
  commentCount: document.getElementById('commentCount'),
  commentEmpty: document.getElementById('commentEmpty'),
  commentForm: document.getElementById('commentForm'),
  commentText: document.getElementById('commentText'),
  commentCounter: document.getElementById('commentCounter'),
  commentError: document.getElementById('commentError'),
  commentAs: document.getElementById('commentAs'),
  commentLogin: document.getElementById('commentLogin'),
  commentLoginBtn: document.getElementById('commentLoginBtn'),
  // 登录 / 注册
  authArea: document.getElementById('authArea'),
  authModal: document.getElementById('authModal'),
  authForm: document.getElementById('authForm'),
  authTitle: document.getElementById('authTitle'),
  authHint: document.getElementById('authHint'),
  authError: document.getElementById('authError'),
  authSubmit: document.getElementById('authSubmit'),
  // 添加表单
  addGameBtn: document.getElementById('addGameBtn'),
  formModal: document.getElementById('formModal'),
  form: document.getElementById('gameForm'),
  formError: document.getElementById('formError'),
  categoryOptions: document.getElementById('categoryOptions'),
  coverInput: document.getElementById('coverInput'),
  coverPreview: document.getElementById('coverPreview'),
  pickCoverBtn: document.getElementById('pickCoverBtn'),
  clearCoverBtn: document.getElementById('clearCoverBtn'),
  uploadHint: document.getElementById('uploadHint'),
  toast: document.getElementById('toast'),
  toastText: document.getElementById('toastText'),
  toastAction: document.getElementById('toastAction'),
  restoreBtn: document.getElementById('restoreBtn')
};

let customGames = loadCustomGames();
let hiddenIds = loadHiddenGames();

// data.js 改过之后，可能残留已经不存在的游戏 id，先清掉
const knownIds = new Set([...GAMES, ...customGames].map((g) => g.id));
hiddenIds = new Set([...hiddenIds].filter((id) => knownIds.has(id)));

let allGames = [...GAMES, ...customGames].filter((g) => !hiddenIds.has(g.id));

let comments = loadComments();   // { [gameId]: [{ id, author, text, time, owner }] }
let users = loadUsers();         // [{ username, salt, hash, iterations, createdAt }]
let currentUser = loadSession(); // 当前登录的用户名，空字符串表示没登录

let favorites = loadFavorites();
let currentGameId = null;   // 弹窗里正在展示哪款游戏
let lastTrigger = null;     // 关闭弹窗后把焦点还给它
let formTrigger = null;
let pendingCover = '';      // 表单里刚选好、还没保存的封面图（dataURL）

/* ---------- 小工具 ---------- */
// 把用户输入里的 < > & 之类转义掉，防止一段奇怪的名字把页面结构搞乱
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

function isHexColor(value) {
  return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

let toastTimer = null;
let toastActionHandler = null;

// options: { actionLabel, onAction, duration } —— 有 onAction 时右侧出现一个可点的按钮
function showToast(message, options = {}) {
  els.toastText.textContent = message;

  const action = typeof options.onAction === 'function' ? options.onAction : null;
  toastActionHandler = action;
  els.toastAction.hidden = !action;
  if (action) els.toastAction.textContent = options.actionLabel || '撤销';

  els.toast.hidden = false;
  clearTimeout(toastTimer);
  // 有「撤销」按钮时多留一会儿，够用户点到
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
    toastActionHandler = null;
  }, options.duration || (action ? 6000 : 2400));
}

/* ---------- 自定义游戏：读写 localStorage ---------- */
function loadCustomGames() {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    // 存进来的东西不一定可靠（用户可能手改过），逐条补上默认值
    return list.filter((g) => g && typeof g === 'object' && g.title).map(normalizeGame);
  } catch {
    return [];
  }
}

function normalizeGame(g, index = 0) {
  return {
    id: String(g.id || `custom-${Date.now()}-${index}`),
    title: String(g.title || '未命名游戏'),
    titleEn: String(g.titleEn || ''),
    category: String(g.category || '其他'),
    tags: Array.isArray(g.tags) ? g.tags.map(String).slice(0, 6) : [],
    rating: Math.min(10, Math.max(0, Number(g.rating) || 0)),
    year: Number(g.year) || new Date().getFullYear(),
    platforms: String(g.platforms || '未知'),
    emoji: String(g.emoji || '🎮'),
    // 只认 data:image/ 开头的内容，防止有人往这里塞一段奇怪的 URL
    cover: typeof g.cover === 'string' && g.cover.startsWith('data:image/') ? g.cover : '',
    colors:
      Array.isArray(g.colors) && isHexColor(g.colors[0]) && isHexColor(g.colors[1])
        ? [g.colors[0], g.colors[1]]
        : ['#1b2b4a', '#7c5cff'],
    desc: String(g.desc || ''),
    custom: true
  };
}

function saveCustomGames() {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(customGames));
    return true;
  } catch {
    // 通常是图片太多，把 5MB 的配额撑爆了
    return false;
  }
}

/* ---------- 隐藏的游戏：内置游戏删不掉，只能藏起来 ---------- */
function loadHiddenGames() {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function saveHiddenGames() {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hiddenIds]));
  } catch {
    /* 忽略：隐藏列表很小，基本不会失败 */
  }
}

function rebuildGames() {
  allGames = [...GAMES, ...customGames].filter((g) => !hiddenIds.has(g.id));
}

/* ---------- 评论：按游戏 id 分组存在 localStorage ---------- */
function loadComments() {
  try {
    const raw = localStorage.getItem(COMMENTS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};

    // 存进来的内容不一定可信，逐条清洗一遍
    const clean = {};
    for (const [gameId, list] of Object.entries(data)) {
      if (!Array.isArray(list)) continue;

      const items = list
        .filter((c) => c && typeof c.text === 'string' && c.text.trim())
        .map((c, i) => ({
          id: String(c.id || `c-${Date.now()}-${i}`),
          author: String(c.author || '匿名玩家').slice(0, 16),
          text: String(c.text).slice(0, 200),
          time: Number(c.time) || Date.now()
        }))
        .slice(0, 100);      // 每款游戏最多留 100 条

      if (items.length) clean[gameId] = items;
    }
    return clean;
  } catch {
    return {};
  }
}

function saveComments() {
  try {
    localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments));
    return true;
  } catch {
    return false;
  }
}

/* =========================================================
   账号：注册 / 登录 / 退出
   ---------------------------------------------------------
   没有服务器，账号只能存在浏览器的 localStorage 里。
   为了不「明文存密码」，密码用 PBKDF2-SHA256 加盐哈希后保存：
     存的是 { username, salt, hash, iterations }
     登录时用同样的盐再算一遍，比对哈希值。
   必须清楚：这只挡得住普通用户，挡不住会开开发者工具的人。
   ========================================================= */

function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.filter(
      (u) => u && typeof u.username === 'string' && typeof u.salt === 'string' && typeof u.hash === 'string'
    );
  } catch {
    return [];
  }
}

function saveUsers() {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return true;
  } catch {
    return false;
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return '';
    const data = JSON.parse(raw);
    const name = data && typeof data.username === 'string' ? data.username : '';
    // 账号可能已经被删掉，这里再核对一次
    return users.some((u) => u.username === name) ? name : '';
  } catch {
    return '';
  }
}

const PBKDF2_ITERATIONS = 120000;

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomSalt() {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return bytesToBase64(salt);
}

// 极少数环境没有 Web Crypto（例如非 https 的局域网地址），退化成弱哈希，保证流程能跑
function weakHash(text) {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    a = ((a ^ code) * 0x01000193) >>> 0;
    const mixed = (b + code * (i + 7)) >>> 0;
    b = (mixed ^ (mixed << 13)) >>> 0;
  }
  return `weak-${a.toString(16)}${b.toString(16)}`;
}

async function hashPassword(password, saltBase64, iterations = PBKDF2_ITERATIONS) {
  if (!window.crypto || !crypto.subtle) {
    return weakHash(`${saltBase64}:${password}:${iterations}`);
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: base64ToBytes(saltBase64), iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

function startSession(username) {
  currentUser = username;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ username, at: Date.now() }));
  } catch {
    /* 忽略 */
  }
  renderAuthArea();
  refreshCommentGate();
}

function endSession() {
  currentUser = '';
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* 忽略 */
  }
  renderAuthArea();
  refreshCommentGate();
  showToast('已退出登录');
}

/* ---------- 顶部的登录状态 ---------- */
function renderAuthArea() {
  if (currentUser) {
    els.authArea.innerHTML = `
      <span class="user-chip" title="当前登录账号">
        <span class="user-avatar" aria-hidden="true">${escapeHtml(currentUser.charAt(0).toUpperCase())}</span>
        <span class="user-name">${escapeHtml(currentUser)}</span>
      </span>
      <button class="link-subtle" id="logoutBtn" type="button">退出</button>`;
  } else {
    els.authArea.innerHTML = `<button class="btn-login" id="loginBtn" type="button">登录 / 注册</button>`;
  }
}

// 评论框和「登录后评论」提示二选一
function refreshCommentGate() {
  const logged = !!currentUser;
  els.commentForm.hidden = !logged;
  els.commentLogin.hidden = logged;
  if (logged) els.commentAs.textContent = `以 ${currentUser} 的身份评论`;
  if (currentGameId) renderComments(currentGameId); // 自己的评论才显示删除按钮
}

/* ---------- 登录 / 注册弹窗 ---------- */
let authMode = 'login';
let authTrigger = null;

function setAuthMode(mode) {
  authMode = mode === 'register' ? 'register' : 'login';
  const isLogin = authMode === 'login';

  els.authTitle.textContent = isLogin ? '登录' : '注册';
  els.authSubmit.textContent = isLogin ? '登录' : '注册并登录';
  els.authForm.elements.password.autocomplete = isLogin ? 'current-password' : 'new-password';

  els.authModal.querySelectorAll('[data-auth-tab]').forEach((tab) => {
    const active = tab.dataset.authTab === authMode;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });

  els.authError.hidden = true;
}

function openAuth(mode = 'login', hint = '', trigger = null) {
  authTrigger = trigger;
  setAuthMode(mode);
  els.authHint.textContent = hint || '登录后才能添加游戏和发表评论。';
  els.authForm.reset();
  els.authError.hidden = true;
  els.authModal.hidden = false;
  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => {
    els.authModal.querySelector('.auth-card').focus();
    els.authForm.elements.username.focus();
  });
}

function closeAuth() {
  if (els.authModal.hidden) return;
  els.authModal.hidden = true;
  document.body.style.overflow = '';
  if (authTrigger) authTrigger.focus();
}

function showAuthError(message) {
  els.authError.textContent = message;
  els.authError.hidden = false;
}

function validateUsername(name) {
  if (name.length < 2 || name.length > 16) return '用户名要 2 到 16 个字。';
  if (/\s/.test(name)) return '用户名里不能有空格。';
  return '';
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  const name = els.authForm.elements.username.value.trim();
  const password = els.authForm.elements.password.value;

  const nameError = validateUsername(name);
  if (nameError) {
    showAuthError(nameError);
    return;
  }
  if (password.length < 6) {
    showAuthError('密码至少 6 位。');
    return;
  }

  els.authSubmit.disabled = true;
  els.authSubmit.textContent = '处理中…';

  try {
    if (authMode === 'register') {
      if (users.some((u) => u.username.toLowerCase() === name.toLowerCase())) {
        throw new Error('这个用户名已经被注册了，换一个吧。');
      }

      const salt = randomSalt();
      const hash = await hashPassword(password, salt);
      users.push({ username: name, salt, hash, iterations: PBKDF2_ITERATIONS, createdAt: Date.now() });

      if (!saveUsers()) {
        users.pop();
        throw new Error('保存失败：浏览器存储空间不够了。');
      }

      startSession(name);
      closeAuth();
      showToast(`欢迎，${name}！`);
    } else {
      const user = users.find((u) => u.username.toLowerCase() === name.toLowerCase());
      if (!user) throw new Error('没有找到这个用户，先去「注册」建一个吧。');

      const hash = await hashPassword(password, user.salt, user.iterations || PBKDF2_ITERATIONS);
      if (hash !== user.hash) throw new Error('密码不对。');

      startSession(user.username);
      closeAuth();
      showToast(`欢迎回来，${user.username}`);
    }
  } catch (error) {
    showAuthError(error.message || '出错了，稍后再试。');
  } finally {
    els.authSubmit.disabled = false;
    els.authSubmit.textContent = authMode === 'login' ? '登录' : '注册并登录';
  }
}

function commentCountOf(gameId) {
  return (comments[gameId] || []).length;
}

// 把时间戳变成「刚刚 / 3 分钟前 / 2 天前」这种人话
function timeAgo(timestamp) {
  const diff = Math.max(0, Date.now() - timestamp);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

function renderComments(gameId) {
  const list = comments[gameId] || [];

  els.commentCount.textContent = list.length;
  els.commentEmpty.hidden = list.length > 0;

  els.commentList.innerHTML = list
    .map((c) => {
      const author = escapeHtml(c.author);
      const initial = escapeHtml(c.author.trim().charAt(0).toUpperCase() || '匿');
      // 登录了、而且是这条评论的作者，才给删除按钮（早期没有 owner 的评论放行）
      const canDelete = !!currentUser && (!c.owner || c.owner === currentUser);
      const delBtn = canDelete
        ? `<button class="comment-del" type="button" data-del-comment="${c.id}"
                   aria-label="删除 ${author} 的评论">删除</button>`
        : '';
      return `
        <li class="comment">
          <span class="comment-avatar" aria-hidden="true">${initial}</span>
          <div class="comment-main">
            <div class="comment-head">
              <span class="comment-author">${author}</span>
              <span class="comment-time">${timeAgo(c.time)}</span>
              ${delBtn}
            </div>
            <p class="comment-text">${escapeHtml(c.text)}</p>
          </div>
        </li>`;
    })
    .join('');
}

function submitComment(event) {
  event.preventDefault();
  if (!currentGameId) return;

  if (!currentUser) {
    openAuth('login', '登录后才能发表评论。', els.commentLoginBtn);
    return;
  }

  const text = els.commentText.value.trim();
  if (!text) {
    els.commentError.textContent = '写点什么再发吧。';
    els.commentError.hidden = false;
    els.commentText.focus();
    return;
  }

  const list = comments[currentGameId] || (comments[currentGameId] = []);
  list.unshift({
    id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    author: currentUser,          // 作者就是当前登录账号
    owner: currentUser,           // 用来判断「这条评论能不能删」
    text: text.slice(0, 200),
    time: Date.now()
  });

  if (!saveComments()) {
    list.shift();                 // 存不下就回滚
    els.commentError.textContent = '保存失败：浏览器本地存储空间不够了。';
    els.commentError.hidden = false;
    return;
  }

  els.commentText.value = '';
  els.commentCounter.textContent = '0/200';
  els.commentError.hidden = true;

  renderComments(currentGameId);
  renderGrid();                   // 卡片上的评论数也要变
  showToast('评论已发布');
}

function deleteComment(id) {
  if (!currentGameId) return;

  if (!currentUser) {
    openAuth('login', '登录后才能删除评论。');
    return;
  }

  const list = comments[currentGameId] || [];
  const target = list.find((c) => c.id === id);
  if (!target) return;

  // 早期没有 owner 的评论不限制；新评论只能删自己的
  if (target.owner && target.owner !== currentUser) {
    showToast('只能删除自己的评论');
    return;
  }

  if (!window.confirm('删除这条评论？')) return;

  const rest = list.filter((c) => c.id !== id);
  if (rest.length) {
    comments[currentGameId] = rest;
  } else {
    delete comments[currentGameId];
  }
  saveComments();

  renderComments(currentGameId);
  renderGrid();
  showToast('评论已删除');
}

/* ---------- 收藏：存到浏览器的 localStorage ---------- */
function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set(); // 隐私模式等情况下读不到，就当作空收藏
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify([...favorites]));
  } catch {
    /* 存不了就算了，不影响本次浏览 */
  }
}

function isFavorite(id) {
  return favorites.has(id);
}

function toggleFavorite(id) {
  if (favorites.has(id)) {
    favorites.delete(id);
  } else {
    favorites.add(id);
  }
  saveFavorites();
  render();                 // 卡片上的心形和「收藏」计数要更新
  if (currentGameId === id) {
    syncModalFav();         // 弹窗开着的话，按钮文字也要变
  }
}

/* ---------- 筛选 + 排序 ---------- */
function getVisibleGames() {
  const kw = state.keyword.trim().toLowerCase();

  let list = allGames.filter((game) => {
    // 分类
    if (state.category === FAV_CATEGORY) {
      if (!isFavorite(game.id)) return false;
    } else if (state.category !== ALL && game.category !== state.category) {
      return false;
    }

    // 关键词：中文名 / 英文名 / 分类 / 标签 都参与匹配
    if (!kw) return true;
    const haystack = [game.title, game.titleEn, game.category, ...game.tags]
      .join(' ')
      .toLowerCase();
    return haystack.includes(kw);
  });

  // 排序（sort 返回新数组，不改原数据）
  list = [...list].sort((a, b) => {
    if (state.sort === 'year') return b.year - a.year;
    if (state.sort === 'name') return a.title.localeCompare(b.title, 'zh-Hans-CN');
    return b.rating - a.rating;
  });

  return list;
}

/* ---------- 渲染：分类按钮 ---------- */
function renderFilters() {
  const categories = [ALL, ...new Set(allGames.map((g) => g.category)), FAV_CATEGORY];

  els.filters.innerHTML = categories
    .map((cat) => {
      const count =
        cat === ALL
          ? allGames.length
          : cat === FAV_CATEGORY
            ? favorites.size
            : allGames.filter((g) => g.category === cat).length;

      const active = state.category === cat ? ' active' : '';
      const label = cat === FAV_CATEGORY ? '❤ 我的收藏' : escapeHtml(cat);
      return `<button class="chip${active}" type="button" data-category="${escapeHtml(cat)}">
                ${label}<span class="count">${count}</span>
              </button>`;
    })
    .join('');
}

/* ---------- 渲染：卡片列表 ---------- */
function renderGrid() {
  const list = getVisibleGames();

  els.grid.innerHTML = list
    .map((game) => {
      const fav = isFavorite(game.id);
      const tags = game.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');
      const title = escapeHtml(game.title);

      // 有上传图就显示图片，没有就退回 emoji + 渐变
      const cover = game.cover
        ? `<img class="card-img" src="${game.cover}" alt="" loading="lazy" />`
        : `<span class="card-emoji" aria-hidden="true">${escapeHtml(game.emoji)}</span>`;

      const totalComments = commentCountOf(game.id);

      return `
        <article class="card" style="--c1:${game.colors[0]};--c2:${game.colors[1]}">
          <button class="card-open" type="button" data-open="${game.id}"
                  aria-label="查看《${title}》详情"></button>
          <div class="card-cover${game.cover ? ' has-img' : ''}">
            ${cover}
            <span class="rating">★ ${game.rating.toFixed(1)}</span>
            ${game.custom ? '<span class="custom-badge">自定义</span>' : ''}
            <button class="fav" type="button" data-fav="${game.id}"
                    aria-pressed="${fav}" aria-label="收藏《${title}》">
              ${fav ? '❤️' : '🤍'}
            </button>
          </div>
          <div class="card-body">
            <h3 class="card-title">${title}</h3>
            <p class="card-sub">${escapeHtml(game.titleEn)}</p>
            <div class="tags">${tags}</div>
            <div class="card-meta">
              <span class="platforms">${escapeHtml(game.platforms)}</span>
              ${totalComments ? `<span class="comment-count">💬 ${totalComments}</span>` : ''}
              <span>${game.year}</span>
            </div>
          </div>
        </article>`;
    })
    .join('');

  // 空状态
  els.empty.hidden = list.length > 0;

  // 结果数量
  const scope = state.category === ALL ? '' : ` · ${state.category}`;
  const kw = state.keyword.trim() ? ` · 搜索「${state.keyword.trim()}」` : '';
  els.resultCount.textContent = `共 ${list.length} 款游戏${scope}${kw}`;
}

/* ---------- 渲染：顶部统计 ---------- */
function renderStats() {
  const avg = allGames.reduce((sum, g) => sum + g.rating, 0) / (allGames.length || 1);
  const items = [
    [allGames.length, '款游戏'],
    [new Set(allGames.map((g) => g.category)).size, '个分类'],
    [avg.toFixed(1), '平均分']
  ];

  els.stats.innerHTML = items
    .map(([num, label]) => `<li><b>${num}</b><span>${label}</span></li>`)
    .join('');
}

/* ---------- 渲染总入口 ---------- */
function render() {
  renderFilters();
  renderGrid();
}

/* ---------- 详情弹窗 ---------- */
function openModal(id, trigger) {
  const game = allGames.find((g) => g.id === id);
  if (!game) return;

  currentGameId = id;
  lastTrigger = trigger || null;

  // 把当前游戏写进地址栏（#g=eldenring），这样链接可以直接分享给朋友
  try {
    history.replaceState(null, '', `#g=${id}`);
  } catch {
    /* file:// 等环境可能不允许，忽略 */
  }

  els.modalCover.style.setProperty('--c1', game.colors[0]);
  els.modalCover.style.setProperty('--c2', game.colors[1]);
  els.modalCover.innerHTML = game.cover
    ? `<img class="modal-img" src="${game.cover}" alt="" />`
    : `<span>${escapeHtml(game.emoji)}</span>`;
  els.modalTitle.textContent = game.title;
  els.modalSub.textContent = game.titleEn + (game.custom ? ' · 自定义游戏' : '');
  els.modalRating.textContent = `★ ${game.rating.toFixed(1)} / 10`;
  els.modalDesc.textContent = game.desc || '还没有写介绍。';
  els.modalTags.innerHTML = game.tags
    .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
    .join('');
  els.modalMeta.innerHTML = `
    <div><dt>平台</dt><dd>${escapeHtml(game.platforms)}</dd></div>
    <div><dt>发行年份</dt><dd>${game.year}</dd></div>
    <div><dt>类型</dt><dd>${escapeHtml(game.category)}</dd></div>`;

  els.modalDelete.hidden = false;
  els.modalDelete.textContent = game.custom ? '删除这款游戏' : '从列表移除（可恢复）';

  syncModalFav();

  // 评论：渲染列表，并根据登录状态显示输入框或登录提示
  renderComments(game.id);
  refreshCommentGate();
  els.commentText.value = '';
  els.commentCounter.textContent = '0/200';
  els.commentError.hidden = true;

  els.modal.hidden = false;
  document.body.style.overflow = 'hidden'; // 防止背景跟着滚动
  // 把焦点移进弹窗（方便键盘操作），但不要给关闭按钮画上焦点框
  els.modal.querySelector('.modal-card').focus();
}

function syncModalFav() {
  const fav = isFavorite(currentGameId);
  els.modalFav.classList.toggle('is-fav', fav);
  els.modalFav.textContent = fav ? '❤️ 已收藏' : '🤍 收藏这款游戏';
}

function closeModal() {
  if (els.modal.hidden) return;
  els.modal.hidden = true;
  document.body.style.overflow = '';
  currentGameId = null;

  clearHash();

  if (lastTrigger) lastTrigger.focus();
}

/* ---------- 添加游戏：表单 ---------- */
function openForm(trigger) {
  formTrigger = trigger || null;
  els.form.reset();                       // 清空上一次填的内容
  els.form.elements.year.value = new Date().getFullYear();
  els.formError.hidden = true;
  resetCover();

  // 分类下拉框的候选值，来自现有游戏
  const categories = [...new Set(allGames.map((g) => g.category))];
  els.categoryOptions.innerHTML = categories
    .map((c) => `<option value="${escapeHtml(c)}"></option>`)
    .join('');

  // 先改地址栏再聚焦：顺序反了的话，改 hash 会把刚设置好的焦点清掉
  try {
    history.replaceState(null, '', '#add');
  } catch {
    /* 忽略 */
  }

  els.formModal.hidden = false;
  document.body.style.overflow = 'hidden';

  // 等下一帧再聚焦：元素刚显示出来时立刻 focus() 有时会被浏览器忽略
  requestAnimationFrame(() => {
    els.formModal.querySelector('.form-card').focus();
    els.form.elements.title.focus();      // 直接把光标放进「游戏名」
  });
}

function closeForm() {
  if (els.formModal.hidden) return;
  els.formModal.hidden = true;
  document.body.style.overflow = '';
  clearHash();
  if (formTrigger) formTrigger.focus();
}

/* ---------- 封面图片：选择、压缩、预览 ---------- */
const COVER_HINT = 'JPG / PNG / WebP，会自动压缩到 800px 以内再存进浏览器。';

// 没选图片时，预览框里显示当前 emoji
function syncCoverPreview() {
  if (pendingCover) return;
  const emoji = els.form.elements.emoji.value.trim() || '🎮';
  els.coverPreview.innerHTML = `<span>${escapeHtml(emoji)}</span>`;
}

function showCoverPreview(dataUrl) {
  els.coverPreview.innerHTML = `<img src="${dataUrl}" alt="封面预览" />`;
}

function resetCover() {
  pendingCover = '';
  els.coverInput.value = '';
  els.clearCoverBtn.hidden = true;
  els.uploadHint.textContent = COVER_HINT;
  syncCoverPreview();
}

// 把文件读成 <img>，方便后面画到 canvas 上
function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片解码失败'));
    };
    img.src = url;
  });
}

/**
 * 压缩图片：
 * localStorage 只有 5MB 左右，原图直接塞进去很快就满了，
 * 所以先用 canvas 缩小，再转成 webp（不支持就退回 jpg）。
 * 依次尝试几档尺寸，压到 300KB 以内就停。
 */
async function compressImage(file) {
  const img = await loadImageFile(file);
  const attempts = [
    { max: 800, quality: 0.82 },
    { max: 560, quality: 0.72 },
    { max: 420, quality: 0.6 }
  ];

  let result = null;
  for (const { max, quality } of attempts) {
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    let dataUrl = canvas.toDataURL('image/webp', quality);
    if (!dataUrl.startsWith('data:image/webp')) {
      // 少数浏览器不支持 webp，退回 jpg
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    result = { dataUrl, width, height };
    if (dataUrl.length * 0.75 < 300 * 1024) break; // 小于 300KB 就够用了
  }

  return result;
}

async function handleCoverPick(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';              // 清空 value，才能连续选同一张图
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showFormError('只能上传图片文件（JPG / PNG / WebP / GIF）。');
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    showFormError('图片超过 15MB，换一张小一点的吧。');
    return;
  }

  els.uploadHint.textContent = '正在压缩…';
  try {
    const { dataUrl, width, height } = await compressImage(file);
    pendingCover = dataUrl;
    showCoverPreview(dataUrl);
    els.clearCoverBtn.hidden = false;
    els.formError.hidden = true;
    els.uploadHint.textContent = `已压缩为 ${width}×${height}，约 ${Math.round((dataUrl.length * 0.75) / 1024)} KB`;
  } catch {
    els.uploadHint.textContent = COVER_HINT;
    showFormError('这张图片读不出来，换一张试试。');
  }
}

function showFormError(message) {
  els.formError.textContent = message;
  els.formError.hidden = false;
}

// 按下「保存并收录」
function handleFormSubmit(event) {
  event.preventDefault();

  const data = new FormData(els.form);
  const title = String(data.get('title') || '').trim();
  const rating = Number(data.get('rating'));
  const year = Number(data.get('year'));

  if (!title) {
    showFormError('游戏名是必填的，先给它起个名字吧。');
    els.form.elements.title.focus();
    return;
  }
  if (!Number.isFinite(rating) || rating < 0 || rating > 10) {
    showFormError('评分要填 0 到 10 之间的数字。');
    els.form.elements.rating.focus();
    return;
  }
  if (!Number.isInteger(year) || year < 1950 || year > 2100) {
    showFormError('发行年份填一个 1950–2100 之间的整数。');
    els.form.elements.year.focus();
    return;
  }

  const game = {
    id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    titleEn: String(data.get('titleEn') || '').trim(),
    category: String(data.get('category') || '').trim() || '其他',
    tags: String(data.get('tags') || '')
      .split(/[,，、;；\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 6),
    rating: Math.round(rating * 10) / 10,
    year,
    platforms: String(data.get('platforms') || '').trim() || '未知',
    emoji: String(data.get('emoji') || '').trim() || '🎮',
    colors: [data.get('color1'), data.get('color2')],
    cover: pendingCover,             // 没选图片就是空字符串
    desc: String(data.get('desc') || '').trim(),
    owner: currentUser,              // 记下是谁添加的
    custom: true
  };

  customGames.unshift(game);   // 新的放最前面

  // 存之前先试一下：图片多了可能把 localStorage 撑爆
  if (!saveCustomGames()) {
    customGames.shift();       // 回滚，别让内存里多出一条存不下的数据
    showFormError('保存失败：浏览器本地存储空间不够了。删掉几个带图片的游戏，或换一张更小的图再试。');
    return;
  }

  rebuildGames();
  closeForm();

  // 切回「全部」并按年份排序，保证刚加的游戏一眼就能看到
  state.category = ALL;
  state.keyword = '';
  state.sort = 'year';
  els.searchInput.value = '';
  els.sortSelect.value = 'year';
  renderStats();
  render();

  showToast(`已添加《${title}》`);
}

// 删除 / 隐藏当前打开的游戏
function deleteCurrentGame() {
  const game = allGames.find((g) => g.id === currentGameId);
  if (!game) return;

  // 删除是修改内容的操作，也要求先登录
  if (!currentUser) {
    closeModal();
    openAuth('login', '登录后才能删除游戏。');
    return;
  }

  // 自己加的游戏：真删
  if (game.custom) {
    const ok = window.confirm(`确定要删除《${game.title}》吗？删除后无法恢复。`);
    if (!ok) return;

    customGames = customGames.filter((g) => g.id !== game.id);
    const saved = saveCustomGames();

    // 游戏没了，它的评论也别留着占地方
    if (comments[game.id]) {
      delete comments[game.id];
      saveComments();
    }

    rebuildGames();
    ensureCategoryExists();
    closeModal();
    renderStats();
    render();
    showToast(saved ? `已删除《${game.title}》` : '删除失败：浏览器存储异常');
    return;
  }

  // 内置游戏写在 data.js 里，页面上删不掉，所以改成「隐藏」，并且可以撤销
  const ok = window.confirm(
    `《${game.title}》是内置游戏，不能真的删掉，但可以从列表里隐藏。\n\n` +
      `之后还能在页脚「恢复已隐藏的游戏」里找回来。确定隐藏吗？`
  );
  if (!ok) return;

  hiddenIds.add(game.id);
  saveHiddenGames();
  rebuildGames();
  ensureCategoryExists();
  closeModal();
  renderStats();
  render();
  updateRestoreEntry();

  showToast(`已隐藏《${game.title}》`, {
    actionLabel: '撤销',
    onAction: () => restoreGame(game.id)
  });
}

// 如果当前分类里最后一个游戏被删/藏了，就退回「全部」
function ensureCategoryExists() {
  if (state.category === ALL || state.category === FAV_CATEGORY) return;
  if (!allGames.some((g) => g.category === state.category)) {
    state.category = ALL;
  }
}

function updateRestoreEntry() {
  els.restoreBtn.hidden = hiddenIds.size === 0;
  els.restoreBtn.textContent = `恢复已隐藏的游戏（${hiddenIds.size}）`;
}

function restoreGame(id) {
  if (!hiddenIds.has(id)) return;
  hiddenIds.delete(id);
  saveHiddenGames();
  rebuildGames();
  renderStats();
  render();
  updateRestoreEntry();
  showToast('已恢复到列表');
}

function restoreAllHidden() {
  const games = [...hiddenIds].map((id) => GAMES.find((g) => g.id === id)).filter(Boolean);
  if (!games.length) {
    hiddenIds.clear();
    saveHiddenGames();
    updateRestoreEntry();
    return;
  }

  const names = games.map((g) => `《${g.title}》`).join('、');
  if (!window.confirm(`把 ${games.length} 款游戏放回列表？\n\n${names}`)) return;

  hiddenIds.clear();
  saveHiddenGames();
  rebuildGames();
  renderStats();
  render();
  updateRestoreEntry();
  showToast(`已恢复 ${games.length} 款游戏`);
}

/* ---------- 地址栏 hash ---------- */
function clearHash() {
  try {
    history.replaceState(null, '', location.href.split('#')[0]);
  } catch {
    /* 忽略 */
  }
}

/* ---------- 事件绑定 ---------- */
// 分类切换（用事件委托：按钮是动态生成的，绑在父元素上更省事）
els.filters.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-category]');
  if (!chip) return;
  state.category = chip.dataset.category;
  render();
});

// 搜索（input 事件 = 每次输入都触发）
els.searchInput.addEventListener('input', (e) => {
  state.keyword = e.target.value;
  renderGrid();
});

// 排序
els.sortSelect.addEventListener('change', (e) => {
  state.sort = e.target.value;
  renderGrid();
});

// 卡片区域：查看详情 / 收藏
els.grid.addEventListener('click', (e) => {
  const favBtn = e.target.closest('[data-fav]');
  if (favBtn) {
    toggleFavorite(favBtn.dataset.fav);
    return;
  }

  const openBtn = e.target.closest('[data-open]');
  if (openBtn) {
    openModal(openBtn.dataset.open, openBtn);
  }
});

// 详情弹窗内：关闭 / 收藏 / 删除
els.modal.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) {
    closeModal();
    return;
  }
  if (e.target.closest('#modalFav')) {
    toggleFavorite(currentGameId);
    return;
  }
  if (e.target.closest('#modalDelete')) {
    deleteCurrentGame();
  }
});

// 评论：发表 / 统计字数 / Ctrl+Enter 快捷发送 / 删除
els.commentForm.addEventListener('submit', submitComment);

els.commentText.addEventListener('input', (e) => {
  els.commentCounter.textContent = `${e.target.value.length}/200`;
  els.commentError.hidden = true;
});

els.commentText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    els.commentForm.requestSubmit();
  }
});

els.commentList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-del-comment]');
  if (btn) deleteComment(btn.dataset.delComment);
});

// 打开添加表单（先检查登录）
els.addGameBtn.addEventListener('click', () => {
  if (!currentUser) {
    openAuth('login', '登录后才能添加游戏。', els.addGameBtn);
    return;
  }
  openForm(els.addGameBtn);
});
els.formModal.addEventListener('click', (e) => {
  if (e.target.closest('[data-close-form]')) closeForm();
});
els.form.addEventListener('submit', handleFormSubmit);

// 封面上传
els.pickCoverBtn.addEventListener('click', () => els.coverInput.click());
els.coverInput.addEventListener('change', handleCoverPick);
els.clearCoverBtn.addEventListener('click', resetCover);
els.form.elements.emoji.addEventListener('input', syncCoverPreview);

// 提示条上的「撤销」按钮
els.toastAction.addEventListener('click', () => {
  const action = toastActionHandler;
  toastActionHandler = null;
  clearTimeout(toastTimer);
  els.toast.hidden = true;
  if (action) action();
});

// 页脚的「恢复已隐藏的游戏」
els.restoreBtn.addEventListener('click', restoreAllHidden);

// 登录 / 注册
els.authForm.addEventListener('submit', handleAuthSubmit);

els.authModal.addEventListener('click', (e) => {
  if (e.target.closest('[data-close-auth]')) {
    closeAuth();
    return;
  }
  const tab = e.target.closest('[data-auth-tab]');
  if (tab) setAuthMode(tab.dataset.authTab);
});

// 顶部的登录 / 退出按钮（内容是动态渲染的，所以用事件委托）
els.authArea.addEventListener('click', (e) => {
  const loginBtn = e.target.closest('#loginBtn');
  if (loginBtn) {
    openAuth('login', '', loginBtn);
    return;
  }
  if (e.target.closest('#logoutBtn')) endSession();
});

// 评论区里的「登录 / 注册」按钮
els.commentLoginBtn.addEventListener('click', () => {
  openAuth('login', '登录后才能发表评论。', els.commentLoginBtn);
});

// 键盘 Esc：按「登录 → 表单 → 详情」的顺序关
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!els.authModal.hidden) {
    closeAuth();
  } else if (!els.formModal.hidden) {
    closeForm();
  } else {
    closeModal();
  }
});

/* ---------- 启动 ---------- */
renderStats();
render();
updateRestoreEntry();
renderAuthArea();

// 支持直接打开带游戏 id 的链接，例如 index.html#g=minecraft
const deepLink = location.hash.match(/^#g=([\w-]+)$/);
if (deepLink) {
  openModal(deepLink[1], null);
} else if (location.hash === '#add') {
  if (currentUser) {
    openForm(null);   // index.html#add 可以直接打开添加表单
  } else {
    openAuth('login', '登录后才能添加游戏。');
  }
}
