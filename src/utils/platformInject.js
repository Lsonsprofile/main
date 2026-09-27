/**
 * Snippets injected into full custom HTML documents (server-side only).
 * Does not change the saved htmlSource in the database.
 */

function buildThemeBootstrap(req) {
  const user = req.session && req.session.user ? req.session.user : null;
  const theme = user && user.theme === 'dark' ? 'dark' : 'light';
  return (
    '<script>try{document.documentElement.setAttribute("data-theme","' +
    theme +
    '");}catch(e){}</script>'
  );
}

function buildAuthBootstrap(req) {
  const user = req.session && req.session.user ? req.session.user : null;
  const payload = {
    loggedIn: Boolean(user),
    name: user && user.name ? String(user.name) : '',
    role: user && user.role ? String(user.role) : '',
    isAdmin: Boolean(user && user.role === 'admin'),
    csrfToken: (function () {
      try {
        if (!req.session) return '';
        if (!req.session.csrfToken) {
          req.session.csrfToken = require('crypto').randomBytes(24).toString('hex');
        }
        return String(req.session.csrfToken || '');
      } catch (e) {
        return '';
      }
    })(),
  };
  return (
    '<script>window.__AUTH__=' +
    JSON.stringify(payload).replace(/</g, '\\u003c') +
    ';</script>'
  );
}


/**
 * Floating Profile + Settings for logged-in non-admin users.
 */

/**
 * Mark complete control for logged-in users on custom HTML pages.
 */
function buildProgressWidget(req, page) {
  const user = req.session && req.session.user ? req.session.user : null;
  if (!user || !page || !page.slug) return '';

  // Homepage uses / as public URL but progress API is keyed by slug
  const slug = String(page.slug);
  const isHome = slug === 'home';

  return (
    '<style id="platform-progress-style">' +
    '#platform-progress{position:fixed;bottom:1.25rem;left:50%;transform:translateX(-50%);z-index:2147483644;' +
    'font-family:system-ui,-apple-system,sans-serif;pointer-events:none}' +
    '#platform-progress-inner{pointer-events:auto;display:flex;align-items:center;gap:0.55rem;' +
    'padding:0.55rem 0.85rem;border-radius:999px;background:#0f172a;color:#f8fafc;' +
    'box-shadow:0 10px 28px rgba(15,23,42,.35);border:1px solid rgba(255,255,255,.12);' +
    'font:600 0.8rem/1.2 system-ui,sans-serif}' +
    '#platform-progress-btn{border:0;border-radius:999px;padding:0.45rem 0.9rem;cursor:pointer;' +
    'font:700 0.78rem/1 system-ui,sans-serif;background:#22c55e;color:#052e16}' +
    '#platform-progress-btn:hover{filter:brightness(1.06)}' +
    '#platform-progress-btn:disabled{opacity:.65;cursor:wait}' +
    '#platform-progress-btn.is-done{background:#38bdf8;color:#0c4a6e}' +
    '#platform-progress-status{font-size:0.72rem;color:#94a3b8;max-width:12rem}' +
    '#platform-progress-status.is-ok{color:#86efac}' +
    '#platform-progress-status.is-err{color:#fca5a5}' +
    '@media (max-width:640px){#platform-progress{left:1.25rem;right:1.25rem;transform:none}' +
    '#platform-progress-inner{width:100%;justify-content:space-between}}' +
    '@media print{#platform-progress{display:none}}' +
    '</style>' +
    '<div id="platform-progress" data-slug="' + escapeAttr(slug) + '">' +
    '<div id="platform-progress-inner">' +
    '<button type="button" id="platform-progress-btn">Mark complete</button>' +
    '<span id="platform-progress-status">Checking…</span>' +
    '</div></div>' +
    '<script>(function(){' +
    'var root=document.getElementById("platform-progress");' +
    'if(!root)return;' +
    'var slug=root.getAttribute("data-slug")||"";' +
    'var btn=document.getElementById("platform-progress-btn");' +
    'var status=document.getElementById("platform-progress-status");' +
    'var busy=false;var completed=false;' +
    'function setStatus(text,kind){if(!status)return;status.textContent=text||"";' +
    'status.className="";if(kind)status.classList.add("is-"+kind);}' +
    'function paint(){' +
    'if(completed){btn.textContent="Completed ✓";btn.classList.add("is-done");' +
    'setStatus("You finished this page","ok");}' +
    'else{btn.textContent="Mark complete";btn.classList.remove("is-done");' +
    'setStatus("Mark when you finish","ok");}' +
    '}' +
    'function load(){' +
    'fetch("/lesson/"+encodeURIComponent(slug)+"/progress",{credentials:"same-origin",headers:{Accept:"application/json","X-Requested-With":"XMLHttpRequest","X-CSRF-Token":((window.__AUTH__&&window.__AUTH__.csrfToken)||"")}})' +
    '.then(function(r){return r.json().then(function(d){return{r:r,d:d};});})' +
    '.then(function(x){' +
    'if(x.r.status===401){setStatus("Log in to track progress","err");btn.disabled=true;return;}' +
    'if(!x.d||!x.d.ok){setStatus((x.d&&x.d.error)||"Could not load","err");return;}' +
    'completed=!!x.d.completed;btn.disabled=false;paint();' +
    '}).catch(function(){setStatus("Could not load progress","err");});' +
    '}' +
    'btn.addEventListener("click",function(){' +
    'if(busy)return;busy=true;btn.disabled=true;' +
    'var path=completed?"/incomplete":"/complete";' +
    'setStatus(completed?"Updating…":"Saving…","");' +
    'fetch("/lesson/"+encodeURIComponent(slug)+path,{' +
    'method:"POST",credentials:"same-origin",' +
    'headers:{Accept:"application/json","Content-Type":"application/json","X-Requested-With":"XMLHttpRequest"},' +
    'body:JSON.stringify({_csrf:((window.__AUTH__&&window.__AUTH__.csrfToken)||"")})' +
    '}).then(function(r){return r.json().then(function(d){return{r:r,d:d};});})' +
    '.then(function(x){' +
    'busy=false;btn.disabled=false;' +
    'if(!x.d||!x.d.ok){setStatus((x.d&&x.d.error)||"Update failed","err");return;}' +
    'completed=!!x.d.completed;paint();' +
    'setStatus(completed?"Saved as complete":"Marked incomplete","ok");' +
    '}).catch(function(){busy=false;btn.disabled=false;setStatus("Network error","err");});' +
    '});' +
    'load();' +
    '})();</script>'
  );
}

