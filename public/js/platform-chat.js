/**
 * Platform site-wide chat client (Socket.io + REST fallback).
 */
(function () {
  var root = document.getElementById('platform-chat-root');
  if (!root) return;

  var panel = document.getElementById('platform-chat-panel');
  var form = document.getElementById('platform-chat-form');
  var input = document.getElementById('platform-chat-input');
  var log = document.getElementById('platform-chat-log');
  var badge = document.getElementById('platform-chat-badge');
  var status = document.getElementById('platform-chat-status');
  var errEl = document.getElementById('platform-chat-err');
  var empty = document.getElementById('platform-chat-empty');
  var pageId = root.getAttribute('data-page-id') || '';
  var socket = null;
  var unread = 0;

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function token() {
    return (window.__AUTH__ && window.__AUTH__.csrfToken) || '';
  }
  function showErr(t) {
    if (!errEl) return;
    if (!t) {
      errEl.hidden = true;
      errEl.textContent = '';
      return;
    }
    errEl.hidden = false;
    errEl.textContent = t;
  }
  function setStatus(state, label) {
    if (!status) return;
    status.setAttribute('data-state', state);
    status.textContent = label;
  }
  function isOpen() {
    return panel && panel.style.display === 'flex';
  }
  function hideEmpty() {
    if (empty) empty.style.display = 'none';
  }
  function addMsg(m) {
    if (!log || !m) return;
    hideEmpty();
    var d = document.createElement('div');
    d.className = 'platform-chat-msg';
    d.innerHTML =
      '<strong>' +
      esc(m.userName || m.name || 'User') +
      '</strong><span>' +
      esc(m.body || '') +
      '</span>';
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }

  function sendViaRest(body, done) {
    fetch('/api/chat/messages', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': token(),
      },
      body: JSON.stringify({ body: body, pageId: pageId, _csrf: token() }),
    })
      .then(function (r) {
        return r.json().then(function (d) {
          return { r: r, d: d };
        });
      })
      .then(function (x) {
        if (!x.d || !x.d.ok) {
          done((x.d && x.d.error) || 'Send failed');
          return;
        }
        done(null, x.d.message);
      })
      .catch(function () {
        done('Network error');
      });
  }

  function loadHistoryRest() {
    fetch('/api/chat/messages', {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': token(),
      },
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        if (d && d.ok && d.history && d.history.length) {
          hideEmpty();
          d.history.forEach(addMsg);
        }
        setStatus('online', 'Online');
      })
      .catch(function () {});
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var body = ((input && input.value) || '').trim();
      if (!body) return false;
      function finish(err, msg) {
        if (err) {
          showErr(err);
          return;
        }
        showErr('');
        if (input) input.value = '';
        if (msg) addMsg(msg);
      }
      if (socket && socket.connected) {
        socket.emit('chat:message', { pageId: pageId, body: body }, function (res) {
          if (res && res.ok) {
            finish(null, res.message);
            return;
          }
          sendViaRest(body, finish);
        });
      } else {
        sendViaRest(body, finish);
      }
      return false;
    });
  }

  if (typeof io === 'undefined') {
    setStatus('online', 'Online');
    loadHistoryRest();
    return;
  }

  socket = io({
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
  });

  socket.on('connect', function () {
    setStatus('online', 'Online');
    showErr('');
    socket.emit('chat:join', { pageId: pageId }, function (res) {
      if (res && res.ok && res.history && res.history.length) {
        hideEmpty();
        res.history.forEach(addMsg);
      } else if (!res || !res.ok) {
        loadHistoryRest();
      }
    });
  });

  socket.on('disconnect', function () {
    setStatus('offline', 'Reconnecting…');
  });

  socket.on('connect_error', function () {
    setStatus('offline', 'Using backup');
    loadHistoryRest();
  });

  socket.on('chat:message', function (m) {
    addMsg(m);
    if (!isOpen()) {
      unread += 1;
      if (badge) {
        badge.textContent = String(unread);
        badge.classList.add('is-on');
      }
    }
  });
})();
