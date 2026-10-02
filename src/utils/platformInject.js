/**
 * Platform widgets injected into full custom HTML documents (server-side only).
 */

'use strict';

const crypto = require('crypto');
const userModel = require('../models/userModel');

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sessionUser(req) {
  return req?.session?.user ?? null;
}

function ensureCsrf(req) {
  try {
    if (!req?.session) return '';
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(24).toString('hex');
    }
    return String(req.session.csrfToken || '');
  } catch {
    return '';
  }
}

function injectAfterOpenTag(html, tagPattern, snippet) {
  if (!snippet) return html;
  if (tagPattern.test(html)) {
    return html.replace(tagPattern, (match) => match + snippet);
  }
  return null;
}

function injectEarly(html, snippet) {
  html = String(html || '');
  if (!snippet) return html;
  return (
    injectAfterOpenTag(html, /<head[^>]*>/i, snippet) ??
    injectAfterOpenTag(html, /<body[^>]*>/i, snippet) ??
    snippet + html
  );
}

function injectBeforeBodyClose(html, snippet) {
  html = String(html || '');
  if (!snippet) return html;
  const idx = html.toLowerCase().lastIndexOf('</body>');
  if (idx !== -1) return html.slice(0, idx) + snippet + html.slice(idx);
  return html + snippet;
}

function buildThemeBootstrap(req, themeUser) {
  const user = themeUser || sessionUser(req);
  const theme = user?.theme === 'dark' ? 'dark' : 'light';
  return `<script>try{document.documentElement.setAttribute("data-theme","${theme}");}catch(e){}</script>`;
}

function buildAuthBootstrap(req, freshUser) {
  const session = sessionUser(req);
  const user = freshUser || session;
  const payload = {
    loggedIn: Boolean(user || session),
    name: user?.name ? String(user.name) : session?.name ? String(session.name) : '',
    role: user?.role ? String(user.role) : session?.role ? String(session.role) : '',
    isAdmin: Boolean((user || session)?.role === 'admin'),
    avatarUrl: user?.avatarUrl ? String(user.avatarUrl) : session?.avatarUrl ? String(session.avatarUrl) : '',
    csrfToken: ensureCsrf(req),
  };
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  return `<script>window.__AUTH__=${json};</script>`;
}

function buildUserFab(req) {
  const user = sessionUser(req);
  if (!user || user.role === 'admin') return '';
  const avatar = user.avatarUrl ? String(user.avatarUrl) : '';
  const initial = escapeAttr((user.name || 'U').charAt(0).toUpperCase());
  const photo = avatar
    ? `<img src="${escapeAttr(avatar)}" alt="" class="platform-user-fab-img">`
    : `<span class="platform-user-fab-fallback">${initial}</span>`;

  return `
<style id="platform-user-fab-style">
#platform-user-fab{position:fixed;bottom:1.25rem;right:1.25rem;z-index:2147483646;font-family:system-ui,sans-serif}
#platform-user-fab a{
  display:inline-flex;align-items:center;gap:.55rem;
  padding:.4rem .9rem .4rem .4rem;border-radius:999px;text-decoration:none;
  font:700 .8rem/1 system-ui,sans-serif;background:#0f172a;color:#f8fafc;
  box-shadow:0 8px 22px rgba(15,23,42,.28);border:1px solid rgba(255,255,255,.1)
}
.platform-user-fab-img,.platform-user-fab-fallback{
  width:2rem;height:2rem;border-radius:50%;object-fit:cover;display:grid;place-items:center;
  background:linear-gradient(135deg,#38bdf8,#6366f1);color:#fff;font:800 .75rem/1 system-ui,sans-serif;
  flex-shrink:0;border:2px solid rgba(255,255,255,.25)
}
.platform-user-fab-img{display:block}
@media print{#platform-user-fab{display:none}}
</style>
<div id="platform-user-fab">
  <a href="/account/settings" title="Settings & profile">${photo}<span>Profile</span></a>
</div>`;
}

