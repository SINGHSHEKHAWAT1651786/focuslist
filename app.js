(() => {
  'use strict';

  /* ===== Constants ===== */
  const STORAGE_KEY = 'focuslist:v1';
  const MAX_TITLE = 120;
  const UNDO_MS = 6000;
  const RING_LENGTH = 326.7; // 2π × r(52)
  const PRIORITIES = { high: 'High', medium: 'Medium', low: 'Low' };
  const RANK = { high: 0, medium: 1, low: 2 };
  const DEFAULT_FILTERS = Object.freeze({ query: '', status: 'all', priority: 'all' });

  /* ===== Helpers ===== */
  const $ = (selector, root = document) => root.querySelector(selector);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
  const normalizeTitle = (value) => value.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE);

  /** Tiny DOM builder: text is always inserted as text nodes, so user input is never parsed as HTML. */
  const h = (tag, props = {}, ...children) => {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key === 'class') el.className = value;
      else if (key === 'dataset') Object.assign(el.dataset, value);
      else if (key in el) el[key] = value;
      else el.setAttribute(key, value);
    }
    el.append(...children.flat().filter(Boolean));
    return el;
  };

  /* ===== Persistence ===== */
  const isTask = (t) => Boolean(t) && typeof t.id === 'string' && typeof t.title === 'string'
    && t.priority in PRIORITIES && typeof t.completed === 'boolean';

  const storage = {
    load() {
      try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return Array.isArray(data) ? data.filter(isTask).map((t) => ({ ...t, createdAt: Number(t.createdAt) || 0 })) : [];
      } catch { return []; }
    },
    save(tasks) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
      catch { /* storage unavailable: keep working in memory */ }
    },
  };

  /* ===== Store (single source of truth) ===== */
  const createStore = (initialTasks) => {
    let state = { tasks: initialTasks, filters: { ...DEFAULT_FILTERS }, editingId: null, undo: null };
    const listeners = new Set();
    const commit = (patch) => { state = { ...state, ...patch }; listeners.forEach((fn) => fn(state)); };
    const mapTask = (id, fn) => state.tasks.map((t) => (t.id === id ? fn(t) : t));

    return {
      getState: () => state,
      subscribe: (fn) => listeners.add(fn),
      actions: {
        add: (title, priority) => commit({ tasks: [{ id: uid(), title, priority, completed: false, createdAt: Date.now() }, ...state.tasks] }),
        toggle: (id) => commit({ tasks: mapTask(id, (t) => ({ ...t, completed: !t.completed })) }),
        update: (id, title, priority) => commit({ tasks: mapTask(id, (t) => ({ ...t, title, priority })), editingId: null }),
        remove: (id) => {
          const index = state.tasks.findIndex((t) => t.id === id);
          if (index < 0) return;
          commit({ tasks: state.tasks.filter((t) => t.id !== id), editingId: null, undo: { task: state.tasks[index], index } });
        },
        undo: () => {
          if (!state.undo) return;
          const tasks = [...state.tasks];
          tasks.splice(state.undo.index, 0, state.undo.task);
          commit({ tasks, undo: null });
        },
        dismissUndo: () => commit({ undo: null }),
        clearCompleted: () => commit({ tasks: state.tasks.filter((t) => !t.completed) }),
        setFilter: (patch) => commit({ filters: { ...state.filters, ...patch }, editingId: null }),
        resetFilters: () => commit({ filters: { ...DEFAULT_FILTERS }, editingId: null }),
        startEdit: (id) => commit({ editingId: id }),
        cancelEdit: () => commit({ editingId: null }),
      },
    };
  };

  /* ===== Selectors (derived data, never stored) ===== */
  const selectVisibleTasks = ({ tasks, filters: { query, status, priority } }) => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((t) => (!q || t.title.toLowerCase().includes(q))
        && (status === 'all' || (status === 'completed') === t.completed)
        && (priority === 'all' || t.priority === priority))
      .sort((a, b) => a.completed - b.completed || RANK[a.priority] - RANK[b.priority] || b.createdAt - a.createdAt);
  };

  const selectStats = (tasks) => {
    const completed = tasks.filter((t) => t.completed).length;
    return { total: tasks.length, completed, pending: tasks.length - completed };
  };

  /* ===== View ===== */
  const actionButton = (label, action, task) => h('button', {
    type: 'button',
    class: `btn btn-ghost${action === 'delete' ? ' btn-danger' : ''}`,
    dataset: { action },
    'aria-label': `${label} task: ${task.title}`,
  }, label);

  const taskAttrs = (task, extra = '') => ({ class: `task${extra}`, dataset: { id: task.id, priority: task.priority, done: String(task.completed) } });

  const renderTaskItem = (task, isFocus) => h('li', taskAttrs(task, isFocus ? ' is-focus' : ''),
    h('input', { type: 'checkbox', class: 'check', id: `chk-${task.id}`, checked: task.completed, dataset: { action: 'toggle' } }),
    h('div', { class: 'task-body' },
      isFocus && !task.completed && h('span', { class: 'up-next' }, 'Up next'),
      h('label', { class: 'task-title', htmlFor: `chk-${task.id}` }, task.title),
      h('span', { class: 'badge' }, h('b', {}, h('i'), h('i'), h('i')), PRIORITIES[task.priority])),
    h('div', { class: 'task-actions' }, actionButton('Edit', 'edit', task), actionButton('Delete', 'delete', task)));

  const renderEditItem = (task) => {
    const select = h('select', { class: 'field', name: 'priority', 'aria-label': 'Priority' },
      ...Object.entries(PRIORITIES).map(([value, text]) => h('option', { value }, text)));
    select.value = task.priority;
    return h('li', taskAttrs(task),
      h('form', { class: 'edit-form' },
        h('label', { class: 'sr-only', htmlFor: `edit-${task.id}` }, 'Task title'),
        h('input', { class: 'field edit-input', id: `edit-${task.id}`, name: 'title', value: task.title, maxLength: MAX_TITLE, autocomplete: 'off' }),
        select,
        h('div', { class: 'task-actions' },
          h('button', { type: 'submit', class: 'btn btn-primary' }, 'Save'),
          h('button', { type: 'button', class: 'btn btn-ghost', dataset: { action: 'cancel' } }, 'Cancel'))));
  };

  const renderDate = () => {
    const now = new Date();
    const fmt = (opts) => new Intl.DateTimeFormat(undefined, opts).format(now);
    $('#date').replaceChildren(`${fmt({ weekday: 'long' })},`, h('br'), fmt({ day: 'numeric', month: 'long' }));
  };

  const renderProgress = (tasks) => {
    const { total, completed, pending } = selectStats(tasks);
    const percent = total ? Math.round((completed / total) * 100) : 0;
    $('#stat-total').textContent = total;
    $('#stat-completed').textContent = completed;
    $('#stat-pending').textContent = pending;
    $('#pct').textContent = `${percent}%`;
    $('#ring-fg').style.strokeDashoffset = RING_LENGTH * (1 - percent / 100);
    $('#ring').dataset.done = String(total > 0 && pending === 0);
    $('#ring').setAttribute('aria-valuenow', percent);
    $('#headline').textContent = !total ? 'Start your day' : pending ? `${pending} to go` : 'All clear';
    $('#subline').textContent = !total ? 'Add your first task below.' : pending ? `${completed} of ${total} done` : 'Everything is done. Nice work.';
  };

  const syncValue = (el, value) => { if (el.value !== value) el.value = value; };

  const renderFilters = ({ query, status, priority }) => {
    document.querySelectorAll('[data-status]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.status === status)));
    document.querySelectorAll('[data-pfilter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pfilter === priority)));
    syncValue($('#search'), query);
  };

  const renderList = (state) => {
    const visible = selectVisibleTasks(state);
    const hasTasks = state.tasks.length > 0;
    const focusId = state.filters.status === 'completed' ? null : visible.find((t) => !t.completed)?.id;
    $('#task-list').replaceChildren(...visible.map((t) => (t.id === state.editingId ? renderEditItem(t) : renderTaskItem(t, t.id === focusId))));
    $('#empty').hidden = visible.length > 0;
    $('#empty-title').textContent = hasTasks ? 'No tasks match your filters' : 'Nothing on your list yet';
    $('#empty-hint').textContent = hasTasks ? 'Try a different search or reset the filters.' : 'Add your first task and choose how urgent it is.';
    $('#reset-filters').hidden = !hasTasks;
    $('#result-count').textContent = hasTasks ? `Showing ${visible.length} of ${state.tasks.length} tasks` : '';
    $('#clear-completed').hidden = !state.tasks.some((t) => t.completed);
  };

  const renderToast = ({ undo }) => {
    $('#toast').hidden = !undo;
    $('#toast-msg').textContent = undo ? `Deleted “${undo.task.title}”` : '';
  };

  const render = (state) => { renderProgress(state.tasks); renderFilters(state.filters); renderList(state); renderToast(state); };

  /* ===== Controllers (DOM events -> store actions) ===== */
  const focusTaskControl = (id, action) => $(`[data-id="${CSS.escape(id)}"] [data-action="${action}"]`)?.focus();

  const bindAddForm = ({ add }) => {
    const input = $('#new-title');
    const error = $('#add-error');
    input.maxLength = MAX_TITLE;
    input.addEventListener('input', () => { error.textContent = ''; input.removeAttribute('aria-invalid'); });
    $('#add-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const title = normalizeTitle(input.value);
      if (!title) {
        error.textContent = 'Enter a task title to add it to your list.';
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      add(title, $('input[name="new-priority"]:checked').value);
      input.value = '';
      input.focus();
    });
  };

  const bindFilters = ({ setFilter, resetFilters, clearCompleted }) => {
    const onPress = (selector, key, attr) => $(selector).addEventListener('click', (e) => {
      const button = e.target.closest(`[data-${attr}]`);
      if (button) setFilter({ [key]: button.dataset[key === 'priority' ? 'pfilter' : 'status'] });
    });
    onPress('#status-filter', 'status', 'status');
    onPress('#pfilter', 'priority', 'pfilter');
    $('#search').addEventListener('input', (e) => setFilter({ query: e.target.value }));
    $('#reset-filters').addEventListener('click', () => resetFilters());
    $('#clear-completed').addEventListener('click', () => clearCompleted());
  };

  const bindList = ({ actions }) => {
    const list = $('#task-list');
    const idOf = (el) => el.closest('[data-id]')?.dataset.id;
    const leaveEdit = (id) => { actions.cancelEdit(); focusTaskControl(id, 'edit'); };
    const handlers = {
      edit: (id) => { actions.startEdit(id); $('.edit-input', list)?.focus(); },
      delete: (id) => actions.remove(id),
      cancel: leaveEdit,
    };

    list.addEventListener('change', (e) => {
      if (e.target.matches('[data-action="toggle"]')) actions.toggle(idOf(e.target));
    });
    list.addEventListener('click', (e) => {
      const button = e.target.closest('button[data-action]');
      if (button) handlers[button.dataset.action]?.(idOf(button));
    });
    list.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = idOf(e.target);
      const data = new FormData(e.target);
      const title = normalizeTitle(String(data.get('title')));
      if (!title) { $('.edit-input', e.target).focus(); return; }
      actions.update(id, title, String(data.get('priority')));
      focusTaskControl(id, 'edit');
    });
    list.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && e.target.closest('.edit-form')) leaveEdit(idOf(e.target));
    });
  };

  const bindShortcuts = () => document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const target = { n: '#new-title', '/': '#search' }[e.key];
    if (target) { e.preventDefault(); $(target).focus(); }
  });

  /* ===== Bootstrap ===== */
  const init = () => {
    const store = createStore(storage.load());
    let savedTasks = store.getState().tasks;
    let lastUndo = null;
    let undoTimer = 0;

    store.subscribe((state) => {
      if (state.tasks !== savedTasks) { savedTasks = state.tasks; storage.save(state.tasks); }
      if (state.undo !== lastUndo) {
        lastUndo = state.undo;
        clearTimeout(undoTimer);
        if (state.undo) undoTimer = setTimeout(store.actions.dismissUndo, UNDO_MS);
      }
      render(state);
    });

    bindAddForm(store.actions);
    bindFilters(store.actions);
    bindList(store);
    bindShortcuts();
    $('#undo').addEventListener('click', () => store.actions.undo());
    renderDate();
    render(store.getState());
  };

  init();
})();