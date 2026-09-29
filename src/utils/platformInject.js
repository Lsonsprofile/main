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