function buildAdminFab(req) {
  const user = sessionUser(req);
  if (!user || user.role !== 'admin') return '';
  return `
<style id="platform-admin-fab-style">
#platform-admin-fab{position:fixed;bottom:1.25rem;right:1.25rem;z-index:2147483646;display:inline-flex;align-items:center;gap:.4rem;padding:.65rem 1rem;border-radius:999px;background:#0f172a;color:#f8fafc;font:700 .8rem/1 system-ui,sans-serif;text-decoration:none;box-shadow:0 8px 24px rgba(15,23,42,.35)}
@media print{#platform-admin-fab{display:none}}
</style>
<a id="platform-admin-fab" href="/admin" title="Admin dashboard">⌂ Dashboard</a>`;
}

function buildProgressWidget(req, page) {
  const user = sessionUser(req);
  if (!user || !page?.slug) return '';
  const slug = escapeAttr(page.slug);
  return `
<style id="platform-progress-style">
#platform-progress{position:fixed;bottom:1.25rem;left:50%;transform:translateX(-50%);z-index:2147483644;font-family:system-ui,sans-serif;pointer-events:none}
#platform-progress-inner{pointer-events:auto;display:flex;align-items:center;gap:.55rem;padding:.55rem .85rem;border-radius:999px;background:#0f172a;color:#f8fafc;box-shadow:0 10px 28px rgba(15,23,42,.35);border:1px solid rgba(255,255,255,.12);font:600 .8rem/1.2 system-ui,sans-serif}
#platform-progress-btn{border:0;border-radius:999px;padding:.45rem .9rem;cursor:pointer;font:700 .78rem/1 system-ui,sans-serif;background:#22c55e;color:#052e16}
#platform-progress-btn.is-done{background:#38bdf8;color:#0c4a6e}
#platform-progress-status{font-size:.72rem;color:#94a3b8}
@media print{#platform-progress{display:none}}
</style>
<div id="platform-progress" data-slug="${slug}">
  <div id="platform-progress-inner">
    <button type="button" id="platform-progress-btn">Mark complete</button>
    <span id="platform-progress-status">Checking…</span>
  </div>
</div>
<script>(function(){
  var root=document.getElementById("platform-progress");if(!root)return;
  var slug=root.getAttribute("data-slug")||"";
  var btn=document.getElementById("platform-progress-btn");
  var status=document.getElementById("platform-progress-status");
  var busy=false,completed=false;
  function token(){return (window.__AUTH__&&window.__AUTH__.csrfToken)||"";}
  function setStatus(t,k){if(!status)return;status.textContent=t||"";}
  function paint(){
    if(completed){btn.textContent="Completed ✓";btn.classList.add("is-done");setStatus("You finished this page");}
    else{btn.textContent="Mark complete";btn.classList.remove("is-done");setStatus("Mark when you finish");}
  }
  function load(){
    fetch("/lesson/"+encodeURIComponent(slug)+"/progress",{credentials:"same-origin",headers:{Accept:"application/json","X-Requested-With":"XMLHttpRequest","X-CSRF-Token":token()}})
    .then(function(r){return r.json().then(function(d){return{r:r,d:d};});})
    .then(function(x){
      if(x.r.status===401){setStatus("Log in to track progress");btn.disabled=true;return;}
      if(!x.d||!x.d.ok){setStatus((x.d&&x.d.error)||"Could not load");return;}
      completed=!!x.d.completed;btn.disabled=false;paint();
    }).catch(function(){setStatus("Could not load progress");});
  }
  btn.addEventListener("click",function(){
    if(busy)return;busy=true;btn.disabled=true;
    var path=completed?"/incomplete":"/complete";
    fetch("/lesson/"+encodeURIComponent(slug)+path,{method:"POST",credentials:"same-origin",headers:{Accept:"application/json","Content-Type":"application/json","X-Requested-With":"XMLHttpRequest","X-CSRF-Token":token()},body:JSON.stringify({_csrf:token()})})
    .then(function(r){return r.json().then(function(d){return{r:r,d:d};});})
    .then(function(x){
      busy=false;btn.disabled=false;
      if(!x.d||!x.d.ok){setStatus((x.d&&x.d.error)||"Update failed");return;}
      completed=!!x.d.completed;paint();
    }).catch(function(){busy=false;btn.disabled=false;setStatus("Network error");});
  });
  load();
})();<\/script>`;
}

