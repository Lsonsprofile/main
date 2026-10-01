(function () {
  var root = document.getElementById('platform-chat-root');
  if (!root || typeof io === 'undefined') return;
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
  var socket = io({
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });
  socket.on('connect', function () {
    setStatus('online', 'Online');
    socket.emit('chat:join', { pageId: pageId }, function (res) {
      if (!res || !res.ok) {
        showErr((res && res.error) || 'Could not join');
        setStatus('offline', 'Error');
        return;
      }
      showErr('');
      if (list) list.innerHTML = '';
      seen = {};
      (res.history || []).forEach(function (m) {
        addMsg(m, true);
      });
    });
  });
  socket.on('disconnect', function () {
    setStatus('offline', 'Offline');
  });
  socket.on('connect_error', function () {
    setStatus('offline', 'Offline');
  });
  socket.on('chat:message', function (msg) {
    addMsg(msg, false);
  });

  if (form && input) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var body = (input.value || '').trim();
      if (!body) return;
      socket.emit('chat:message', { pageId: pageId, body: body }, function (res) {
        if (!res || !res.ok) {
          showErr((res && res.error) || 'Send failed');
          return;
        }
        showErr('');
        input.value = '';
        if (res.message) addMsg(res.message, true);
      });
    });
  }
})();
