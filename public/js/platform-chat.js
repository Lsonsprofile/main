(function () {
  var root = document.getElementById('platform-chat-root');
  if (!root) return;
  var pageId = root.getAttribute('data-page-id');
  var userId = root.getAttribute('data-user-id');
  if (!pageId || !userId) return;

  var toggle = document.getElementById('platform-chat-toggle');
  var closeBtn = document.getElementById('platform-chat-close');
  var statusEl = document.getElementById('platform-chat-status');
  var list = document.getElementById('platform-chat-msgs');
  var form = document.getElementById('platform-chat-form');
  var input = document.getElementById('platform-chat-input');
  var errEl = document.getElementById('platform-chat-err');
  var badge = document.getElementById('platform-chat-badge');
  var seen = {};
  var unread = 0;
  var pollTimer = null;

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function isOpen() {
    return root.classList.contains('is-open');
  }
  function setStatus(state, label) {
    if (!statusEl) return;
    statusEl.setAttribute('data-state', state);
    statusEl.textContent = label;
  }
  function showErr(m) {
    if (!errEl) return;
    if (!m) {
      errEl.hidden = true;
      errEl.textContent = '';
      return;
    }
    errEl.hidden = false;
    errEl.textContent = m;
  }
  function updateBadge() {
    if (!badge) return;
    if (unread > 0 && !isOpen()) {
      badge.textContent = unread > 99 ? '99+' : String(unread);
      badge.classList.add('is-on');
    } else {
      badge.textContent = '';
      badge.classList.remove('is-on');
    }
  }
  function openChat() {
    root.classList.add('is-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    unread = 0;
    updateBadge();
    if (input) input.focus();
  }
  function closeChat() {
    root.classList.remove('is-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    updateBadge();
  }
  function addMsg(msg, fromHistory) {
    if (!list || !msg) return;
    var id = String(msg.id || msg._id || '');
    if (id && seen[id]) return;
    if (id) seen[id] = 1;
    var mine = String(msg.userId) === String(userId);
    var row = document.createElement('div');
    row.className = 'pc-msg' + (mine ? ' is-mine' : '');
    row.innerHTML =
      '<div class="pc-msg-meta">' +
      esc(msg.userName || 'User') +
      '</div><div>' +
      esc(msg.body) +
      '</div>';
    list.appendChild(row);
    list.scrollTop = list.scrollHeight;
    if (!fromHistory && !mine && !isOpen()) {
      unread += 1;
      updateBadge();
    }
  }
  function applyHistory(history) {
    if (list) list.innerHTML = '';
    seen = {};
    (history || []).forEach(function (m) {
      addMsg(m, true);
    });
  }
  function loadMessages() {
    return fetch('/api/chat/' + encodeURIComponent(pageId), {
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    }).then(function (r) {
      return r.json().then(function (d) {
        return { status: r.status, d: d };
      });
    }).then(function (x) {
      if (x.status === 401) throw new Error('Login required');
      if (!x.d || !x.d.ok) throw new Error((x.d && x.d.error) || 'Load failed');
      applyHistory(x.d.history);
      setStatus('online', 'Online');
      showErr('');
    });
  }
  function sendMessage(body) {
    return fetch('/api/chat/' + encodeURIComponent(pageId), {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ body: body }),
    }).then(function (r) {
      return r.json();
    });
  }

  if (toggle)
    toggle.addEventListener('click', function () {
      if (isOpen()) closeChat();
      else openChat();
    });
  if (closeBtn)
    closeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      closeChat();
    });

  setStatus('offline', 'Connecting…');
  loadMessages()
    .then(function () {
      pollTimer = setInterval(function () {
        loadMessages().catch(function () {});
      }, 3000);
    })
    .catch(function (e) {
      setStatus('offline', 'Offline');
      showErr(e.message || 'Chat unavailable');
    });

  if (form && input) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var body = (input.value || '').trim();
      if (!body) return;
      sendMessage(body)
        .then(function (d) {
          if (!d || !d.ok) {
            showErr((d && d.error) || 'Send failed');
            return;
          }
          showErr('');
          input.value = '';
          if (d.message) addMsg(d.message, true);
        })
        .catch(function () {
          showErr('Send failed');
        });
    });
  }
})();