function buildChatWidget(req, page) {
  const user = sessionUser(req);
  if (!user) return '';
  const pageId = page?._id ? escapeAttr(String(page._id)) : '';
  const userName = escapeAttr(user.name || 'You');

  return `
<style id="platform-chat-style">
#platform-chat-root{position:fixed;bottom:1.25rem;left:1.25rem;z-index:2147483646;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:flex-start;gap:.55rem}
#platform-chat-toggle{display:inline-flex;align-items:center;gap:.5rem;padding:.7rem 1.15rem;border-radius:999px;border:0;cursor:pointer;background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;font:700 .85rem/1 system-ui,sans-serif;box-shadow:0 10px 28px rgba(37,99,235,.4);position:relative}
#platform-chat-badge{display:none;position:absolute;top:-5px;right:-5px;min-width:1.2rem;height:1.2rem;padding:0 .35rem;border-radius:999px;background:#ef4444;color:#fff;font:700 .65rem/1.2rem system-ui,sans-serif;text-align:center;border:2px solid #fff}
#platform-chat-badge.is-on{display:inline-block}
#platform-chat-panel{width:min(22rem,calc(100vw - 1.75rem));height:26rem;display:none;flex-direction:column;background:#0b1220;color:#f1f5f9;border-radius:18px;border:1px solid rgba(148,163,184,.18);box-shadow:0 24px 56px rgba(2,6,23,.55);overflow:hidden}
#platform-chat-head{display:flex;align-items:center;justify-content:space-between;padding:.85rem 1rem;background:#111827;border-bottom:1px solid rgba(148,163,184,.12)}
#platform-chat-title{font:800 .9rem/1.2 system-ui,sans-serif;margin:0;color:#f8fafc}
#platform-chat-status{font:600 .68rem/1.2 system-ui,sans-serif;color:#94a3b8;margin:.15rem 0 0}
#platform-chat-close{border:0;background:rgba(148,163,184,.1);color:#94a3b8;width:1.85rem;height:1.85rem;border-radius:50%;cursor:pointer}
#platform-chat-log{flex:1;overflow:auto;padding:.85rem;display:flex;flex-direction:column;gap:.65rem;background:#0b1220}
.platform-chat-msg{background:#1e293b;border-radius:14px 14px 14px 4px;padding:.55rem .75rem;max-width:92%}
.platform-chat-msg strong{display:block;font-size:.7rem;color:#7dd3fc;margin-bottom:.2rem}
.platform-chat-msg span{font-size:.82rem;line-height:1.4;color:#e2e8f0;word-break:break-word;white-space:pre-wrap}
#platform-chat-empty{margin:auto;text-align:center;color:#64748b;font-size:.8rem;padding:1.5rem}
#platform-chat-err{color:#fecaca;font-size:.72rem;padding:.35rem .9rem}
#platform-chat-err[hidden]{display:none}
#platform-chat-form{display:flex;gap:.45rem;padding:.7rem .75rem;border-top:1px solid rgba(148,163,184,.12);background:#111827}
#platform-chat-input{flex:1;border-radius:12px;border:1px solid #334155;background:#0b1220;color:#f8fafc;padding:.6rem .8rem;font:500 .85rem/1.25 system-ui,sans-serif;outline:none}
#platform-chat-send{border:0;border-radius:12px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#052e16;font:800 .78rem/1 system-ui,sans-serif;padding:.6rem .95rem;cursor:pointer}
@media (max-width:480px){#platform-chat-root{left:.75rem;right:.75rem;bottom:.85rem;align-items:stretch}#platform-chat-panel{width:100%;height:min(28rem,70vh)}}
@media print{#platform-chat-root{display:none}}
</style>
<div id="platform-chat-root" data-page-id="${pageId}" data-user="${userName}">
  <div id="platform-chat-panel" role="dialog" aria-label="Live chat">
    <div id="platform-chat-head">
      <div>
        <p id="platform-chat-title">Live chat</p>
        <p id="platform-chat-status" data-state="offline">Connecting…</p>
      </div>
      <button type="button" id="platform-chat-close" aria-label="Close"
        onclick="var p=document.getElementById('platform-chat-panel');if(p)p.style.display='none';">×</button>
    </div>
    <div id="platform-chat-log">
      <div id="platform-chat-empty">No messages yet.<br>Say hello 👋</div>
    </div>
    <div id="platform-chat-err" hidden></div>
    <form id="platform-chat-form" action="javascript:void(0)" method="post" autocomplete="off" onsubmit="return false;">
      <input id="platform-chat-input" type="text" maxlength="500" placeholder="Type a message…" autocomplete="off">
      <button type="submit" id="platform-chat-send">Send</button>
    </form>
  </div>
  <button type="button" id="platform-chat-toggle" aria-expanded="false"
    onclick="var p=document.getElementById('platform-chat-panel');if(!p)return false;var o=p.style.display==='flex';p.style.display=o?'none':'flex';p.style.flexDirection='column';this.setAttribute('aria-expanded',o?'false':'true');if(!o){var b=document.getElementById('platform-chat-badge');if(b){b.textContent='0';b.classList.remove('is-on');}var i=document.getElementById('platform-chat-input');if(i)try{i.focus()}catch(e){}}return false;">
    Chat <span id="platform-chat-badge">0</span>
  </button>
</div>
<script src="/socket.io/socket.io.js"><\/script>
<script src="/js/platform-chat.js"><\/script>`;
}