function buildUserFab(req) {
  const user = req.session && req.session.user ? req.session.user : null;
  if (!user || user.role === 'admin') return '';

  return (
    '<style id="platform-user-fab-style">' +
    '#platform-user-fab{position:fixed;bottom:1.25rem;right:1.25rem;z-index:2147483646;' +
    'display:flex;flex-direction:column;gap:0.45rem;align-items:flex-end;' +
    'font-family:system-ui,-apple-system,sans-serif;pointer-events:none}' +
    '#platform-user-fab a{pointer-events:auto;display:inline-flex;align-items:center;gap:0.4rem;' +
    'padding:0.6rem 0.95rem;border-radius:999px;text-decoration:none;font:700 0.78rem/1 system-ui,sans-serif;' +
    'box-shadow:0 8px 22px rgba(15,23,42,.28);border:1px solid rgba(255,255,255,.12);opacity:.94;' +
    'transition:opacity .15s,transform .15s}' +
    '#platform-user-fab a:hover{opacity:1;transform:translateY(-2px)}' +
    '#platform-user-fab .puf-profile{background:#0f172a;color:#f8fafc}' +
    '#platform-user-fab .puf-settings{background:#0369a1;color:#fff}' +
    '@media print{#platform-user-fab{display:none!important}}' +
    '</style>' +
    '<div id="platform-user-fab">' +
    '<a class="puf-settings" href="/account/settings" title="Settings & profile">⚙ Settings</a>' +
    '</div>'
  );
}

