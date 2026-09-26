/**
 * Global client-side behaviour.
 * Progressive enhancement: the site remains usable without JavaScript.
 */

(function () {
  'use strict';

  // Mobile navigation toggle
  var navToggle = document.getElementById('navToggle');
  var mainNav = document.getElementById('mainNav');

  if (navToggle && mainNav) {
    navToggle.addEventListener('click', function () {
      var isOpen = mainNav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    mainNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mainNav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Page builder: select components, drag them into containers, and save quietly.
  var workspace = document.querySelector('.builder-workspace');
  var builder = document.querySelector('[data-page-builder]');
  if (workspace) {
    var builderStatus = document.querySelector('[data-builder-status]');
    var saveTimers = new WeakMap();
    var propertiesPanel = workspace.querySelector('[data-properties-panel]');
    var selectedTitle = workspace.querySelector('[data-selected-title]');
    var selectedHelp = workspace.querySelector('[data-selected-help]');
    var selectedCard = null;
    var selectedSettings = null;
    var selectedPlaceholder = null;
    var selectedCards = [];
    var selectionToolbar = workspace.querySelector('[data-selection-toolbar]');
    var selectionCount = workspace.querySelector('[data-selection-count]');
    var history = [];
    var future = [];
    var historyLock = false;
    var formStates = new WeakMap();

    function setBuilderStatus(text, state) {
      if (!builderStatus) return;
      builderStatus.textContent = text;
      builderStatus.classList.remove('is-saving', 'is-saved', 'is-error');
      if (state) builderStatus.classList.add(state);
    }

    function applyLiveForm(form) {
      if (!form || !form.dataset.blockId) return;
      var card = workspace.querySelector('[data-block-id="' + form.dataset.blockId + '"]');
      var preview = card && card.querySelector('.block-preview');
      var target = preview && preview.querySelector('.content-block');
      if (!target) return;
      ['width', 'height', 'minHeight', 'margin', 'padding', 'background', 'textColor', 'gap'].forEach(function (key) {
        var field = form.elements[key];
        if (!field) return;
        var cssKey = key === 'minHeight' ? 'min-height' : key === 'textColor' ? 'color' : key.replace(/[A-Z]/g, function (letter) { return '-' + letter.toLowerCase(); });
        target.style.setProperty(cssKey, field.value || '');
      });
      var display = form.elements.display;
      if (display) target.style.display = display.value || '';
      var direction = form.elements.flexDirection;
      if (direction) target.style.flexDirection = direction.value || '';
      var columns = form.elements.columns;
      if (columns && display && display.value === 'grid') {
        target.style.gridTemplateColumns = String(columns.value).includes('repeat') ? columns.value : 'repeat(' + (columns.value || 1) + ', minmax(0, 1fr))';
      }
    }

    function ensureFormField(form, name) {
      if (form.elements[name]) return form.elements[name];
      var field = document.createElement('input');
      field.type = 'hidden';
      field.name = name;
      form.appendChild(field);
      return field;
    }

    function saveBlock(form) {
      if (form.dataset.saving === 'true') {
        form.dataset.saveAgain = 'true';
        return;
      }
      form.dataset.saving = 'true';
      setBuilderStatus('Saving…', 'is-saving');
      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      }).then(function (response) {
        if (!response.ok) throw new Error('Save failed');
        setBuilderStatus('All changes saved', 'is-saved');
      }).catch(function () {
        setBuilderStatus('Could not save', 'is-error');
      }).finally(function () {
        form.dataset.saving = 'false';
        if (form.dataset.saveAgain === 'true') {
          form.dataset.saveAgain = 'false';
          saveBlock(form);
        }
      });
    }

    function queueSave(form) {
      setBuilderStatus('Unsaved changes', 'is-saving');
      window.clearTimeout(saveTimers.get(form));
      saveTimers.set(form, window.setTimeout(function () { saveBlock(form); }, 700));
    }

    function wireAutosave(form) {
      if (!form || form.dataset.autosaveWired === 'true') return;
      form.dataset.autosaveWired = 'true';
      formStates.set(form, new FormData(form));
      form.addEventListener('input', function () {
        applyLiveForm(form);
        if (!historyLock && form.dataset.historyStarted !== 'true') {
          history.push({ form: form, state: formStates.get(form) });
          form.dataset.historyStarted = 'true';
          future = [];
        }
        queueSave(form);
      });
      form.addEventListener('change', function () {
        applyLiveForm(form);
        if (!historyLock && form.dataset.historyStarted !== 'true') {
          history.push({ form: form, state: formStates.get(form) });
          future = [];
        }
        formStates.set(form, new FormData(form));
        form.dataset.historyStarted = 'false';
        queueSave(form);
      });
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        window.clearTimeout(saveTimers.get(form));
        saveBlock(form);
      });
    }

    workspace.querySelectorAll('[data-autosave="true"]').forEach(wireAutosave);

    function restoreSelectedSettings() {
      if (!selectedSettings || !selectedPlaceholder) return;
      selectedPlaceholder.parentNode.insertBefore(selectedSettings, selectedPlaceholder);
      selectedPlaceholder.remove();
      selectedSettings.open = false;
      selectedSettings = null;
      selectedPlaceholder = null;
    }

    function selectCard(card) {
      if (!card || !propertiesPanel) return;
      restoreSelectedSettings();
      if (selectedCard) selectedCard.classList.remove('is-selected');
      selectedCard = card;
      selectedCard.classList.add('is-selected');
      selectedCards = [card];
      syncSelectionToolbar();
      selectedSettings = card.querySelector('[data-block-settings]');
      if (!selectedSettings) return;
      var selectedForm = selectedSettings.querySelector('form');
      if (selectedForm) selectedForm.dataset.blockId = card.dataset.blockId;
      selectedPlaceholder = document.createElement('div');
      selectedPlaceholder.className = 'block-settings-placeholder';
      selectedPlaceholder.textContent = 'Editing in Properties';
      selectedSettings.parentNode.insertBefore(selectedPlaceholder, selectedSettings);
      propertiesPanel.replaceChildren(selectedSettings);
      selectedSettings.open = true;
      var type = card.getAttribute('data-block-type') || 'component';
      if (selectedTitle) selectedTitle.textContent = type.charAt(0).toUpperCase() + type.slice(1);
      if (selectedHelp) selectedHelp.textContent = 'Configure this component. Changes save automatically.';
      wireAutosave(selectedSettings.querySelector('form'));
      applyLiveForm(selectedSettings.querySelector('form'));
    }

    function syncSelectionToolbar() {
      if (!selectionToolbar) return;
      selectionToolbar.hidden = selectedCards.length === 0;
      if (selectionCount) selectionCount.textContent = String(selectedCards.length);
    }

    function toggleMultiSelection(card) {
      restoreSelectedSettings();
      if (selectedCard) selectedCard.classList.remove('is-selected');
      var index = selectedCards.indexOf(card);
      if (index === -1) {
        selectedCards.push(card);
        card.classList.add('is-multi-selected');
      } else {
        selectedCards.splice(index, 1);
        card.classList.remove('is-multi-selected');
      }
      selectedCard = null;
      syncSelectionToolbar();
    }

    function clearSelection() {
      restoreSelectedSettings();
      selectedCards.forEach(function (card) {
        card.classList.remove('is-selected', 'is-multi-selected');
      });
      selectedCards = [];
      selectedCard = null;
      if (selectedTitle) selectedTitle.textContent = 'Select a component';
      if (selectedHelp) selectedHelp.textContent = 'Choose a block on the canvas to edit its content, layout and animation.';
      if (propertiesPanel) propertiesPanel.innerHTML = '<div class="properties-empty"><span>↖</span><p>Select a component in the canvas to configure it here.</p></div>';
      syncSelectionToolbar();
    }

    workspace.querySelectorAll('[data-block-card]').forEach(function (card) {
      card.addEventListener('dragstart', function (event) {
        event.stopPropagation();
        event.dataTransfer.setData('text/plain', 'block:' + card.dataset.blockId);
        event.dataTransfer.effectAllowed = 'move';
        card.classList.add('is-dragging');
      });
      card.addEventListener('dragend', function () { card.classList.remove('is-dragging'); });
      card.addEventListener('click', function (event) {
        if (event.target.closest('form, input, textarea, select, button, a')) return;
        if (event.ctrlKey || event.metaKey || event.shiftKey) toggleMultiSelection(card);
        else selectCard(card);
      });
    });

    workspace.querySelectorAll('[data-resize]').forEach(function (handle) {
      handle.addEventListener('pointerdown', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var card = handle.closest('[data-block-card]');
        var form = card && card.querySelector('[data-block-settings] form');
        if (!card || !form) return;
        selectCard(card);
        form = selectedSettings && selectedSettings.querySelector('form');
        if (!form) return;
        var preview = card.querySelector('.block-preview');
        var startX = event.clientX;
        var startY = event.clientY;
        var startWidth = preview.offsetWidth;
        var startHeight = preview.offsetHeight;
        handle.setPointerCapture(event.pointerId);
        function move(moveEvent) {
          if (handle.dataset.resize === 'width') {
            ensureFormField(form, 'width').value = Math.max(80, startWidth + moveEvent.clientX - startX) + 'px';
          } else {
            ensureFormField(form, 'height').value = Math.max(60, startHeight + moveEvent.clientY - startY) + 'px';
          }
          applyLiveForm(form);
        }
        function end() {
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', end);
          queueSave(form);
        }
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', end);
      });
    });

    function restoreFormState(entry) {
      if (!entry || !entry.form) return;
      historyLock = true;
      Array.from(entry.form.elements).forEach(function (field) {
        if (!field.name) return;
        if (field.type === 'checkbox') field.checked = entry.state.get(field.name) === 'true' || entry.state.get(field.name) === 'on';
        else if (entry.state.has(field.name)) field.value = entry.state.get(field.name);
      });
      historyLock = false;
      queueSave(entry.form);
    }

    function undo() {
      var entry = history.pop();
      if (!entry) return;
      future.push({ form: entry.form, state: new FormData(entry.form) });
      restoreFormState(entry);
    }

    function redo() {
      var entry = future.pop();
      if (!entry) return;
      history.push({ form: entry.form, state: new FormData(entry.form) });
      restoreFormState(entry);
    }

    var undoButton = workspace.closest('.page-editor-main')?.querySelector('[data-editor-undo]');
    var redoButton = workspace.closest('.page-editor-main')?.querySelector('[data-editor-redo]');
    if (undoButton) undoButton.addEventListener('click', undo);
    if (redoButton) redoButton.addEventListener('click', redo);
    document.addEventListener('keydown', function (event) {
      var editingField = event.target.matches && event.target.matches('input, textarea, select, [contenteditable="true"]');
      if (!editingField && (event.key === 'Delete' || event.key === 'Backspace') && selectedCard && selectedCard.querySelector('form[onsubmit*="Delete"]')) {
        event.preventDefault();
        selectedCard.querySelector('form[onsubmit*="Delete"]').submit();
        return;
      }
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === 'z' && !event.shiftKey) { event.preventDefault(); undo(); }
      if ((event.key.toLowerCase() === 'z' && event.shiftKey) || event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
      if (!editingField && event.key.toLowerCase() === 'd' && selectedCard) {
        event.preventDefault();
        var duplicateButton = selectedCard.querySelector('[data-duplicate-tree]');
        if (duplicateButton) duplicateButton.click();
      }
    });

    var deviceSelect = workspace.closest('.page-editor-main')?.querySelector('[data-editor-device]');
    var pageBuilder = workspace.querySelector('.page-builder');
    if (deviceSelect && pageBuilder) deviceSelect.addEventListener('change', function () {
      pageBuilder.classList.remove('canvas-tablet', 'canvas-mobile');
      if (deviceSelect.value !== 'desktop') pageBuilder.classList.add('canvas-' + deviceSelect.value);
    });

    workspace.querySelectorAll('[data-select-block]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        var card = button.closest('[data-block-card]');
        if (card) toggleMultiSelection(card);
      });
    });

    workspace.querySelectorAll('[data-outline-id]').forEach(function (button) {
      button.addEventListener('click', function () {
        var card = workspace.querySelector('[data-block-id="' + button.dataset.outlineId + '"]');
        if (card) {
          selectCard(card);
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });

    workspace.querySelectorAll('[data-toggle-block]').forEach(function (button) {
      button.addEventListener('click', function () {
        var card = button.closest('[data-block-card]');
        if (card) selectCard(card);
      });
    });

    workspace.querySelectorAll('[data-duplicate-tree]').forEach(function (button) {
      button.addEventListener('click', function () {
        var card = button.closest('[data-block-card]');
        var addForm = workspace.querySelector('.builder-toolbar form');
        if (!card || !addForm) return;
        fetch(addForm.action.replace(/\/content$/, '/content/' + card.dataset.blockId + '/duplicate-tree'), {
          method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' },
        }).then(function (response) {
          if (!response.ok) throw new Error('Duplicate failed');
          window.location.reload();
        }).catch(function () { setBuilderStatus('Could not duplicate', 'is-error'); });
      });
    });

    workspace.querySelectorAll('[data-block-card]').forEach(function (card) {
      var actions = card.querySelector('.block-actions');
      if (!actions || actions.querySelector('[data-copy-tree]')) return;
      var copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'btn btn-sm';
      copyButton.textContent = 'Copy';
      copyButton.dataset.copyTree = 'true';
      actions.insertBefore(copyButton, actions.firstChild);
      copyButton.addEventListener('click', function () {
        localStorage.setItem('builder-copied-block', card.dataset.blockId);
        setBuilderStatus('Component copied', 'is-saved');
      });
    });

    var pasteButton = document.createElement('button');
    pasteButton.type = 'button';
    pasteButton.className = 'btn btn-secondary btn-sm';
    pasteButton.textContent = 'Paste';
    pasteButton.title = 'Paste copied component into the selected container';
    var builderToolbar = workspace.querySelector('.builder-toolbar-main');
    if (builderToolbar) {
      builderToolbar.appendChild(pasteButton);
      pasteButton.addEventListener('click', function () {
        var copiedId = localStorage.getItem('builder-copied-block');
        if (!copiedId || !topAddForm) return;
        var parentId = selectedCard && ['section', 'row', 'column', 'container', 'grid'].includes(selectedCard.dataset.blockType) ? selectedCard.dataset.blockId : '';
        fetch(topAddForm.action.replace(/\/content$/, '/content/' + copiedId + '/duplicate-tree'), {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({ parentId: parentId || null }),
        }).then(function (response) {
          if (!response.ok) throw new Error('Paste failed');
          window.location.reload();
        }).catch(function () { setBuilderStatus('Could not paste component', 'is-error'); });
      });
    }

    var wrapButton = workspace.querySelector('[data-wrap-selection]');
    if (wrapButton) wrapButton.addEventListener('click', function () {
      var addForm = workspace.querySelector('.builder-toolbar form');
      if (!addForm || selectedCards.length < 1) return;
      var ids = selectedCards.map(function (card) { return card.dataset.blockId; });
      fetch(addForm.action.replace(/\/content$/, '/content/wrap'), {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ ids: ids, type: 'column', display: 'grid', columns: 2, gap: '1.5rem' }),
      }).then(function (response) {
        if (!response.ok) throw new Error('Wrap failed');
        window.location.reload();
      }).catch(function () { setBuilderStatus('Select sibling blocks to wrap', 'is-error'); });
    });
    var clearButton = workspace.querySelector('[data-clear-selection]');
    if (clearButton) clearButton.addEventListener('click', clearSelection);

    function submitAdd(form, type) {
      if (!form || !type) return;
      var select = form.querySelector('select[name="type"]');
      if (!select) return;
      var parentInput = form.querySelector('input[name="parentId"]');
      if (!parentInput) {
        parentInput = document.createElement('input');
        parentInput.type = 'hidden';
        parentInput.name = 'parentId';
        form.appendChild(parentInput);
      }
      var selectedParent = selectedCard;
      if (selectedParent && !['section', 'row', 'column', 'container', 'grid'].includes(selectedParent.dataset.blockType)) {
        selectedParent = selectedParent.parentElement?.closest('[data-block-card]');
      }
      parentInput.value = selectedParent ? selectedParent.dataset.blockId : '';
      select.value = type;
      form.submit();
    }

    var topAddForm = workspace.querySelector('.builder-toolbar form');
    workspace.querySelectorAll('[data-component-type]').forEach(function (item) {
      item.addEventListener('click', function () { submitAdd(topAddForm, item.dataset.componentType); });
      item.addEventListener('dragstart', function (event) {
        event.dataTransfer.setData('text/plain', item.dataset.componentType);
        event.dataTransfer.effectAllowed = 'copy';
      });
    });

    workspace.querySelectorAll('[data-add-element]').forEach(function (button) {
      button.addEventListener('click', function () {
        var containerCard = button.closest('[data-block-card]');
        if (containerCard) selectCard(containerCard);
        var librarySearch = workspace.querySelector('[data-component-search]');
        if (librarySearch) librarySearch.focus();
        var library = workspace.querySelector('.component-library');
        if (library) library.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });

    workspace.querySelectorAll('.builder-dropzone, [data-page-builder]').forEach(function (target) {
      target.addEventListener('dragover', function (event) {
        event.preventDefault();
        target.classList.add('is-drop-target');
      });
      target.addEventListener('dragleave', function () { target.classList.remove('is-drop-target'); });
      target.addEventListener('drop', function (event) {
        event.preventDefault();
        event.stopPropagation();
        target.classList.remove('is-drop-target');
        var payload = event.dataTransfer.getData('text/plain');
        if (payload.indexOf('block:') === 0) {
          moveExistingBlock(payload.slice(6), target.classList.contains('builder-dropzone') ? target.querySelector('input[name="parentId"]')?.value || '' : '');
          return;
        }
        var form = target.classList.contains('builder-dropzone') ? target.querySelector('form') : topAddForm;
        submitAdd(form, payload);
      });
    });

    function moveExistingBlock(blockId, parentId, order) {
      if (!topAddForm || !blockId) return;
      var endpoint = topAddForm.action.replace(/\/content$/, '/content/' + blockId + '/move-to');
      fetch(endpoint, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ parentId: parentId || null, order: order || null }),
      }).then(function (response) {
        if (!response.ok) throw new Error('Move failed');
        window.location.reload();
      }).catch(function () { setBuilderStatus('Invalid move', 'is-error'); });
    }

    workspace.querySelectorAll('[data-block-card]').forEach(function (targetCard) {
      targetCard.addEventListener('dragover', function (event) {
        if (event.dataTransfer.types.includes('text/plain')) {
          event.preventDefault();
          targetCard.classList.add('is-drop-target');
        }
      });
      targetCard.addEventListener('dragleave', function () { targetCard.classList.remove('is-drop-target'); });
      targetCard.addEventListener('drop', function (event) {
        event.preventDefault();
        event.stopPropagation();
        targetCard.classList.remove('is-drop-target');
        var payload = event.dataTransfer.getData('text/plain');
        if (payload.indexOf('block:') !== 0 || payload.slice(6) === targetCard.dataset.blockId) return;
        moveExistingBlock(payload.slice(6), targetCard.dataset.parentId || '', targetCard.dataset.blockOrder);
      });
    });

    var search = workspace.querySelector('[data-component-search]');
    if (search) {
      search.addEventListener('input', function () {
        var term = search.value.toLowerCase().trim();
        workspace.querySelectorAll('.component-item').forEach(function (item) {
          item.hidden = term && !item.textContent.toLowerCase().includes(term);
        });
        workspace.querySelectorAll('.component-group').forEach(function (group) {
          group.hidden = !group.querySelector('.component-item:not([hidden])');
        });
      });
    }
  }

  // Nav dropdown toggles
  document.querySelectorAll('.nav-dropdown-toggle').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var parent = btn.closest('.nav-item-dropdown');
      if (!parent) return;
      var open = parent.classList.contains('open');
      document.querySelectorAll('.nav-item-dropdown.open').forEach(function (el) {
        el.classList.remove('open');
        var t = el.querySelector('.nav-dropdown-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
      if (!open) {
        parent.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav-item-dropdown')) {
      document.querySelectorAll('.nav-item-dropdown.open').forEach(function (el) {
        el.classList.remove('open');
      });
    }
  });

  // Quiz interaction
  document.querySelectorAll('.content-quiz').forEach(function (quiz) {
    var correctIndex = parseInt(quiz.getAttribute('data-correct'), 10);
    var explanation = quiz.querySelector('.quiz-explanation');
    quiz.querySelectorAll('.quiz-option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (quiz.classList.contains('answered')) return;
        quiz.classList.add('answered');
        var index = parseInt(btn.getAttribute('data-index'), 10);
        quiz.querySelectorAll('.quiz-option').forEach(function (b, i) {
          b.disabled = true;
          if (i === correctIndex) b.classList.add('correct');
          else if (i === index) b.classList.add('wrong');
        });
        if (explanation) explanation.hidden = false;
      });
    });
  });

  // Page search filters visible content blocks without requiring a server request.
  document.querySelectorAll('[data-page-search]').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var input = form.querySelector('[data-page-search-input]');
      var term = (input ? input.value : '').trim().toLowerCase();
      var page = form.closest('main') || document;
      page.querySelectorAll('.content-block').forEach(function (block) {
        if (block === form || block.contains(form)) return;
        block.hidden = Boolean(term && !block.textContent.toLowerCase().includes(term));
      });
    });
    form.querySelector('[data-page-search-input]')?.addEventListener('input', function (event) {
      if (event.target.value === '') form.dispatchEvent(new Event('submit', { cancelable: true }));
    });
  });

  // Scroll-triggered animations
  var scrollAnimEls = document.querySelectorAll('.anim-on-scroll');
  if (scrollAnimEls.length) {
    if ('IntersectionObserver' in window) {
      var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) {
        scrollAnimEls.forEach(function (el) { el.classList.add('is-visible'); });
      } else {
        var observer = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
        );
        scrollAnimEls.forEach(function (el) { observer.observe(el); });
      }
    } else {
      scrollAnimEls.forEach(function (el) { el.classList.add('is-visible'); });
    }
  }
})();
