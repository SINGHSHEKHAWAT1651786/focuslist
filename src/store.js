import {
  DEFAULT_FILTERS,
  MAX_TITLE_LENGTH,
  MAX_UNDO_ACTIONS,
  normalizeTitle,
  PRIORITIES,
} from "./task-model.js";

function createId() {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createStore(initialTasks = []) {
  let state = {
    tasks: initialTasks,
    filters: { ...DEFAULT_FILTERS },
    drafts: {},
    undoStack: [],
    externalSync: false,
  };
  const listeners = new Set();

  function commit(patch, reason) {
    const next = { ...state, ...patch };
    if (
      next.tasks === state.tasks &&
      next.filters === state.filters &&
      next.drafts === state.drafts &&
      next.undoStack === state.undoStack &&
      next.externalSync === state.externalSync
    ) {
      return;
    }
    state = next;
    listeners.forEach((listener) => listener(state, reason));
  }

  function pushUndo(action) {
    return [...state.undoStack, action].slice(-MAX_UNDO_ACTIONS);
  }

  const actions = {
    add(title, priority) {
      const cleanTitle = normalizeTitle(title);
      if (!cleanTitle || cleanTitle.length > MAX_TITLE_LENGTH || !PRIORITIES.includes(priority)) {
        return null;
      }
      const task = {
        id: createId(),
        title: cleanTitle,
        priority,
        completed: false,
        createdAt: Date.now(),
      };
      commit({
        tasks: [task, ...state.tasks],
        filters: { ...DEFAULT_FILTERS },
        externalSync: false,
      }, "add");
      return task;
    },

    toggle(id) {
      const tasks = state.tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task,
      );
      if (tasks.every((task, index) => task === state.tasks[index])) {
        return false;
      }
      commit({ tasks, externalSync: false }, "toggle");
      return true;
    },

    remove(id) {
      const index = state.tasks.findIndex((task) => task.id === id);
      if (index < 0) {
        return null;
      }
      const task = state.tasks[index];
      const drafts = { ...state.drafts };
      const draft = drafts[id];
      delete drafts[id];
      commit({
        tasks: state.tasks.filter((item) => item.id !== id),
        drafts,
        undoStack: pushUndo({ type: "restore", entries: [{ task, index, draft }], label: `Deleted “${task.title}”` }),
        externalSync: false,
      }, "remove");
      return task;
    },

    clearCompleted() {
      const entries = state.tasks.flatMap((task, index) =>
        task.completed ? [{ task, index, draft: state.drafts[task.id] }] : [],
      );
      if (entries.length === 0) {
        return 0;
      }
      const drafts = { ...state.drafts };
      entries.forEach(({ task }) => delete drafts[task.id]);
      commit({
        tasks: state.tasks.filter((task) => !task.completed),
        drafts,
        undoStack: pushUndo({ type: "restore", entries, label: `Cleared ${entries.length} completed ${entries.length === 1 ? "task" : "tasks"}` }),
        externalSync: false,
      }, "clear-completed");
      return entries.length;
    },

    undo() {
      const action = state.undoStack.at(-1);
      if (!action) {
        return null;
      }
      const tasks = [...state.tasks];
      const drafts = { ...state.drafts };
      action.entries.forEach(({ task, index }) => {
        tasks.splice(Math.min(index, tasks.length), 0, task);
      });
      action.entries.forEach(({ task, draft }) => {
        if (draft) {
          drafts[task.id] = draft;
        }
      });
      commit({
        tasks,
        drafts,
        undoStack: state.undoStack.slice(0, -1),
        externalSync: false,
      }, "undo");
      return action;
    },

    dismissUndo() {
      if (state.undoStack.length === 0) {
        return;
      }
      commit({ undoStack: [], externalSync: false }, "dismiss-undo");
    },

    startEdit(id) {
      const task = state.tasks.find((item) => item.id === id);
      if (!task || Object.hasOwn(state.drafts, id)) {
        return false;
      }
      commit({ drafts: { ...state.drafts, [id]: { title: task.title, priority: task.priority } } }, "start-edit");
      return true;
    },

    updateDraft(id, field, value) {
      const draft = state.drafts[id];
      if (!draft || (field !== "title" && field !== "priority")) {
        return;
      }
      if (field === "priority" && !PRIORITIES.includes(value)) {
        return;
      }
      commit({
        drafts: { ...state.drafts, [id]: { ...draft, [field]: value } },
      }, "draft");
    },

    saveEdit(id) {
      const draft = state.drafts[id];
      if (!draft) {
        return { saved: false, error: "This task is no longer being edited." };
      }
      const title = normalizeTitle(draft.title);
      if (!title) {
        return { saved: false, error: "Enter a task title before saving." };
      }
      if (title.length > MAX_TITLE_LENGTH) {
        return { saved: false, error: `Use ${MAX_TITLE_LENGTH} characters or fewer.` };
      }

      const tasks = state.tasks.map((task) =>
        task.id === id ? { ...task, title, priority: draft.priority } : task,
      );
      const drafts = { ...state.drafts };
      delete drafts[id];
      commit({ tasks, drafts, externalSync: false }, "save-edit");
      return { saved: true, task: tasks.find((task) => task.id === id) };
    },

    cancelEdit(id) {
      if (!Object.hasOwn(state.drafts, id)) {
        return false;
      }
      const drafts = { ...state.drafts };
      delete drafts[id];
      commit({ drafts }, "cancel-edit");
      return true;
    },

    setFilters(patch) {
      const filters = { ...state.filters, ...patch };
      if (
        filters.status === state.filters.status &&
        filters.priority === state.filters.priority &&
        filters.query === state.filters.query
      ) {
        return;
      }
      commit({ filters }, "filters");
    },

    sync(tasks) {
      const remoteIds = new Set(tasks.map((task) => task.id));
      const editingTasks = state.tasks.filter((task) => state.drafts[task.id] && !remoteIds.has(task.id));
      const mergedTasks = [...tasks, ...editingTasks];
      commit({
        tasks: mergedTasks,
        drafts: Object.fromEntries(
          Object.entries(state.drafts).filter(([id]) =>
            remoteIds.has(id) || editingTasks.some((task) => task.id === id),
          ),
        ),
        undoStack: [],
        externalSync: editingTasks.length === 0,
      }, "external-sync");
    },
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    actions,
  };
}