async function prepareFullDocumentHtml(req, htmlSource, page) {
  let html = String(htmlSource || '');
  if (!html.trim()) {
    html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Empty</title></head><body style="margin:0;font-family:system-ui;padding:2rem;color:#64748b"><p>No HTML yet.</p></body></html>';
  }
  html = html
    .replace(/\bwindow\.parent\b/g, 'window.self')
    .replace(/\bwindow\.top\b/g, 'window.self')
    .replace(/\bwindow\.frameElement\b/g, 'null');

  let freshUser = null;
  const session = sessionUser(req);
  if (session && session._id) {
    try {
      const dbUser = await userModel.findById(session._id);
      if (dbUser) {
        freshUser = {
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role,
          avatarUrl: dbUser.avatarUrl || '',
          theme: dbUser.theme === 'dark' ? 'dark' : 'light',
        };
        if (req.session && req.session.user) {
          req.session.user.avatarUrl = freshUser.avatarUrl;
          req.session.user.name = freshUser.name;
          req.session.user.theme = freshUser.theme;
        }
      }
    } catch (e) {}
  }

  html = injectEarly(
    html,
    buildThemeBootstrap(req, freshUser) + buildAuthBootstrap(req, freshUser)
  );

  const widgets =
    buildProgressWidget(req, page) +
    buildChatWidget(req, page) +
    buildUserFab(req) +
    buildAdminFab(req);

  return injectBeforeBodyClose(html, widgets);
}

module.exports = {
  escapeAttr,
  sessionUser,
  buildThemeBootstrap,
  buildAuthBootstrap,
  buildProgressWidget,
  buildChatWidget,
  buildUserFab,
  buildAdminFab,
  injectEarly,
  injectBeforeBodyClose,
  prepareFullDocumentHtml,
};
