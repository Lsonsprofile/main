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
  var mode = 'http';
  var socket = null;
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

  function applyHistory(history) {
    if (listEl) listEl.innerHTML = '';
    seen = {};
    (history || []).forEach(function (m) {
      appendMessage(m, { scroll: false });
    });
    if (listEl) listEl.scrollTop = listEl.scrollHeight;
  }

  function loadHttp() {
    return fetch('/api/chat/' + encodeURIComponent(pageId), {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    }).then(function (r) {
      return r.json().then(function (d) {
        return { status: r.status, d: d };
      });
    }).then(function (x) {
      if (x.status === 401) throw new Error('Login required');
      if (!x.d || !x.d.ok) throw new Error((x.d && x.d.error) || 'Could not load chat');
      applyHistory(x.d.history);
      setStatus('online', mode === 'live' ? 'Live' : 'Online');
      showError('');
    });
  }

  function sendHttp(body) {
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
      return r.json().then(function (d) {
        return { status: r.status, d: d };
      });
    });
  }

  setStatus('connecting', 'Connecting…');
  loadHttp()
    .then(function () {
      setStatus('online', 'Online');
      pollTimer = setInterval(function () {
        if (mode === 'live') return;
        loadHttp().catch(function () {});
      }, 4000);
    })
    .catch(function (e) {
      setStatus('offline', 'Offline');
      showError(e.message || 'Chat unavailable');
    });

  if (typeof io !== 'undefined') {
    try {
      socket = io({
        path: '/socket.io',
        withCredentials: true,
        transports: ['polling', 'websocket'],
        timeout: 8000,
        reconnection: true,
        reconnectionAttempts: 8,
      });
      socket.on('connect', function () {
        socket.emit('chat:join', { pageId: pageId }, function (res) {
          if (!res || !res.ok) return;
          mode = 'live';
          setStatus('online', 'Live');
          showError('');
          applyHistory(res.history);
          if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
        });
      });
      socket.on('chat:message', function (msg) {
        if (mode === 'live') appendMessage(msg);
      });
      socket.on('connect_error', function () {});
    } catch (e) {}
  }

  if (form && input) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var body = (input.value || '').trim();
      if (!body) return;
      input.disabled = true;

      function finish(ok, err, message) {
        input.disabled = false;
        if (!ok) {
          showError(err || 'Could not send');
          input.focus();
          return;
        }
        showError('');
        input.value = '';
        input.focus();
        if (message) appendMessage(message);
      }

      if (mode === 'live' && socket && socket.connected) {
        socket.emit('chat:message', { pageId: pageId, body: body }, function (res) {
          if (res && res.ok) {
            finish(true, null, res.message);
            return;
          }
          sendHttp(body)
            .then(function (x) {
              finish(x.d && x.d.ok, (x.d && x.d.error) || 'Could not send', x.d && x.d.message);
            })
            .catch(function () {
              finish(false, 'Could not send');
            });
        });
      } else {
        sendHttp(body)
          .then(function (x) {
            finish(x.d && x.d.ok, (x.d && x.d.error) || 'Could not send', x.d && x.d.message);
          })
          .catch(function () {
            finish(false, 'Could not send. Are you logged in?');
          });
      }
    });
  }
})();
