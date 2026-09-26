/**
 * Full HTML Document Editor
 * Monaco (with textarea fallback) + sandboxed iframe live preview
 */
(function () {
  'use strict';

  var PAGE_ID = window.__PAGE_ID__;

  function sourceStats(text) {
    text = String(text || '');
    var lines = text ? text.split(/\r\n|\n|\r/).length : 0;
    var kb = Math.round(text.length / 1024);
    return lines + ' lines · ' + kb + ' KB';
  }

  function loadFullSourceFromServer() {
    if (!PAGE_ID) {
      return Promise.resolve(initialSource || DEFAULT_HTML);
    }
    setSaveStatus('Loading full HTML from server…', 'ok');
    return fetch('/admin/pages/' + encodeURIComponent(PAGE_ID) + '/html-source', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok || !data || !data.ok) {
            throw new Error((data && data.error) || 'Failed to load HTML');
          }
          var src = typeof data.htmlSource === 'string' ? data.htmlSource : '';
          initialSource = src;
          lastSaved = src;
          setSaveStatus('Loaded ' + sourceStats(src), 'ok');
          return src || DEFAULT_HTML;
        });
      })
      .catch(function (err) {
        console.error(err);
        setSaveStatus('Could not load HTML — using local buffer', 'err');
        return initialSource || DEFAULT_HTML;
      });
  }


  var initialSource = window.__PAGE_HTML_SOURCE__ || '';
  var pageTitle = window.__PAGE_TITLE__ || 'My Page';

  var DEFAULT_HTML =
    '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '  <meta charset="UTF-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '  <title>' + escapeHtml(pageTitle) + '</title>\n' +
    '  <style>\n' +
    '    * { box-sizing: border-box; }\n' +
    '    body {\n' +
    '      margin: 0;\n' +
    '      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;\n' +
    '      line-height: 1.6;\n' +
    '      color: #0f172a;\n' +
    '      background: #f8fafc;\n' +
    '    }\n' +
    '    .hero {\n' +
    '      padding: 4rem 1.5rem;\n' +
    '      text-align: center;\n' +
    '      background: linear-gradient(135deg, #1a56db 0%, #7c3aed 100%);\n' +
    '      color: #fff;\n' +
    '    }\n' +
    '    .hero h1 { margin: 0 0 0.5rem; font-size: 2.25rem; }\n' +
    '    .hero p { margin: 0 0 1.5rem; opacity: 0.95; }\n' +
    '    .hero button {\n' +
    '      padding: 0.75rem 1.5rem;\n' +
    '      border: 0;\n' +
    '      border-radius: 8px;\n' +
    '      background: #fff;\n' +
    '      color: #1a56db;\n' +
    '      font-weight: 600;\n' +
    '      cursor: pointer;\n' +
    '    }\n' +
    '    .card {\n' +
    '      max-width: 40rem;\n' +
    '      margin: 2rem auto;\n' +
    '      padding: 1.5rem;\n' +
    '      background: #fff;\n' +
    '      border-radius: 12px;\n' +
    '      box-shadow: 0 1px 3px rgba(0,0,0,.08);\n' +
    '    }\n' +
    '  </style>\n' +
    '</head>\n' +
    '<body>\n' +
    '  <section class="hero">\n' +
    '    <h1>Welcome to ' + escapeHtml(pageTitle) + '</h1>\n' +
    '    <p>Learn through practical examples and activities.</p>\n' +
    '    <button type="button" id="learnBtn">Start Learning</button>\n' +
    '  </section>\n' +
    '  <div class="card">\n' +
    '    <p id="message">Click the button — JavaScript runs only inside this isolated preview.</p>\n' +
    '  </div>\n' +
    '  <script>\n' +
    '    const button = document.querySelector("#learnBtn");\n' +
    '    const message = document.querySelector("#message");\n' +
    '    button.addEventListener("click", function () {\n' +
    '      message.textContent = "JavaScript is working!";\n' +
    '      alert("Welcome to the course!");\n' +
    '    });\n' +
    '  </scr' + 'ipt>\n' +
    '</body>\n' +
    '</html>\n';

  var editor = null;
  var textareaFallback = null;
  var saveTimer = null;
  var previewTimer = null;
  var dirty = false;
  var lastSaved = '';
  var previewBlobUrl = null;

  var workspace = document.querySelector('.he-workspace');
  var iframe = document.getElementById('he-preview-iframe');
  var previewWrap = document.querySelector('.he-preview-frame-wrap');
  var errorBox = document.getElementById('he-preview-error');
  var errorMsg = document.getElementById('he-preview-error-msg');
  var saveStatus = document.getElementById('he-save-status');
  var liveToggle = document.getElementById('he-live-preview');
  var monacoHost = document.getElementById('monaco-editor');
  var appRoot = document.getElementById('html-editor-app');
  var pageId = PAGE_ID || (appRoot ? appRoot.getAttribute('data-page-id') : '') || '';

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  
  function injectHeightProbe(html) {
    html = String(html || '');
    var probe =
      '<script>(function(){function m(){try{var h=Math.max(' +
      'document.body?document.body.scrollHeight:0,' +
      'document.documentElement?document.documentElement.scrollHeight:0,1200);' +
      'if(window.parent&&window.parent!==window){window.parent.postMessage({type:"html-preview-height",height:h},"*");}' +
      '}catch(e){}}window.addEventListener("load",function(){m();setTimeout(m,400);setTimeout(m,1200);});setInterval(m,1500);})();</scr' + 'ipt>';
    if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, probe + '</body>');
    return html + probe;
  }

  function prepareHtmlForPreview(source) {
    var html = String(source || '');
    html = html.replace(/\bwindow\.parent\b/g, 'window.self');
    html = html.replace(/\bwindow\.top\b/g, 'window.self');
    html = html.replace(/\bwindow\.frameElement\b/g, 'null');
    html = html.replace(/(href|src|action)\s*=\s*(["']?)\s*javascript:/gi, '$1=$2#blocked:');
    html = html.replace(/(href|src|action)\s*=\s*(["']?)\s*data:\s*text\/html/gi, '$1=$2#blocked:');
    html = html.replace(/(href|src|action)\s*=\s*(["']?)\s*vbscript:/gi, '$1=$2#blocked:');
    return html;
  }

  var lastSavedAt = null;

  function formatSavedTime(date) {
    try {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  function setSaveStatus(text, kind) {
    if (!saveStatus) return;
    saveStatus.textContent = text;
    saveStatus.className = 'he-save-status' + (kind ? ' is-' + kind : '');
    saveStatus.title = lastSavedAt
      ? 'Last saved at ' + lastSavedAt.toLocaleString()
      : '';
  }

  function getSource() {
    if (editor) {
      try {
        return editor.getValue();
      } catch (e) {
        /* fall through */
      }
    }
    if (textareaFallback) return textareaFallback.value;
    return initialSource || DEFAULT_HTML;
  }

  function setSource(value) {
    if (editor) {
      try {
        editor.setValue(value);
        return;
      } catch (e) {
        /* fall through */
      }
    }
    if (textareaFallback) textareaFallback.value = value;
  }

  /**
   * Preview via srcdoc (blob: URLs often render blank in sandboxed iframes).
   * Replacing the iframe node clears old scripts/listeners.
   */
  function renderPreview() {
    if (!previewWrap) return;
    iframe = document.getElementById('he-preview-iframe') || iframe;
    if (!iframe) return;

    if (errorBox) errorBox.hidden = true;

    var source = injectHeightProbe(prepareHtmlForPreview(getSource()));
    if (!String(source).trim()) {
      source =
        '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
        '<body style="margin:0;font-family:system-ui;padding:2rem;color:#64748b">' +
        '<p>No HTML yet. Paste a full document in the editor, then click <strong>Refresh</strong>.</p>' +
        '</body></html>';
    }

    try {
      var fresh = document.createElement('iframe');
      fresh.id = 'he-preview-iframe';
      fresh.className = 'he-preview-iframe';
      fresh.title = 'Isolated page preview';
      fresh.setAttribute(
        'sandbox',
        'allow-scripts allow-forms allow-modals allow-popups allow-downloads'
      );
      fresh.setAttribute('referrerpolicy', 'no-referrer');
      fresh.setAttribute('scrolling', 'yes');
      fresh.style.cssText = 'width:100%;min-height:9000px;height:9000px;border:0;display:block;background:#fff';

      // Large documents (Tailwind/CDN): load from same-origin preview URL after Save
      // so scripts and full layout work reliably. Fall back to srcdoc if no page id.
      var useUrlPreview = pageId && lastSaved && String(lastSaved).trim().length > 0;
      if (useUrlPreview) {
        fresh.src =
          '/admin/pages/' +
          encodeURIComponent(pageId) +
          '/html-preview?t=' +
          Date.now();
      } else if (pageId && String(source).length > 80000) {
        // Very large unsaved doc — still try srcdoc but warn
        fresh.srcdoc = source;
      } else {
        fresh.srcdoc = source;
      }

      if (iframe.parentNode) {
        iframe.parentNode.replaceChild(fresh, iframe);
      }
      iframe = fresh;

      var sub = document.getElementById('he-preview-sub');
      if (sub) {
        var kb = Math.max(1, Math.round(source.length / 1024));
        sub.textContent = useUrlPreview
          ? 'Live URL preview · ' + kb + ' KB · Save first for best CDN/Tailwind support'
          : 'Sandboxed · ' + kb + ' KB · Save then Refresh for full CDN preview';
      }
    } catch (err) {
      if (errorBox && errorMsg) {
        errorBox.hidden = false;
        errorMsg.textContent = (err && err.message) || String(err);
      }
    }
  }

  function schedulePreview() {
    if (liveToggle && !liveToggle.checked) return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 350);
  }

  function markDirty() {
    dirty = true;
    setSaveStatus('Unsaved changes', 'warn');
    schedulePreview();
    scheduleAutoSave();
  }

  function scheduleAutoSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveSource({ silent: true });
    }, 2500);
  }

  function saveSource(opts) {
    opts = opts || {};
    var source = getSource();
    if (source === lastSaved && opts.silent) return Promise.resolve({ ok: true });

    setSaveStatus('Saving…', 'busy');

    var csrfMeta = document.querySelector('meta[name="csrf-token"]');
    var csrf = csrfMeta ? csrfMeta.getAttribute('content') : '';
    return fetch('/admin/pages/' + encodeURIComponent(PAGE_ID) + '/html', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-CSRF-Token': csrf || '',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'same-origin',
      body: JSON.stringify({ htmlSource: source, _csrf: csrf }),
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var data = {};
          try { data = text ? JSON.parse(text) : {}; } catch (e) {
            throw new Error(res.status === 413 ? 'HTML too large for server' : ('Server error ' + res.status));
          }
          if (!res.ok || !data.ok) {
            throw new Error((data && data.error) || ('Save failed (' + res.status + ')'));
          }
          lastSaved = source;
          dirty = false;
          lastSavedAt = new Date();
          setSaveStatus('Saved · ' + sourceStats(lastSaved) + ' · ' + formatSavedTime(lastSavedAt), 'ok');
          setTimeout(renderPreview, 80);
          return data;
        });
      })
      .catch(function (err) {
        setSaveStatus('Save failed: ' + (err.message || 'error'), 'err');
        if (!opts.silent) {
          alert('Could not save: ' + (err.message || err));
        }
        throw err;
      });
  }

  function setMode(mode) {
    if (!workspace) return;
    workspace.setAttribute('data-layout', mode);
    document.querySelectorAll('.he-mode-tab').forEach(function (btn) {
      var active = btn.getAttribute('data-mode') === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (mode === 'preview' || mode === 'split') {
      renderPreview();
    }
    if (editor) {
      setTimeout(function () {
        try {
          editor.layout();
        } catch (e) {
          /* ignore */
        }
      }, 60);
    }
  }

  function setDevice(device) {
    if (previewWrap) previewWrap.setAttribute('data-device', device);
    document.querySelectorAll('.he-device').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-device') === device);
    });
  }

  function mountTextareaFallback(value) {
    if (!monacoHost) return;
    monacoHost.innerHTML = '';
    textareaFallback = document.createElement('textarea');
    textareaFallback.className = 'he-textarea-fallback';
    textareaFallback.setAttribute('spellcheck', 'false');
    textareaFallback.setAttribute('aria-label', 'HTML source editor');
    textareaFallback.value = value;
    monacoHost.appendChild(textareaFallback);
    textareaFallback.addEventListener('input', markDirty);
    textareaFallback.addEventListener('paste', function () {
      setTimeout(markDirty, 0);
    });
    setSaveStatus('Plain editor (Monaco unavailable)', 'warn');
  }

  function initMonaco() {
    var value = initialSource && String(initialSource).trim() ? initialSource : DEFAULT_HTML;
    lastSaved = value;

    // Always prefer full source from API (large HTML is not embedded in the page)
    loadFullSourceFromServer().then(function (src) {
      value = src && String(src).trim() ? src : value;
      lastSaved = value;
      startMonacoOrFallback(value);
    });
  }

  function startMonacoOrFallback(value) {
    // Ensure preview shows once editor has content
    setTimeout(function () {
      try { renderPreview(); } catch (e) {}
    }, 300);
    // If Monaco loader never arrives, fall back quickly
    var fallbackTimer = setTimeout(function () {
      if (!editor) {
        console.warn('Monaco load timeout — using textarea fallback');
        mountTextareaFallback(value);
        loadFullSourceFromServer().then(function (src) {
          if (textareaFallback) textareaFallback.value = src || value;
          lastSaved = src || value;
          dirty = false;
          renderPreview();
          setSaveStatus('Ready · ' + sourceStats(src || value), 'ok');
        });
      }
    }, 5000);

    if (typeof require === 'undefined') {
      clearTimeout(fallbackTimer);
      mountTextareaFallback(value);
      renderPreview();
      return;
    }

    try {
      require.config({
        paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' },
      });
    } catch (e) {
      clearTimeout(fallbackTimer);
      mountTextareaFallback(value);
      renderPreview();
      return;
    }

    window.MonacoEnvironment = {
      getWorkerUrl: function () {
        return (
          'data:text/javascript;charset=utf-8,' +
          encodeURIComponent(
            "self.MonacoEnvironment={baseUrl:'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/'};" +
              "importScripts('https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/base/worker/workerMain.js');"
          )
        );
      },
    };

    require(
      ['vs/editor/editor.main'],
      function () {
        clearTimeout(fallbackTimer);
        try {
          editor = monaco.editor.create(monacoHost, {
            value: value,
            language: 'html',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: true, maxColumn: 80 },
            fontSize: 14,
            lineNumbers: 'on',
            wordWrap: 'on',
            tabSize: 2,
            scrollBeyondLastLine: true,
            folding: true,
            bracketPairColorization: { enabled: true },
            formatOnPaste: false,
            renderWhitespace: 'selection',
            padding: { top: 12 },
            largeFileOptimizations: true,
            maxTokenizationLineLength: 50000,
            stopRenderingLineAfter: 20000,
            mouseWheelZoom: false,
            smoothScrolling: true,
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              verticalScrollbarSize: 14,
              horizontalScrollbarSize: 12,
              alwaysConsumeMouseWheel: false,
              useShadows: false,
            },
            overviewRulerLanes: 2,
            fixedOverflowWidgets: true,
          });

          editor.onDidChangeModelContent(function () {
            markDirty();
          });

          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function () {
            saveSource();
          });

          // Source already loaded before Monaco init
          dirty = false;
          renderPreview();
          setSaveStatus('Ready · ' + sourceStats(value), 'ok');
        } catch (err) {
          console.error(err);
          mountTextareaFallback(value);
          renderPreview();
        }
      },
      function (err) {
        clearTimeout(fallbackTimer);
        console.error('Monaco failed to load', err);
        mountTextareaFallback(value);
        renderPreview();
      }
    );
  }

  // --- Events ---
  document.querySelectorAll('.he-mode-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setMode(btn.getAttribute('data-mode'));
    });
  });

  document.querySelectorAll('.he-device').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setDevice(btn.getAttribute('data-device'));
    });
  });

  var saveBtn = document.getElementById('he-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', function () {
      saveSource().then(function () {
        renderPreview();
      });
    });
  }

  var refreshBtn = document.getElementById('he-refresh-preview');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function () {
      renderPreview();
    });
  }

  if (liveToggle) {
    liveToggle.addEventListener('change', function () {
      if (liveToggle.checked) renderPreview();
    });
  }

  var openBtn = document.getElementById('he-open-preview');
  if (openBtn) {
    openBtn.addEventListener('click', function () {
      var html = prepareHtmlForPreview(getSource());
      var w = window.open('', '_blank', 'noopener,noreferrer');
      if (w) {
        w.document.open();
        w.document.write(html);
        w.document.close();
      } else {
        // Popup blocked — fallback blob tab
        var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        window.location.href = url;
      }
    });
  }

  var returnCode = document.getElementById('he-return-code');
  if (returnCode) {
    returnCode.addEventListener('click', function () {
      if (errorBox) errorBox.hidden = true;
      setMode('code');
    });
  }

  var splitter = document.getElementById('he-splitter');
  if (splitter && workspace) {
    var dragging = false;
    splitter.addEventListener('mousedown', function (e) {
      if (workspace.getAttribute('data-layout') !== 'split') return;
      dragging = true;
      document.body.classList.add('he-resizing');
      e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var rect = workspace.getBoundingClientRect();
      var pct = ((e.clientX - rect.left) / rect.width) * 100;
      pct = Math.min(80, Math.max(20, pct));
      workspace.style.setProperty('--code-width', pct + '%');
      if (editor) {
        try {
          editor.layout();
        } catch (err) {
          /* ignore */
        }
      }
    });
    window.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove('he-resizing');
    });
  }

  window.addEventListener('beforeunload', function (e) {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  var flash = document.getElementById('he-flash');
  if (flash) {
    setTimeout(function () {
      flash.style.opacity = '0';
      setTimeout(function () {
        if (flash.parentNode) flash.remove();
      }, 400);
    }, 4000);
  }

  // Publish always saves the HTML first so the live page is not blank
  var publishForm = document.getElementById('he-publish-form');
  if (publishForm) {
    publishForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = document.getElementById('he-publish-btn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Saving…';
      }
      setSaveStatus('Saving before publish…', 'busy');
      saveSource()
        .then(function () {
          if (btn) btn.textContent = 'Publishing…';
          publishForm.submit();
        })
        .catch(function () {
          if (btn) {
            btn.disabled = false;
            btn.textContent = 'Publish';
          }
          alert('Save failed — fix the error, then Publish again.');
        });
    });
  }

  /* ---------- Templates ---------- */
  var TEMPLATES = [
    {
      id: 'blank',
      name: 'Blank page',
      desc: 'Minimal HTML shell',
      html:
        '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>New page</title>\n  <style>\n    body { margin: 0; font-family: system-ui, sans-serif; line-height: 1.5; color: #0f172a; }\n    main { max-width: 48rem; margin: 0 auto; padding: 2rem 1.25rem; }\n  </style>\n</head>\n<body>\n  <main>\n    <h1>New page</h1>\n    <p>Start writing here.</p>\n  </main>\n</body>\n</html>\n',
    },
    {
      id: 'lesson',
      name: 'Lesson poster',
      desc: 'Hero, objectives, content sections',
      html:
        '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Lesson</title>\n  <style>\n    :root { --bg: #0f172a; --card: #fff; --accent: #4f46e5; }\n    * { box-sizing: border-box; }\n    body { margin: 0; font-family: system-ui, sans-serif; background: #e2e8f0; color: #0f172a; }\n    .wrap { max-width: 56rem; margin: 1.5rem auto; background: var(--card); border-radius: 1.25rem; overflow: hidden; box-shadow: 0 20px 50px rgba(15,23,42,.15); }\n    .hero { padding: 2.5rem 2rem; background: linear-gradient(135deg, #0f172a, #312e81); color: #fff; }\n    .hero h1 { margin: 0 0 .5rem; font-size: clamp(1.75rem, 4vw, 2.5rem); }\n    .hero p { margin: 0; opacity: .9; }\n    .body { padding: 2rem; }\n    .obj { background: #eef2ff; border-radius: 1rem; padding: 1.25rem; margin-bottom: 1.5rem; }\n    .obj h2 { margin: 0 0 .75rem; font-size: 1.1rem; color: var(--accent); }\n    .obj ul { margin: 0; padding-left: 1.2rem; }\n    .section { margin-bottom: 1.75rem; }\n    .section h2 { margin: 0 0 .5rem; }\n    button { background: var(--accent); color: #fff; border: 0; padding: .65rem 1.1rem; border-radius: .6rem; font-weight: 600; cursor: pointer; }\n  </style>\n</head>\n<body>\n  <div class="wrap">\n    <header class="hero">\n      <h1>Lesson title</h1>\n      <p>Short introduction for learners.</p>\n    </header>\n    <div class="body">\n      <div class="obj">\n        <h2>Learning objectives</h2>\n        <ul>\n          <li>Objective one</li>\n          <li>Objective two</li>\n          <li>Objective three</li>\n        </ul>\n      </div>\n      <section class="section">\n        <h2>Topic 1</h2>\n        <p>Explain the concept in plain language.</p>\n      </section>\n      <section class="section">\n        <h2>Practice</h2>\n        <p>Describe a short activity.</p>\n        <button type="button" id="checkBtn">I understand</button>\n        <p id="msg"></p>\n      </section>\n    </div>\n  </div>\n  <script>\n    document.getElementById("checkBtn").addEventListener("click", function () {\n      document.getElementById("msg").textContent = "Great — keep going!";\n    });\n  </scr' + 'ipt>\n</body>\n</html>\n',
    },
    {
      id: 'quiz',
      name: 'Simple quiz',
      desc: 'Interactive question + feedback',
      html:
        '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Quiz</title>\n  <style>\n    body { margin: 0; font-family: system-ui, sans-serif; background: #f8fafc; color: #0f172a; }\n    main { max-width: 32rem; margin: 2rem auto; padding: 1.5rem; background: #fff; border-radius: 1rem; box-shadow: 0 8px 24px rgba(15,23,42,.08); }\n    h1 { margin-top: 0; }\n    label { display: block; margin: .5rem 0; padding: .65rem .8rem; border: 1px solid #e2e8f0; border-radius: .5rem; cursor: pointer; }\n    label:hover { border-color: #818cf8; }\n    button { margin-top: 1rem; background: #4f46e5; color: #fff; border: 0; padding: .65rem 1.1rem; border-radius: .55rem; font-weight: 600; cursor: pointer; }\n    #result { margin-top: 1rem; font-weight: 600; }\n  </style>\n</head>\n<body>\n  <main>\n    <h1>Quick check</h1>\n    <p>What does ICT stand for?</p>\n    <form id="quiz">\n      <label><input type="radio" name="q1" value="wrong"> Internet Computer Tool</label>\n      <label><input type="radio" name="q1" value="right"> Information and Communication Technology</label>\n      <label><input type="radio" name="q1" value="wrong"> Internal Control Terminal</label>\n      <button type="submit">Check answer</button>\n    </form>\n    <p id="result"></p>\n  </main>\n  <script>\n    document.getElementById("quiz").addEventListener("submit", function (e) {\n      e.preventDefault();\n      var v = (document.querySelector("input[name=q1]:checked") || {}).value;\n      var el = document.getElementById("result");\n      if (v === "right") el.textContent = "Correct!";\n      else if (v) el.textContent = "Not quite — try again.";\n      else el.textContent = "Pick an answer first.";\n    });\n  </scr' + 'ipt>\n</body>\n</html>\n',
    },
  ];

  function openModal(id) {
    var el = document.getElementById(id);
    if (el) el.hidden = false;
  }
  function closeModal(id) {
    var el = document.getElementById(id);
    if (el) el.hidden = true;
  }
  document.querySelectorAll('[data-close-modal]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var modal = btn.closest('.he-modal');
      if (modal) modal.hidden = true;
    });
  });

  function applyTemplate(html) {
    if (!window.confirm('Replace the current editor content with this template?')) return;
    setSource(html);
    dirty = true;
    setSaveStatus('Unsaved changes', 'warn');
    scheduleAutoSave();
    renderPreview();
    closeModal('he-templates-modal');
  }

  function buildTemplateGrid() {
    var grid = document.getElementById('he-template-grid');
    if (!grid) return;
    grid.innerHTML = '';
    TEMPLATES.forEach(function (t) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'he-template-card';
      card.innerHTML =
        '<strong>' +
        escapeHtml(t.name) +
        '</strong><span>' +
        escapeHtml(t.desc) +
        '</span>';
      card.addEventListener('click', function () {
        applyTemplate(t.html);
      });
      grid.appendChild(card);
    });
  }

  
  // Upload index.html (or any .html) into the editor
  var uploadBtn = document.getElementById('he-upload-html-btn');
  var uploadInput = document.getElementById('he-upload-html-input');
  if (uploadBtn && uploadInput) {
    uploadBtn.addEventListener('click', function () {
      uploadInput.click();
    });
    uploadInput.addEventListener('change', function () {
      var file = uploadInput.files && uploadInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var text = String(reader.result || '');
        if (!text.trim()) {
          setSaveStatus('Empty file', 'err');
          return;
        }
        setSource(text);
        markDirty();
        setSaveStatus('Loaded ' + file.name + ' · ' + sourceStats(text) + ' — click Save', 'ok');
        renderPreview();
      };
      reader.onerror = function () {
        setSaveStatus('Could not read file', 'err');
      };
      reader.readAsText(file);
      uploadInput.value = '';
    });
  }

  var templatesBtn = document.getElementById('he-templates-btn');
  if (templatesBtn) {
    templatesBtn.addEventListener('click', function () {
      buildTemplateGrid();
      openModal('he-templates-modal');
    });
  }

  /* ---------- Media library insert ---------- */
  function insertAtCursor(snippet) {
    if (editor && editor.getModel) {
      try {
        var selection = editor.getSelection();
        var id = { major: 1, minor: 1 };
        var op = {
          identifier: id,
          range: selection,
          text: snippet,
          forceMoveMarkers: true,
        };
        editor.executeEdits('insert-media', [op]);
        editor.focus();
        return;
      } catch (e) {
        /* fall through */
      }
    }
    var current = getSource();
    var insertPoint = current.lastIndexOf('</body>');
    if (insertPoint === -1) setSource(current + '\n' + snippet + '\n');
    else setSource(current.slice(0, insertPoint) + '  ' + snippet + '\n' + current.slice(insertPoint));
  }

  function loadMediaGrid() {
    var grid = document.getElementById('he-media-grid');
    if (!grid) return;
    grid.innerHTML = '<p class="he-modal-loading">Loading…</p>';
    fetch('/admin/media/json', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        grid.innerHTML = '';
        if (!data.ok || !data.media || !data.media.length) {
          grid.innerHTML =
            '<p class="he-modal-hint">No images yet. <a href="/admin/media" >Upload media</a> first.</p>';
          return;
        }
        data.media.forEach(function (m) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'he-media-card';
          btn.title = m.filename || m.url;
          btn.innerHTML =
            '<img src="' +
            escapeHtml(m.url) +
            '" alt="' +
            escapeHtml(m.altText || m.filename || '') +
            '"><span>' +
            escapeHtml(m.filename || m.url) +
            '</span>';
          btn.addEventListener('click', function () {
            var alt = (m.altText || m.filename || 'image').replace(/"/g, '&quot;');
            var tag = '<img src="' + m.url + '" alt="' + alt + '" style="max-width:100%;height:auto;">';
            insertAtCursor(tag);
            dirty = true;
            setSaveStatus('Unsaved changes', 'warn');
            scheduleAutoSave();
            renderPreview();
            closeModal('he-media-modal');
          });
          grid.appendChild(btn);
        });
      })
      .catch(function () {
        grid.innerHTML = '<p class="he-modal-hint">Could not load media library.</p>';
      });
  }

  var mediaBtn = document.getElementById('he-media-btn');
  if (mediaBtn) {
    mediaBtn.addEventListener('click', function () {
      openModal('he-media-modal');
      loadMediaGrid();
    });
  }

  window.addEventListener('message', function (ev) {
    if (!ev || !ev.data) return;
    if (ev.data.type !== 'html-preview-height' && ev.data.type !== 'chf-resize') return;
    var frame = document.getElementById('he-preview-iframe');
    if (!frame) return;
    var h = Number(ev.data.height) || 0;
    if (h < 400) h = 400;
    if (h > 50000) h = 50000;
    frame.style.height = h + 'px';
  });

  // Start in split mode so preview is visible immediately
  setMode('split');
  setDevice('desktop');
  initMonaco();
})();