function buildAdminFab(req) {
  const user = req.session && req.session.user ? req.session.user : null;
  if (!user || user.role !== 'admin') return '';

  return (
    '<style id="platform-admin-fab-style">' +
    '#platform-admin-fab{position:fixed;bottom:1.25rem;right:1.25rem;z-index:2147483646;' +
    'display:inline-flex;align-items:center;gap:0.4rem;padding:0.65rem 1rem;' +
    'border-radius:999px;background:#0f172a;color:#f8fafc;font:700 0.8rem/1 system-ui,sans-serif;' +
    'text-decoration:none;box-shadow:0 8px 24px rgba(15,23,42,.35);border:1px solid rgba(255,255,255,.15);' +
    'opacity:.92;transition:opacity .15s ease,transform .15s ease;cursor:pointer}' +
    '#platform-admin-fab:hover{opacity:1;transform:translateY(-2px);background:#1e293b}' +
    '#platform-admin-fab span{font-size:1rem;line-height:1}' +
    '@media print{#platform-admin-fab{display:none!important}}' +
    '</style>' +
    '<a id="platform-admin-fab" href="/admin" title="Open admin dashboard">' +
    '<span aria-hidden="true">⌂</span> Dashboard' +
    '</a>'
  );
}

/**
 * Floating live chat for logged-in users on custom HTML pages.
 * Uses existing Socket.io chat rooms keyed by page id.
 */
