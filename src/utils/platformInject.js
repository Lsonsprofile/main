/**
 * Snippets injected into full custom HTML documents (server-side only).
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
    avatarUrl: user && user.avatarUrl ? String(user.avatarUrl) : '',
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

function escapeAttr(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&')
    .replace(/"/g, '"')
    .replace(/</g, '<')
    .replace(/>/g, '>');
}

function buildProgressWidget(req, page) {
  const user = req.session && req.session.user ? req.session.user : null;
  if (!user || !page || !page.slug) return '';
  const slug = String(page.slug);
  return (
    '<style id="platform-progress-style">' +
    '#platform-progress{position:fixed;bottom:1.25rem;left:50%;transform:translateX(-50%);z-index:2147483644;font-family:system-ui,sans-serif;pointer-events:none}' +
    '#platform-progress-inner{pointer-events:auto;display:flex;align-items:center;gap:0.55rem;padding:0.55rem 0.85rem;border-radius:999px;background:#0f172a;color:#f8fafc;box-shadow:0 10px 28px rgba(15,23,42,.35);border:1px solid rgba(255,255,255,.12);font:600 0.8rem/1.2 system-ui,sans-serif}' +
    '#platform-progress-btn{border:0;border-radius:999px;padding:0.45rem 0.9rem;cursor:pointer;font:700 0.78rem/1 system-ui,sans-serif;background:#22c55e;color:#052e16}' +
    '#platform-progress-btn.is-done{background:#38bdf8;color:#0c4a6e}' +
    '#platform-progress-status{font-size:0.72rem;color:#94a3b8}' +
    '@media print{#platform-progress{display:none}}' +
    '</style>' +
    '<div id="platform-progress" data-slug="' + escapeAttr(slug) + '">' +
    '<div id="platform-progress-inner">' +
    '<button type="button" id="platform-progress-btn">Mark complete</button>' +
    '<span id="platform-progress-status">Checking…</span></div></div>' +
    '<script>(function(){var root=document.getElementById("platform-progress");if(!root)return;' +
    'var slug=root.getAttribute("data-slug")||"";var btn=document.getElementById("platform-progress-btn");' +
    'var status=document.getElementById("platform-progress-status");var busy=false,completed=false;' +
    'function setStatus(t,k){if(!status)return;status.textContent=t||"";status.className=k?("is-"+k):"";}' +
    'function paint(){if(completed){btn.textContent="Completed ✓";btn.classList.add("is-done");setStatus("You finished this page","ok");}' +
    'else{btn.textContent="Mark complete";btn.classList.remove("is-done");setStatus("Mark when you finish","ok");}}' +
    'function load(){fetch("/lesson/"+encodeURIComponent(slug)+"/progress",{credentials:"same-origin",headers:{Accept:"application/json","X-Requested-With":"XMLHttpRequest","X-CSRF-Token":((window.__AUTH__&&window.__AUTH__.csrfToken)||"")}})' +
    '.then(function(r){return r.json().then(function(d){return{r:r,d:d};});}).then(function(x){' +
    'if(x.r.status===401){setStatus("Log in to track progress","err");btn.disabled=true;return;}' +
    'if(!x.d||!x.d.ok){setStatus((x.d&&x.d.error)||"Could not load","err");return;}completed=!!x.d.completed;btn.disabled=false;paint();' +
    '}).catch(function(){setStatus("Could not load progress","err");});}' +
    'btn.addEventListener("click",function(){if(busy)return;busy=true;btn.disabled=true;' +
    'var path=completed?"/incomplete":"/complete";setStatus(completed?"Updating…":"Saving…","");' +
    'fetch("/lesson/"+encodeURIComponent(slug)+path,{method:"POST",credentials:"same-origin",' +
    'headers:{Accept:"application/json","Content-Type":"application/json","X-Requested-With":"XMLHttpRequest","X-CSRF-Token":((window.__AUTH__&&window.__AUTH__.csrfToken)||"")},' +
    'body:JSON.stringify({_csrf:((window.__AUTH__&&window.__AUTH__.csrfToken)||"")})}).then(function(r){return r.json().then(function(d){return{r:r,d:d};});})' +
    '.then(function(x){busy=false;btn.disabled=false;if(!x.d||!x.d.ok){setStatus((x.d&&x.d.error)||"Update failed","err");return;}' +
    'completed=!!x.d.completed;paint();setStatus(completed?"Saved as complete":"Marked incomplete","ok");' +
    '}).catch(function(){busy=false;btn.disabled=false;setStatus("Network error","err");});});load();})();</script>'
  );
}

function buildUserFab(req) {
  const user = req.session && req.session.user ? req.session.user : null;
  if (!user || user.role === 'admin') return '';
  return (
    '<style id="platform-user-fab-style">#platform-user-fab{position:fixed;bottom:1.25rem;right:1.25rem;z-index:2147483646}' +
    '#platform-user-fab a{display:inline-flex;padding:0.6rem 0.95rem;border-radius:999px;text-decoration:none;font:700 0.78rem/1 system-ui,sans-serif;' +
    'background:#0369a1;color:#fff;box-shadow:0 8px 22px rgba(15,23,42,.28)}</style>' +
    '<div id="platform-user-fab"><a href="/account/settings">⚙ Settings</a></div>'
  );
}

function buildAdminFab(req) {
  const user = req.session && req.session.user ? req.session.user : null;
  if (!user || user.role !== 'admin') return '';
  return (
    '<style id="platform-admin-fab-style">#platform-admin-fab{position:fixed;bottom:1.25rem;right:1.25rem;z-index:2147483646;' +
    'display:inline-flex;padding:0.65rem 1rem;border-radius:999px;background:#0f172a;color:#f8fafc;font:700 0.8rem/1 system-ui,sans-serif;' +
    'text-decoration:none;box-shadow:0 8px 24px rgba(15,23,42,.35)}</style>' +
    '<a id="platform-admin-fab" href="/admin">⌂ Dashboard</a>'
  );
}

/** Site-wide live chat — same room on every page. Open works even if socket is slow. */
function buildChatWidget(req, page) {
  const user = req.session && req.session.user ? req.session.user : null;
  if (!user) return '';
  const pageId = page && page._id ? String(page._id) : '';
  return (
    '<style id="platform-chat-style">' +
    '#platform-chat-root{position:fixed;bottom:1.25rem;left:1.25rem;z-index:2147483646;font-family:system-ui,sans-serif}' +
    '#platform-chat-toggle{position:relative;display:inline-flex;align-items:center;gap:0.45rem;padding:0.7rem 1.05rem;border-radius:999px;border:0;cursor:pointer;' +
    'background:#0ea5e9;color:#fff;font:700 0.85rem/1 system-ui,sans-serif;box-shadow:0 8px 24px rgba(14,165,233,.4);pointer-events:auto}' +
    '#platform-chat-toggle:hover{background:#0284c7}' +
    '#platform-chat-badge{display:none;position:absolute;top:-6px;right:-6px;min-width:1.25rem;height:1.25rem;padding:0 0.35rem;border-radius:999px;background:#ef4444;color:#fff;font:700 0.65rem/1.25rem system-ui,sans-serif;text-align:center}' +
    '#platform-chat-badge.is-on{display:inline-block}' +
    '#platform-chat-panel{display:none;flex-direction:column;width:min(20rem,calc(100vw - 2rem));height:22rem;margin-bottom:0.55rem;' +
    'background:#0f172a;color:#f8fafc;border-radius:14px;border:1px solid rgba(255,255,255,.12);box-shadow:0 16px 40px rgba(15,23,42,.45);overflow:hidden}' +
    '#platform-chat-root.is-open #platform-chat-panel{display:flex}' +
    '#platform-chat-head{display:flex;align-items:center;justify-content:space-between;padding:0.75rem 0.85rem;border-bottom:1px solid rgba(255,255,255,.08);background:#111827}' +
    '#platform-chat-status{font-size:0.7rem;font-weight:700;color:#94a3b8}' +
    '#platform-chat-status[data-state="online"]{color:#4ade80}' +
    '#platform-chat-status[data-state="offline"]{color:#f87171}' +
    '#platform-chat-close{border:0;background:transparent;color:#94a3b8;font-size:1.15rem;cursor:pointer;line-height:1}' +
    '#platform-chat-log{flex:1;overflow:auto;padding:0.75rem;display:flex;flex-direction:column;gap:0.55rem}' +
    '.platform-chat-msg{background:#1e293b;border-radius:10px;padding:0.5rem 0.65rem}' +
    '.platform-chat-msg strong{display:block;font-size:0.72rem;color:#7dd3fc;margin-bottom:0.2rem}' +
    '.platform-chat-msg span{font-size:0.8rem;line-height:1.35;word-break:break-word}' +
    '#platform-chat-form{display:flex;gap:0.4rem;padding:0.65rem;border-top:1px solid rgba(255,255,255,.08)}' +
    '#platform-chat-input{flex:1;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#f8fafc;padding:0.5rem 0.65rem;font:500 0.8rem/1.2 system-ui,sans-serif}' +
    '#platform-chat-send{border:0;border-radius:8px;background:#22c55e;color:#052e16;font:700 0.75rem/1 system-ui,sans-serif;padding:0.5rem 0.75rem;cursor:pointer}' +
    '#platform-chat-err{color:#fca5a5;font-size:0.7rem;padding:0 0.65rem 0.5rem}' +
    '@media print{#platform-chat-root{display:none}}' +
    '</style>' +
    '<div id="platform-chat-root" data-page-id="' + escapeAttr(pageId) + '">' +
    '<div id="platform-chat-panel" role="dialog" aria-label="Site chat">' +
    '<div id="platform-chat-head"><div><strong>Live chat</strong>' +
    '<div id="platform-chat-status" data-state="offline">…</div></div>' +
    '<button type="button" id="platform-chat-close" aria-label="Close chat">×</button></div>' +
    '<div id="platform-chat-log"></div><div id="platform-chat-err" hidden></div>' +
    '<form id="platform-chat-form" autocomplete="off">' +
    '<input id="platform-chat-input" maxlength="500" placeholder="Message…" />' +
    '<button type="submit" id="platform-chat-send">Send</button></form></div>' +
    '<button type="button" id="platform-chat-toggle" aria-expanded="false">Chat <span id="platform-chat-badge">0</span></button>' +
    '</div>' +
    '<script src="/socket.io/socket.io.js"></script>' +
    '<script>(function(){' +
    'var root=document.getElementById("platform-chat-root");if(!root)return;' +
    'var pageId=root.getAttribute("data-page-id")||"";' +
    'var toggle=document.getElementById("platform-chat-toggle");' +
    'var closeBtn=document.getElementById("platform-chat-close");' +
    'var log=document.getElementById("platform-chat-log");' +
    'var form=document.getElementById("platform-chat-form");' +
    'var input=document.getElementById("platform-chat-input");' +
    'var badge=document.getElementById("platform-chat-badge");' +
    'var status=document.getElementById("platform-chat-status");' +
    'var errEl=document.getElementById("platform-chat-err");' +
    'var unread=0,open=false;' +
    'function esc(s){return String(s||"").replace(/&/g,"&").replace(/</g,"<").replace(/>/g,">").replace(/\"/g,""");}' +
    'function showErr(t){if(!errEl)return;if(!t){errEl.hidden=true;errEl.textContent="";return;}errEl.hidden=false;errEl.textContent=t;}' +
    'function setOpen(v){open=!!v;root.classList.toggle("is-open",open);if(toggle)toggle.setAttribute("aria-expanded",open?"true":"false");' +
    'if(open){unread=0;if(badge){badge.textContent="0";badge.classList.remove("is-on");}if(input)input.focus();}}' +
    'if(toggle)toggle.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();setOpen(!open);});' +
    'if(closeBtn)closeBtn.addEventListener("click",function(e){e.preventDefault();setOpen(false);});' +
    'function addMsg(m){if(!log||!m)return;var d=document.createElement("div");d.className="platform-chat-msg";' +
    'd.innerHTML="<strong>"+esc(m.userName||m.name||"User")+"</strong><span>"+esc(m.body||"")+"</span>";log.appendChild(d);log.scrollTop=log.scrollHeight;}' +
    'function setStatus(state,label){if(!status)return;status.setAttribute("data-state",state);status.textContent=label;}' +
    'if(typeof io==="undefined"){setStatus("offline","Offline");return;}' +
    'var socket=io({path:"/socket.io",withCredentials:true,transports:["websocket","polling"]});' +
    'socket.on("connect",function(){setStatus("online","Online");' +
    'socket.emit("chat:join",{pageId:pageId},function(res){if(res&&res.ok&&res.history){(res.history||[]).forEach(addMsg);}});});' +
    'socket.on("disconnect",function(){setStatus("offline","Offline");});' +
    'socket.on("connect_error",function(){setStatus("offline","Offline");});' +
    'socket.on("chat:message",function(m){addMsg(m);if(!open){unread+=1;if(badge){badge.textContent=String(unread);badge.classList.add("is-on");}}});' +
    'if(form)form.addEventListener("submit",function(e){e.preventDefault();var body=(input&&input.value||"").trim();if(!body)return;' +
    'socket.emit("chat:message",{pageId:pageId,body:body},function(res){if(!res||!res.ok){showErr((res&&res.error)||"Send failed");return;}' +
    'showErr("");if(input)input.value="";});});' +
    '})();</script>'
  );
}

function injectEarly(html, snippet) {
  html = String(html || '');
  if (!snippet) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, function (m) { return m + snippet; });
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, function (m) { return m + snippet; });
  }
  return snippet + html;
}

function injectBeforeBodyClose(html, snippet) {
  html = String(html || '');
  if (!snippet) return html;
  const lower = html.toLowerCase();
  const idx = lower.lastIndexOf('</body>');
  if (idx !== -1) return html.slice(0, idx) + snippet + html.slice(idx);
  return html + snippet;
}

function prepareFullDocumentHtml(req, htmlSource, page) {
  let html = String(htmlSource || '');
  if (!html.trim()) {
    html =
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Empty</title></head>' +
      '<body style="margin:0;font-family:system-ui;padding:2rem;color:#64748b">' +
      '<p>No HTML yet. In Admin, paste or upload your full HTML, Save, then Publish.</p></body></html>';
  }
  html = html
    .replace(/\bwindow\.parent\b/g, 'window.self')
    .replace(/\bwindow\.top\b/g, 'window.self')
    .replace(/\bwindow\.frameElement\b/g, 'null');
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
