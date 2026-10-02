/**
 * WhatsApp-style site chat: bubbles, right-click menu, edit, soft-delete.
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
  var meId = (window.__AUTH__ && window.__AUTH__.userId) || '';
  var isAdmin = Boolean(window.__AUTH__ && window.__AUTH__.isAdmin);
  var menu = null;
  var editingId = null;

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
  function formatTime(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      var h = d.getHours();
      var m = d.getMinutes();
      var hh = h % 12 || 12;
      var am = h < 12 ? 'AM' : 'PM';
      return hh + ':' + String(m).padStart(2, '0') + ' ' + am;
    } catch (e) {
      return '';
    }
  }

  function hideMenu() {
    if (menu) {
      menu.remove();
      menu = null;
    }
  }

  function showMenu(x, y, msg) {
    hideMenu();
    if (!msg || msg.deleted) return;
    var mine = meId && String(msg.userId) === String(meId);
    if (!mine && !isAdmin) return;

    menu = document.createElement('div');
    menu.id = 'platform-chat-menu';
    menu.innerHTML =
      (mine ? '<button type="button" data-act="edit">Edit message</button>' : '') +
      '<button type="button" data-act="delete">Delete message</button>' +
      '<button type="button" data-act="cancel">Cancel</button>';

    menu.style.left = Math.min(x, window.innerWidth - 180) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 140) + 'px';
    document.body.appendChild(menu);

    menu.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      hideMenu();
      if (act === 'delete') doDelete(msg.id);
      if (act === 'edit') startEdit(msg);
    });
  }

  document.addEventListener('click', function (e) {
    if (menu && !menu.contains(e.target)) hideMenu();
  });
  document.addEventListener('scroll', hideMenu, true);

  function renderBubble(m) {
    var mine = meId && String(m.userId) === String(meId);
    var wrap = document.createElement('div');
    wrap.className =
      'pc-row ' + (mine ? 'pc-row-mine' : 'pc-row-other') + (m.deleted ? ' pc-deleted' : '');
    wrap.setAttribute('data-id', m.id);
    wrap.setAttribute('data-user-id', m.userId || '');

    var bubble = document.createElement('div');
    bubble.className = 'pc-bubble ' + (mine ? 'pc-bubble-mine' : 'pc-bubble-other');

    var nameEl = '';
    if (!mine && !m.deleted) {
      nameEl = '<div class="pc-name">' + esc(m.userName || 'User') + '</div>';
    }

    var bodyClass = m.deleted ? 'pc-body pc-body-deleted' : 'pc-body';
    var bodyText = m.deleted ? 'This message was deleted' : m.body || '';
    var meta =
      '<div class="pc-meta">' +
      (m.edited && !m.deleted ? '<span class="pc-edited">edited</span> ' : '') +
      '<span class="pc-time">' +
      esc(formatTime(m.createdAt)) +
      '</span></div>';

    bubble.innerHTML =
      nameEl +
      '<div class="' +
      bodyClass +
      '">' +
      esc(bodyText) +
      '</div>' +
      meta;

    wrap.appendChild(bubble);

    wrap.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      showMenu(e.clientX, e.clientY, m);
    });

    var pressTimer = null;
    wrap.addEventListener(
      'touchstart',
      function (e) {
        pressTimer = setTimeout(function () {
          var t = e.touches[0];
          showMenu(t.clientX, t.clientY, m);
        }, 500);
      },
      { passive: true }
    );
    wrap.addEventListener('touchend', function () {
      clearTimeout(pressTimer);
    });
    wrap.addEventListener('touchmove', function () {
      clearTimeout(pressTimer);
    });

    return wrap;
  }

  function addMsg(m) {
    if (!log || !m || !m.id) return;
    hideEmpty();
    var existing = log.querySelector('.pc-row[data-id="' + m.id + '"]');
    if (existing) {
      existing.replaceWith(renderBubble(m));
      return;
    }
    log.appendChild(renderBubble(m));
    log.scrollTop = log.scrollHeight;
  }

  function startEdit(msg) {
    if (!msg || msg.deleted || !input) return;
    editingId = msg.id;
    input.value = msg.body || '';
    input.focus();
    input.placeholder = 'Edit message…';
    var sendBtn = document.getElementById('platform-chat-send');
    if (sendBtn) sendBtn.textContent = 'Save';
  }

  function clearEditMode() {
    editingId = null;
    if (input) input.placeholder = 'Type a message…';
    var sendBtn = document.getElementById('platform-chat-send');
    if (sendBtn) sendBtn.textContent = 'Send';
  }

  function doDelete(id) {
    if (!id) return;
    if (socket && socket.connected) {
      socket.emit('chat:delete', { id: id }, function (res) {
        if (res && res.ok && res.message) addMsg(res.message);
        else deleteViaRest(id);
      });
    } else {
      deleteViaRest(id);
    }
  }

  function deleteViaRest(id) {
    fetch('/api/chat/messages/' + encodeURIComponent(id), {
      method: 'DELETE',
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
        if (d && d.ok && d.message) addMsg(d.message);
        else showErr((d && d.error) || 'Delete failed');
      })
      .catch(function () {
        showErr('Network error');
      });
  }

  function editViaRest(id, body, done) {
    fetch('/api/chat/messages/' + encodeURIComponent(id), {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': token(),
      },
      body: JSON.stringify({ body: body, _csrf: token() }),
    })
      .then(function (r) {
        return r.json().then(function (d) {
          return { r: r, d: d };
        });
      })
      .then(function (x) {
        if (!x.d || !x.d.ok) {
          done((x.d && x.d.error) || 'Edit failed');
          return;
        }
        done(null, x.d.message);
      })
      .catch(function () {
        done('Network error');
      });
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
        if (d && d.meId) meId = d.meId;
        if (d && d.ok && d.history && d.history.length) {
          hideEmpty();
          d.history.forEach(function (m) {
            addMsg(m);
          });
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
        clearEditMode();
        if (msg) addMsg(msg);
      }

      if (editingId) {
        var eid = editingId;
        if (socket && socket.connected) {
          socket.emit('chat:edit', { id: eid, body: body }, function (res) {
            if (res && res.ok) finish(null, res.message);
            else editViaRest(eid, body, finish);
          });
        } else {
          editViaRest(eid, body, finish);
        }
        return false;
      }

      if (socket && socket.connected) {
        socket.emit('chat:message', { pageId: pageId, body: body }, function (res) {
          if (res && res.ok) finish(null, res.message);
          else sendViaRest(body, finish);
        });
      } else {
        sendViaRest(body, finish);
      }
      return false;
    });
  }

  if (input) {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && editingId) {
        clearEditMode();
        input.value = '';
      }
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
      if (res && res.meId) meId = res.meId;
      if (res && res.ok && res.history && res.history.length) {
        hideEmpty();
        if (log) {
          log.querySelectorAll('.pc-row').forEach(function (n) {
            n.remove();
          });
        }
        res.history.forEach(function (m) {
          addMsg(m);
        });
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

  socket.on('chat:deleted', function (m) {
    addMsg(m);
  });

  socket.on('chat:edited', function (m) {
    addMsg(m);
  });
})();
