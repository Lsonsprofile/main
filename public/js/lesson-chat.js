(function () {
  var root = document.getElementById('lesson-chat');
  if (!root) return;

  var pageId = root.getAttribute('data-page-id');
  var userId = root.getAttribute('data-user-id');
  if (!pageId || !userId) return;

  var statusEl = document.getElementById('chat-status');
  var listEl = document.getElementById('chat-messages');
  var form = document.getElementById('chat-form');
  var input = document.getElementById('chat-input');
  var errorEl = document.getElementById('chat-error');
  var seen = {};

  function setStatus(state, label) {
    if (!statusEl) return;
    statusEl.setAttribute('data-state', state);
    statusEl.textContent = label;
  }

  function showError(msg) {
    if (!errorEl) return;
    if (!msg) {
      errorEl.hidden = true;
      errorEl.textContent = '';
      return;
    }
    errorEl.hidden = false;
    errorEl.textContent = msg;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTime(iso) {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  function appendMessage(msg, opts) {
    if (!listEl || !msg || !msg.id) return;
    if (seen[msg.id]) return;
    seen[msg.id] = true;

    var mine = String(msg.userId) === String(userId);
    var row = document.createElement('div');
    row.className = 'chat-msg' + (mine ? ' is-mine' : '');
    row.setAttribute('data-id', msg.id);
    row.innerHTML =
      '<div class="chat-msg-meta">' +
      '<strong>' +
      escapeHtml(msg.userName || 'User') +
      '</strong>' +
      '<time>' +
      escapeHtml(formatTime(msg.createdAt)) +
      '</time>' +
      '</div>' +
      '<p class="chat-msg-body">' +
      escapeHtml(msg.body || '') +
      '</p>';
    listEl.appendChild(row);

    if (!opts || opts.scroll !== false) {
      listEl.scrollTop = listEl.scrollHeight;
    }
  }

  if (typeof io === 'undefined') {
    setStatus('offline', 'Chat unavailable');
    showError('Real-time library failed to load. Run npm install and restart the server.');
    return;
  }

  setStatus('connecting', 'Connecting…');

  var socket = io({
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', function () {
    setStatus('online', 'Live');
    showError('');
    socket.emit('chat:join', { pageId: pageId }, function (res) {
      if (!res || !res.ok) {
        setStatus('offline', 'Unavailable');
        showError((res && res.error) || 'Could not join chat');
        return;
      }
      if (listEl) listEl.innerHTML = '';
      seen = {};
      (res.history || []).forEach(function (m) {
        appendMessage(m, { scroll: false });
      });
      if (listEl) listEl.scrollTop = listEl.scrollHeight;
    });
  });

  socket.on('disconnect', function () {
    setStatus('offline', 'Reconnecting…');
  });

  socket.on('connect_error', function () {
    setStatus('offline', 'Offline');
  });

  socket.on('chat:message', function (msg) {
    appendMessage(msg);
  });

  if (form && input) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var body = (input.value || '').trim();
      if (!body) return;
      input.disabled = true;
      socket.emit('chat:message', { pageId: pageId, body: body }, function (res) {
        input.disabled = false;
        if (!res || !res.ok) {
          showError((res && res.error) || 'Could not send');
          input.focus();
          return;
        }
        showError('');
        input.value = '';
        input.focus();
        // message also arrives via broadcast; if ack includes message, append optimistically
        if (res.message) appendMessage(res.message);
      });
    });
  }
})();