function buildChatWidget(req, page) {
  const user = req.session && req.session.user ? req.session.user : null;
  if (!user || !page || !page._id) return '';

  const pageId = String(page._id);
  const userId = String(user._id);
  const userName = String(user.name || user.email || 'User').slice(0, 80);
  const isAdmin = user.role === 'admin';

  // Compact floating chat — collapsed by default so it does not cover the page.
  // Unread badge on the toggle when the panel is folded.
  const css =
    '<style id="platform-chat-style">' +
    '#platform-chat-root{position:fixed;bottom:1.25rem;left:1.25rem;z-index:2147483645;' +
    'font-family:system-ui,-apple-system,sans-serif;pointer-events:none}' +
    '#platform-chat-root>*{pointer-events:auto}' +
    '#platform-chat-toggle{position:relative;display:inline-flex;align-items:center;gap:0.45rem;' +
    'padding:0.65rem 1rem;border-radius:999px;background:#0284c7;color:#fff;' +
    'font:700 0.8rem/1 system-ui,sans-serif;border:0;cursor:pointer;' +
    'box-shadow:0 8px 24px rgba(2,132,199,.35)}' +
    '#platform-chat-toggle:hover{background:#0369a1}' +
    '#platform-chat-badge{display:none;position:absolute;top:-6px;right:-6px;min-width:1.25rem;height:1.25rem;' +
    'padding:0 0.35rem;border-radius:999px;background:#ef4444;color:#fff;font:800 0.7rem/1.25rem system-ui,sans-serif;' +
    'text-align:center;box-shadow:0 2px 8px rgba(239,68,68,.5);border:2px solid #fff}' +
    '#platform-chat-badge.is-on{display:inline-block}' +
    '#platform-chat-panel{display:none;flex-direction:column;width:min(20rem,calc(100vw - 2.5rem));' +
    'height:min(22rem,55vh);max-height:55vh;background:#0f172a;color:#e2e8f0;border-radius:14px;overflow:hidden;' +
    'box-shadow:0 16px 40px rgba(15,23,42,.45);border:1px solid #334155;margin-bottom:0.55rem}' +
    '#platform-chat-root.is-open #platform-chat-panel{display:flex}' +
    '#platform-chat-head{display:flex;align-items:center;justify-content:space-between;gap:0.5rem;' +
    'padding:0.65rem 0.85rem;background:#1e293b;border-bottom:1px solid #334155}' +
    '#platform-chat-head strong{font-size:0.85rem}' +
    '#platform-chat-status{font-size:0.7rem;font-weight:700;color:#94a3b8}' +
    '#platform-chat-status[data-state="online"]{color:#4ade80}' +
    '#platform-chat-status[data-state="offline"]{color:#f87171}' +
    '#platform-chat-close{border:0;background:transparent;color:#94a3b8;font-size:1.1rem;cursor:pointer;line-height:1;padding:0.15rem}' +
    '#platform-chat-close:hover{color:#f8fafc}' +
    '#platform-chat-msgs{flex:1;overflow:auto;padding:0.65rem;display:flex;flex-direction:column;gap:0.45rem;background:#0b1220}' +
    '.pc-msg{max-width:90%;padding:0.4rem 0.6rem;border-radius:10px;background:#1e293b;font-size:0.78rem;line-height:1.4}' +
    '.pc-msg.is-mine{align-self:flex-end;background:#0e7490;color:#ecfeff}' +
    '.pc-msg-meta{font-size:0.65rem;font-weight:700;opacity:.8;margin-bottom:0.12rem}' +
    '#platform-chat-form{display:flex;gap:0.35rem;padding:0.55rem;border-top:1px solid #334155;background:#1e293b}' +
    '#platform-chat-input{flex:1;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#f8fafc;' +
    'padding:0.45rem 0.6rem;font-size:0.85rem;min-width:0}' +
    '#platform-chat-send{border:0;border-radius:8px;background:#0284c7;color:#fff;font-weight:700;padding:0.45rem 0.7rem;cursor:pointer}' +
    '#platform-chat-send:hover{background:#0369a1}' +
    '#platform-chat-err{color:#fca5a5;font-size:0.7rem;padding:0 0.65rem 0.35rem}' +
    '@media (max-width:480px){#platform-chat-panel{width:calc(100vw - 1.5rem);height:min(50vh,20rem)}}' +
    '@media print{#platform-chat-root{display:none!important}}' +
    (isAdmin ? '#platform-chat-root{bottom:4.75rem}' : '') +
    '</style>';

  const html =
    '<div id="platform-chat-root" data-page-id="' +
    escapeAttr(pageId) +
    '" data-user-id="' +
    escapeAttr(userId) +
    '" data-user-name="' +
    escapeAttr(userName) +
    '">' +
    '<div id="platform-chat-panel" role="dialog" aria-label="Live chat">' +
    '<div id="platform-chat-head">' +
    '<div><strong>Live chat</strong> <span id="platform-chat-status" data-state="offline">…</span></div>' +
    '<button type="button" id="platform-chat-close" title="Minimize chat" aria-label="Minimize chat">✕</button>' +
    '</div>' +
    '<div id="platform-chat-msgs" role="log" aria-live="polite"></div>' +
    '<div id="platform-chat-err" hidden></div>' +
    '<form id="platform-chat-form" autocomplete="off">' +
    '<input id="platform-chat-input" type="text" maxlength="1000" placeholder="Write a message…" required>' +
    '<button id="platform-chat-send" type="submit">Send</button>' +
    '</form>' +
    '</div>' +
    '<button type="button" id="platform-chat-toggle" aria-expanded="false" title="Open chat">' +
    '💬 Chat<span id="platform-chat-badge" aria-live="polite"></span>' +
    '</button>' +
    '</div>';

  const js =
    '<script src="/socket.io/socket.io.js" onerror="console.warn(\'chat: socket.io failed to load\')"><\/script>' +
    '<script>(function(){' +
    'var root=document.getElementById("platform-chat-root");' +
    'if(!root||typeof io==="undefined")return;' +
    'var pageId=root.getAttribute("data-page-id");' +
    'var userId=root.getAttribute("data-user-id");' +
    'var toggle=document.getElementById("platform-chat-toggle");' +
    'var closeBtn=document.getElementById("platform-chat-close");' +
    'var statusEl=document.getElementById("platform-chat-status");' +
    'var list=document.getElementById("platform-chat-msgs");' +
    'var form=document.getElementById("platform-chat-form");' +
    'var input=document.getElementById("platform-chat-input");' +
    'var errEl=document.getElementById("platform-chat-err");' +
    'var badge=document.getElementById("platform-chat-badge");' +
    'var seen={};var unread=0;' +
    'function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}' +
    'function isOpen(){return root.classList.contains("is-open");}' +
    'function setStatus(state,label){if(!statusEl)return;statusEl.setAttribute("data-state",state);statusEl.textContent=label;}' +
    'function showErr(m){if(!errEl)return;if(!m){errEl.hidden=true;errEl.textContent="";return;}errEl.hidden=false;errEl.textContent=m;}' +
    'function updateBadge(){' +
    'if(!badge)return;' +
    'if(unread>0&&!isOpen()){badge.textContent=unread>99?"99+":String(unread);badge.classList.add("is-on");badge.setAttribute("aria-label",unread+" new messages");}' +
    'else{badge.textContent="";badge.classList.remove("is-on");badge.removeAttribute("aria-label");}' +
    '}' +
    'function openChat(){root.classList.add("is-open");toggle.setAttribute("aria-expanded","true");unread=0;updateBadge();if(input)input.focus();}' +
    'function closeChat(){root.classList.remove("is-open");toggle.setAttribute("aria-expanded","false");updateBadge();}' +
    'function addMsg(msg,fromHistory){' +
    'if(!list||!msg)return;var id=String(msg.id||msg._id||"");if(id&&seen[id])return;if(id)seen[id]=1;' +
    'var mine=String(msg.userId)===String(userId);' +
    'var row=document.createElement("div");row.className="pc-msg"+(mine?" is-mine":"");' +
    'row.innerHTML=\'<div class="pc-msg-meta">\'+esc(msg.userName||"User")+"</div><div>"+esc(msg.body)+"</div>";' +
    'list.appendChild(row);list.scrollTop=list.scrollHeight;' +
    // Notify only for live messages from others while folded
    'if(!fromHistory&&!mine&&!isOpen()){unread+=1;updateBadge();' +
    'try{if(document.hidden&&typeof Notification==="undefined"){}' +
    'toggle.classList.add("pc-pulse");setTimeout(function(){toggle.classList.remove("pc-pulse");},1200);' +
    '}catch(e){}}' +
    '}' +
    'toggle.addEventListener("click",function(){if(isOpen())closeChat();else openChat();});' +
    'if(closeBtn)closeBtn.addEventListener("click",function(e){e.preventDefault();closeChat();});' +
    'var socket=io({path:"/socket.io",withCredentials:true,transports:["websocket","polling"]});' +
    'socket.on("connect",function(){setStatus("online","Online");' +
    'socket.emit("chat:join",{pageId:pageId},function(res){if(!res||!res.ok){showErr((res&&res.error)||"Could not join");setStatus("offline","Error");return;}' +
    'showErr("");(res.history||[]).forEach(function(m){addMsg(m,true);});});});' +
    'socket.on("disconnect",function(){setStatus("offline","Offline");});' +
    'socket.on("connect_error",function(){setStatus("offline","Offline");});' +
    'socket.on("chat:message",function(msg){addMsg(msg,false);});' +
    'form.addEventListener("submit",function(e){e.preventDefault();var body=(input.value||"").trim();if(!body)return;' +
    'socket.emit("chat:message",{pageId:pageId,body:body},function(res){if(!res||!res.ok){showErr((res&&res.error)||"Send failed");return;}' +
    'showErr("");input.value="";if(res.message)addMsg(res.message,true);});});' +
    '})();<\/script>' +
    '<style>#platform-chat-toggle.pc-pulse{animation:pcPulse .6s ease 2}' +
    '@keyframes pcPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}</style>';

  return css + html + js;
}

