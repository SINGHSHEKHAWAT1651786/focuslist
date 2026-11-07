export const MAX_TITLE = 120;
export const UNDO_MS = 6000;
export const RING_LENGTH = 326.7;
export const PRIORITIES = Object.freeze({ high: 'High', medium: 'Medium', low: 'Low' });
export const RANK = Object.freeze({ high: 0, medium: 1, low: 2 });
export const DEFAULT_FILTERS = Object.freeze({ query: '', status: 'all', priority: 'all' });

export const normalizeTitle = (value) => value.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE);

export const isTask = (task) => Boolean(task)
  && typeof task.id === 'string'
  && typeof task.title === 'string'
  && Object.hasOwn(PRIORITIES, task.priority)
  && typeof task.completed === 'boolean';

export const selectVisibleTasks = ({ tasks, filters: { query, status, priority } }) => {
  const normalizedQuery = query.trim().toLowerCase();

  return tasks
    .filter((task) => (!normalizedQuery || task.title.toLowerCase().includes(normalizedQuery))
      && (status === 'all' || (status === 'completed') === task.completed)
      && (priority === 'all' || task.priority === priority))
    .sort((a, b) => Number(a.completed) - Number(b.completed)
      || RANK[a.priority] - RANK[b.priority]
      || b.createdAt - a.createdAt);
};

export const selectStats = (tasks) => {
  const completed = tasks.filter((task) => task.completed).length;
  return { total: tasks.length, completed, pending: tasks.length - completed };
};

const createId = () => globalThis.crypto?.randomUUID?.()
  ?? `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const createStore = (initialTasks = [], generateId = createId) => {
  let state = {
    tasks: initialTasks,
    filters: { ...DEFAULT_FILTERS },
    editingId: null,
    undo: null,
  };
  const listeners = new Set();
  const commit = (patch) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener(state));
  };
  const mapTask = (id, update) => state.tasks.map((task) => (task.id === id ? update(task) : task));

  const actions = {
    add: (title, priority) => commit({
      tasks: [{ id: generateId(), title, priority, completed: false, createdAt: Date.now() }, ...state.tasks],
    }),
    toggle: (id) => commit({ tasks: mapTask(id, (task) => ({ ...task, completed: !task.completed })) }),
    update: (id, title, priority) => commit({
      tasks: mapTask(id, (task) => ({ ...task, title, priority })),
      editingId: null,
    }),
    remove: (id) => {
      const index = state.tasks.findIndex((task) => task.id === id);
      if (index < 0) return;
      commit({
        tasks: state.tasks.filter((task) => task.id !== id),
        editingId: null,
        undo: { task: state.tasks[index], index },
      });
    },
    undo: () => {
      if (!state.undo) return;
      const tasks = [...state.tasks];
      tasks.splice(state.undo.index, 0, state.undo.task);
      commit({ tasks, undo: null });
    },
    dismissUndo: () => commit({ undo: null }),
    clearCompleted: () => commit({ tasks: state.tasks.filter((task) => !task.completed) }),
    setFilter: (patch) => commit({ filters: { ...state.filters, ...patch }, editingId: null }),
    resetFilters: () => commit({ filters: { ...DEFAULT_FILTERS }, editingId: null }),
    startEdit: (id) => commit({ editingId: id }),
    cancelEdit: () => commit({ editingId: null }),
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    actions,
  };
};
