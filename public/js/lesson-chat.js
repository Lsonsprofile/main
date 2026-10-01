(function () {
  var root = document.getElementById('lesson-chat');
  if (!root) return;

  var pageId = root.getAttribute('data-page-id');
  var userId = root.getAttribute('data-user-id');
  if (!pageId) {
    console.warn('[chat] missing page id');
    return;
  }
  if (!userId) {
    return;
  }

  var statusEl = document.getElementById('chat-status');
  var listEl = document.getElementById('chat-messages');
  var form = document.getElementById('chat-form');
  var input = document.getElementById('chat-input');
  var errorEl = document.getElementById('chat-error');
  var seen = {};
  var pollTimer = null;

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

  function appendMessage(msg) {
    if (!listEl || !msg) return;
    var id = String(msg.id || msg._id || '');
    if (id && seen[id]) return;
    if (id) seen[id] = true;

    var mine = String(msg.userId) === String(userId);
    var row = document.createElement('div');
    row.className = 'chat-msg' + (mine ? ' is-mine' : '');
    if (id) row.setAttribute('data-id', id);
    row.innerHTML =
      '<div class="chat-msg-meta"><strong>' +
      escapeHtml(msg.userName || 'User') +
      '</strong><time>' +
      escapeHtml(formatTime(msg.createdAt)) +
      '</time></div><p class="chat-msg-body">' +
      escapeHtml(msg.body || '') +
      '</p>';
    listEl.appendChild(row);
    listEl.scrollTop = listEl.scrollHeight;
  }

  function applyHistory(history) {
    if (listEl) listEl.innerHTML = '';
    seen = {};
    (history || []).forEach(appendMessage);
    if (listEl) listEl.scrollTop = listEl.scrollHeight;
  }

  function loadMessages() {
    return fetch('/api/chat/' + encodeURIComponent(pageId), {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    }).then(function (r) {
      return r.text().then(function (text) {
        var d = null;
        try {
          d = text ? JSON.parse(text) : null;
        } catch (e) {
          throw new Error('Bad response from server');
        }
        return { status: r.status, d: d };
      });
    }).then(function (x) {
      if (x.status === 401) throw new Error('Login required — please log in again');
      if (x.status === 404) throw new Error('Chat API not found — restart server with latest code');
      if (!x.d || !x.d.ok) throw new Error((x.d && x.d.error) || 'Could not load chat');
      applyHistory(x.d.history);
      setStatus('online', 'Online');
      showError('');
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
      return r.text().then(function (text) {
        var d = null;
        try {
          d = text ? JSON.parse(text) : null;
        } catch (e) {
          throw new Error('Bad response from server');
        }
        return { status: r.status, d: d };
      });
    });
  }

  setStatus('connecting', 'Connecting…');
  loadMessages()
    .then(function () {
      pollTimer = setInterval(function () {
        loadMessages().catch(function () {});
      }, 3000);
    })
    .catch(function (e) {
      setStatus('offline', 'Offline');
      showError(e.message || 'Chat unavailable');
      console.error('[chat]', e);
    });

  if (form && input) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var body = (input.value || '').trim();
      if (!body) return;
      input.disabled = true;
      showError('');
      sendMessage(body)
        .then(function (x) {
          input.disabled = false;
          if (x.status === 401) {
            showError('Login required — please log in again');
            input.focus();
            return;
          }
          if (!x.d || !x.d.ok) {
            showError((x.d && x.d.error) || 'Could not send');
            input.focus();
            return;
          }
          input.value = '';
          if (x.d.message) appendMessage(x.d.message);
          input.focus();
          setStatus('online', 'Online');
        })
        .catch(function (err) {
          input.disabled = false;
          showError(err.message || 'Could not send');
          input.focus();
        });
    });
  }
})();
