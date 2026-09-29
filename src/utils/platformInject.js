/**
 * Platform widgets injected into full custom HTML documents (server-side only).
 */

'use strict';

const crypto = require('crypto');

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

function buildThemeBootstrap(req) {
  const theme = sessionUser(req)?.theme === 'dark' ? 'dark' : 'light';
  return `<script>try{document.documentElement.setAttribute("data-theme","${theme}");}catch(e){}</script>`;
}

function buildAuthBootstrap(req) {
  const user = sessionUser(req);
  const payload = {
    loggedIn: Boolean(user),
    name: user?.name ? String(user.name) : '',
    role: user?.role ? String(user.role) : '',
    isAdmin: Boolean(user?.role === 'admin'),
    avatarUrl: user?.avatarUrl ? String(user.avatarUrl) : '',
    csrfToken: ensureCsrf(req),
  };
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  return `<script>window.__AUTH__=${json};</script>`;
}

function buildUserFab(req) {
  const user = sessionUser(req);
  if (!user || user.role === 'admin') return '';
  return `
<style id="platform-user-fab-style">
#platform-user-fab{position:fixed;bottom:1.25rem;right:1.25rem;z-index:2147483646;font-family:system-ui,sans-serif}
#platform-user-fab a{display:inline-flex;align-items:center;gap:.4rem;padding:.65rem 1rem;border-radius:999px;text-decoration:none;font:700 .8rem/1 system-ui,sans-serif;background:#0369a1;color:#fff;box-shadow:0 8px 22px rgba(15,23,42,.28)}
@media print{#platform-user-fab{display:none}}
</style>
<div id="platform-user-fab"><a href="/account/settings" title="Settings & profile">⚙ Settings</a></div>`;
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
  function setStatus(t,k){if(!status)return;status.textContent=t||"";status.className=k?("is-"+k):"";}
  function paint(){
    if(completed){btn.textContent="Completed ✓";btn.classList.add("is-done");setStatus("You finished this page","ok");}
    else{btn.textContent="Mark complete";btn.classList.remove("is-done");setStatus("Mark when you finish","ok");}
  }
  function load(){
    fetch("/lesson/"+encodeURIComponent(slug)+"/progress",{credentials:"same-origin",headers:{Accept:"application/json","X-Requested-With":"XMLHttpRequest","X-CSRF-Token":token()}})
    .then(function(r){return r.json().then(function(d){return{r:r,d:d};});})
    .then(function(x){
      if(x.r.status===401){setStatus("Log in to track progress","err");btn.disabled=true;return;}
      if(!x.d||!x.d.ok){setStatus((x.d&&x.d.error)||"Could not load","err");return;}
      completed=!!x.d.completed;btn.disabled=false;paint();
    }).catch(function(){setStatus("Could not load progress","err");});
  }
  btn.addEventListener("click",function(){
    if(busy)return;busy=true;btn.disabled=true;
    var path=completed?"/incomplete":"/complete";
    setStatus(completed?"Updating…":"Saving…","");
    fetch("/lesson/"+encodeURIComponent(slug)+path,{method:"POST",credentials:"same-origin",headers:{Accept:"application/json","Content-Type":"application/json","X-Requested-With":"XMLHttpRequest","X-CSRF-Token":token()},body:JSON.stringify({_csrf:token()})})
    .then(function(r){return r.json().then(function(d){return{r:r,d:d};});})
    .then(function(x){
      busy=false;btn.disabled=false;
      if(!x.d||!x.d.ok){setStatus((x.d&&x.d.error)||"Update failed","err");return;}
      completed=!!x.d.completed;paint();
      setStatus(completed?"Saved as complete":"Marked incomplete","ok");
    }).catch(function(){busy=false;btn.disabled=false;setStatus("Network error","err");});
  });
  load();
})();<\/script>`;
}

function buildChatWidget(req, page) {
  const user = sessionUser(req);
  if (!user) return '';
  const pageId = page?._id ? escapeAttr(String(page._id)) : '';
  return `