function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function injectEarly(html, snippet) {
  html = String(html || '');
  if (!snippet) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, function (m) {
      return m + snippet;
    });
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, function (m) {
      return m + snippet;
    });
  }
  return snippet + html;
}

function injectBeforeBodyClose(html, snippet) {
  html = String(html || '');
  if (!snippet) return html;
  // Use the LAST </body> so strings inside <script> do not swallow the real page
  const lower = html.toLowerCase();
  const idx = lower.lastIndexOf('</body>');
  if (idx !== -1) {
    return html.slice(0, idx) + snippet + html.slice(idx);
  }
  return html + snippet;
}

/**
 * @param {object} req
 * @param {string} htmlSource
 * @param {object} [page] - page document with _id (needed for chat)
 */
function prepareFullDocumentHtml(req, htmlSource, page) {
  let html = String(htmlSource || '');
  if (!html.trim()) {
    html =
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Empty</title></head>' +
      '<body style="margin:0;font-family:system-ui;padding:2rem;color:#64748b">' +
      '<p>No HTML yet. In Admin, paste or upload your full HTML, Save, then Publish.</p>' +
      '</body></html>';
  }
  html = html
    .replace(/window\.parent/g, 'window.self')
    .replace(/window\.top/g, 'window.self')
    .replace(/window\.frameElement/g, 'null');

  html = injectEarly(html, buildThemeBootstrap(req) + buildAuthBootstrap(req));
  const endBits = buildProgressWidget(req, page) + buildChatWidget(req, page) + buildUserFab(req) + buildAdminFab(req);
  html = injectBeforeBodyClose(html, endBits);
  return html;
}

module.exports = {
  buildAuthBootstrap,
  buildAdminFab,
  buildUserFab,
  buildProgressWidget,
  buildChatWidget,
  injectEarly,
  injectBeforeBodyClose,
  prepareFullDocumentHtml,
};
