/**
 * Fills #auth-actions on custom HTML pages with Welcome + circular profile photo.
 */
function buildAuthActionsWidget() {
  return (
    '<style id="platform-auth-actions-style">' +
    '#auth-actions{display:inline-flex;align-items:center;gap:0.5rem;flex-wrap:wrap;' +
    'font-family:system-ui,-apple-system,sans-serif;font-size:0.95rem}' +
    '#auth-actions .pa-user{display:inline-flex;align-items:center;gap:0.45rem;margin-right:0.35rem}' +
    '#auth-actions .pa-avatar{width:32px;height:32px;border-radius:50%;object-fit:cover;' +
    'border:2px solid rgba(15,23,42,0.12);flex-shrink:0;display:block;background:#e2e8f0}' +
    '#auth-actions .pa-avatar-fallback{width:32px;height:32px;border-radius:50%;' +
    'display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;' +
    'background:#0f172a;color:#f8fafc;flex-shrink:0}' +
    '#auth-actions a{color:inherit;font-weight:600;text-decoration:underline}' +
    '</style>' +
    '<script>(function(){' +
    'function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}' +
    'function paint(auth){' +
    'var box=document.getElementById("auth-actions");' +
    'if(!box)return;' +
    'auth=auth||{loggedIn:false};' +
    'if(auth.loggedIn){' +
    'var name=auth.name||"there";' +
    'var avatar=auth.avatarUrl||"";' +
    'var initial=(name.charAt(0)||"U").toUpperCase();' +
    'var photo=avatar' +
    '?(\'<img class="pa-avatar" src="\'+esc(avatar)+\'" alt="" width="32" height="32">\')' +
    ':(\'<span class="pa-avatar-fallback" aria-hidden="true">\'+esc(initial)+\'</span>\');' +
    'box.innerHTML=\'<span class="pa-user">\'+photo+' +
    '\'<span class="pa-welcome">Welcome \'+esc(name)+\'</span></span>\'+' +
    '\'<a href="/account/settings">Profile</a> · <a href="/logout">Log out</a>\';' +
    '}else{' +
    'box.innerHTML=\'<a href="/login">Login</a> · <a href="/register">Sign up</a>\';' +
    '}' +
    '}' +
    'paint(window.__AUTH__);' +
    'fetch("/api/me",{credentials:"same-origin"})' +
    '.then(function(r){return r.json();}).then(paint).catch(function(){});' +
    '})();</script>'
  );
}

module.exports = { buildAuthActionsWidget };