<style id="platform-chat-style">
#platform-chat-root{position:fixed;bottom:1.25rem;left:1.25rem;z-index:2147483646;font-family:system-ui,sans-serif}
#platform-chat-toggle{display:inline-flex;align-items:center;gap:.4rem;padding:.7rem 1.1rem;border-radius:999px;border:0;cursor:pointer;background:#0ea5e9;color:#fff;font:700 .85rem/1 system-ui,sans-serif;box-shadow:0 8px 24px rgba(14,165,233,.45);position:relative}
#platform-chat-badge{display:none;position:absolute;top:-6px;right:-6px;min-width:1.25rem;height:1.25rem;padding:0 .35rem;border-radius:999px;background:#ef4444;color:#fff;font:700 .65rem/1.25rem system-ui,sans-serif;text-align:center}
#platform-chat-badge.is-on{display:inline-block}
#platform-chat-panel{flex-direction:column;width:min(20rem,calc(100vw - 2rem));height:22rem;margin-bottom:.55rem;background:#0f172a;color:#f8fafc;border-radius:14px;border:1px solid rgba(255,255,255,.12);box-shadow:0 16px 40px rgba(15,23,42,.5);overflow:hidden}
#platform-chat-head{display:flex;align-items:center;justify-content:space-between;padding:.75rem .85rem;border-bottom:1px solid rgba(255,255,255,.08);background:#111827}
#platform-chat-status{font-size:.7rem;font-weight:700;color:#94a3b8}
#platform-chat-close{border:0;background:transparent;color:#94a3b8;font-size:1.25rem;cursor:pointer;line-height:1}
#platform-chat-log{flex:1;overflow:auto;padding:.75rem;display:flex;flex-direction:column;gap:.55rem;background:#0b1220}
.platform-chat-msg{background:#1e293b;border-radius:10px;padding:.5rem .65rem}
.platform-chat-msg strong{display:block;font-size:.72rem;color:#7dd3fc;margin-bottom:.2rem}
.platform-chat-msg span{font-size:.8rem;line-height:1.35;word-break:break-word}
#platform-chat-form{display:flex;gap:.4rem;padding:.65rem;border-top:1px solid rgba(255,255,255,.08);background:#1e293b}
#platform-chat-input{flex:1;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#f8fafc;padding:.5rem .65rem;font:500 .8rem/1.2 system-ui,sans-serif}
#platform-chat-send{border:0;border-radius:8px;background:#22c55e;color:#052e16;font:700 .75rem/1 system-ui,sans-serif;padding:.5rem .75rem;cursor:pointer}
#platform-chat-err{color:#fca5a5;font-size:.7rem;padding:0 .65rem .5rem}
@media print{#platform-chat-root{display:none}}
</style>
<div id="platform-chat-root" data-page-id="${pageId}">
  <div id="platform-chat-panel" style="display:none">
    <div id="platform-chat-head">
      <div><strong>Live chat</strong> <span id="platform-chat-status" data-state="offline">…</span></div>
      <button type="button" id="platform-chat-close" aria-label="Close" onclick="var p=document.getElementById('platform-chat-panel');if(p)p.style.display='none';">×</button>
    </div>
    <div id="platform-chat-log"></div>
    <div id="platform-chat-err" hidden></div>
    <form id="platform-chat-form" action="javascript:void(0)" method="post" autocomplete="off" onsubmit="return false;">
      <input id="platform-chat-input" type="text" maxlength="500" placeholder="Message…" autocomplete="off">
      <button type="submit" id="platform-chat-send">Send</button>
    </form>
  </div>
  <button type="button" id="platform-chat-toggle" aria-expanded="false" onclick="var p=document.getElementById('platform-chat-panel');if(!p)return false;var o=p.style.display==='flex';p.style.display=o?'none':'flex';p.style.flexDirection='column';this.setAttribute('aria-expanded',o?'false':'true');return false;">Chat <span id="platform-chat-badge">0</span></button>
</div>
<script src="/socket.io/socket.io.js"><\/script>
<script>(function(){
  var root=document.getElementById("platform-chat-root");if(!root)return;
  var panel=document.getElementById("platform-chat-panel");
  var form=document.getElementById("platform-chat-form");
  var input=document.getElementById("platform-chat-input");
  var log=document.getElementById("platform-chat-log");
  var badge=document.getElementById("platform-chat-badge");
  var status=document.getElementById("platform-chat-status");
  var errEl=document.getElementById("platform-chat-err");
  var pageId=root.getAttribute("data-page-id")||"";
  var socket=null,unread=0;
  function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  function showErr(t){if(!errEl)return;if(!t){errEl.hidden=true;errEl.textContent="";return;}errEl.hidden=false;errEl.textContent=t;}
  function setStatus(state,label){if(!status)return;status.setAttribute("data-state",state);status.textContent=label;}
  function isOpen(){return panel&&panel.style.display==="flex";}
  function addMsg(m){if(!log||!m)return;var d=document.createElement("div");d.className="platform-chat-msg";d.innerHTML="<strong>"+esc(m.userName||m.name||"User")+"</strong><span>"+esc(m.body||"")+"</span>";log.appendChild(d);log.scrollTop=log.scrollHeight;}
  if(form){form.addEventListener("submit",function(e){e.preventDefault();e.stopPropagation();var body=(input&&input.value||"").trim();if(!body)return false;if(!socket||!socket.connected){showErr("Chat offline — wait for Online");return false;}socket.emit("chat:message",{pageId:pageId,body:body},function(res){if(!res||!res.ok){showErr((res&&res.error)||"Send failed");return;}showErr("");if(input)input.value="";if(res.message)addMsg(res.message);});return false;});}
  if(typeof io==="undefined"){setStatus("offline","Offline");return;}
  socket=io({path:"/socket.io",withCredentials:true,transports:["websocket","polling"]});
  socket.on("connect",function(){setStatus("online","Online");showErr("");socket.emit("chat:join",{pageId:pageId},function(res){if(res&&res.ok&&res.history){(res.history||[]).forEach(addMsg);}});});
  socket.on("disconnect",function(){setStatus("offline","Offline");});
  socket.on("connect_error",function(){setStatus("offline","Offline");});
  socket.on("chat:message",function(m){addMsg(m);if(!isOpen()){unread+=1;if(badge){badge.textContent=String(unread);badge.classList.add("is-on");badge.style.display="inline-block";}}});
})();<\/script>`;
}

function prepareFullDocumentHtml(req, htmlSource, page) {
  let html = String(htmlSource || '');
  if (!html.trim()) {
    html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Empty</title></head><body style="margin:0;font-family:system-ui;padding:2rem;color:#64748b"><p>No HTML yet. Paste your full document in Admin, Save, then Publish.</p></body></html>';
  }
  html = html.replace(/\bwindow\.parent\b/g, 'window.self').replace(/\bwindow\.top\b/g, 'window.self').replace(/\bwindow\.frameElement\b/g, 'null');
  html = injectEarly(html, buildThemeBootstrap(req) + buildAuthBootstrap(req));
  const widgets = buildProgressWidget(req, page) + buildChatWidget(req, page) + buildUserFab(req) + buildAdminFab(req);
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
