import {
  DEFAULT_FILTERS,
  getNextTaskId,
  getStatistics,
  getVisibleTasks,
  MAX_TITLE_LENGTH,
  PRIORITIES,
} from "./task-model.js";
import { loadTasks, parseStorageEvent, saveTasks, STORAGE_KEY } from "./storage.js";
import { createStore } from "./store.js";

const elements = {
  announcements: document.querySelector("#announcements"),
  date: document.querySelector("#today-date"),
  welcomeTitle: document.querySelector("#welcome-title"),
  welcomeSubtitle: document.querySelector("#welcome-subtitle"),
  progressPercent: document.querySelector("#progress-percent"),
  progressTrack: document.querySelector(".progress-track"),
  progressBar: document.querySelector("#progress-bar"),
  totalCount: document.querySelector("#total-count"),
  pendingCount: document.querySelector("#pending-count"),
  completedCount: document.querySelector("#completed-count"),
  taskForm: document.querySelector("#task-form"),
  titleInput: document.querySelector("#new-title"),
  titleCount: document.querySelector("#title-count"),
  titleError: document.querySelector("#title-error"),
  priorityInput: document.querySelector("#new-priority"),
  search: document.querySelector("#task-search"),
  priorityFilter: document.querySelector("#priority-filter"),
  filterButtons: [...document.querySelectorAll("[data-status-filter]")],
  clearCompleted: document.querySelector("#clear-completed"),
  taskList: document.querySelector("#task-list"),
  emptyState: document.querySelector("#empty-state"),
  emptyTitle: document.querySelector("#empty-title"),
  emptyCopy: document.querySelector("#empty-copy"),
  visibleCount: document.querySelector("#visible-count"),
  resultSummary: document.querySelector("#result-summary"),
  undoNotice: document.querySelector("#undo-notice"),
  undoMessage: document.querySelector("#undo-message"),
  undoButton: document.querySelector("#undo-button"),
  dismissUndo: document.querySelector("#dismiss-undo"),
  saveStatus: document.querySelector("#save-status"),
  storageWarning: document.querySelector("#storage-warning"),
  listError: document.querySelector("#list-error"),
};

const loaded = loadTasks();
const store = createStore(loaded.tasks);
const { actions } = store;
let lastSavedTasks = loaded.tasks;
let announcementTimer;
let searchTimer;

function announce(message) {
  window.clearTimeout(announcementTimer);
  elements.announcements.textContent = "";
  announcementTimer = window.setTimeout(() => {
    elements.announcements.textContent = message;
  }, 20);
}

function setDate() {
  const now = new Date();
  const label = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);
  elements.date.dateTime = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  elements.date.textContent = label;

  const nextMidnight = new Date(now);
  nextMidnight.setMilliseconds(0);
  nextMidnight.setHours(24, 0, 0, 50);
  window.setTimeout(setDate, Math.max(1000, nextMidnight.getTime() - now.getTime()));
}

function createButton(label, className, control) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.dataset.control = control;
  button.setAttribute("aria-label", label);
  return button;
}

function createTaskRow(task, draft, nextTaskId) {
  const row = document.createElement("li");
  row.className = `task-row${task.completed ? " is-completed" : ""}${draft ? " is-editing" : ""}`;
  row.dataset.taskId = task.id;

  const checkLabel = document.createElement("label");
  checkLabel.className = "check-label";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.completed;
  checkbox.dataset.control = "checkbox";
  checkbox.setAttribute(
    "aria-label",
    `${task.completed ? "Mark as active" : "Mark as complete"}: ${task.title}`,
  );
  const checkVisual = document.createElement("span");
  checkVisual.className = "check-visual";
  checkVisual.setAttribute("aria-hidden", "true");
  checkLabel.append(checkbox, checkVisual);
  row.append(checkLabel);

  const content = document.createElement("div");
  content.className = "task-content";
  if (draft) {
    const form = document.createElement("form");
    form.className = "edit-form";
    form.dataset.taskId = task.id;
    form.noValidate = true;

    const title = document.createElement("input");
    title.type = "text";
    title.maxLength = MAX_TITLE_LENGTH;
    title.value = draft.title;
    title.dataset.control = "edit-title";
    title.setAttribute("aria-label", `Edit task title: ${task.title}`);
    const titleCount = document.createElement("span");
    titleCount.className = "edit-count";
    titleCount.textContent = `${draft.title.length} / ${MAX_TITLE_LENGTH}`;

    const priority = document.createElement("select");
    priority.dataset.control = "edit-priority";
    priority.setAttribute("aria-label", `Priority for ${task.title}`);
    PRIORITIES.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = `${value[0].toUpperCase()}${value.slice(1)} priority`;
      option.selected = value === draft.priority;
      priority.append(option);
    });

    const controls = document.createElement("div");
    controls.className = "edit-actions";
    const save = createButton("Save", "button button-primary button-small", "save");
    save.type = "submit";
    save.dataset.taskId = task.id;
    const cancel = createButton("Cancel", "button button-quiet button-small", "cancel");
    cancel.dataset.taskId = task.id;
    controls.append(save, cancel);
    form.append(title, titleCount, priority, controls);
    content.append(form);
  } else {
    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = task.title;
    content.append(title);
  }

  const metadata = document.createElement("div");
  metadata.className = "task-meta";
  const badge = document.createElement("span");
  badge.className = `priority-badge priority-${task.priority}`;
  const dot = document.createElement("span");
  dot.className = "priority-dot";
  dot.setAttribute("aria-hidden", "true");
  const priorityText = document.createElement("span");
  priorityText.textContent = `Priority: ${task.priority[0].toUpperCase()}${task.priority.slice(1)}`;
  badge.append(dot, priorityText);
  metadata.append(badge);
  if (task.id === nextTaskId && !task.completed) {
    const next = document.createElement("span");
    next.className = "next-label";
    next.textContent = "Up next";
    metadata.append(next);
  }
  content.append(metadata);
  row.append(content);

  const taskActions = document.createElement("div");
  taskActions.className = "task-actions";
  if (!draft) {
    const edit = createButton("Edit", "icon-button", "edit");
    edit.dataset.taskId = task.id;
    edit.setAttribute("aria-label", `Edit ${task.title}`);
    const remove = createButton("Delete", "icon-button", "delete");
    remove.dataset.taskId = task.id;
    remove.setAttribute("aria-label", `Delete ${task.title}`);
    taskActions.append(edit, remove);
  }
  row.append(taskActions);
  return row;
}

function captureListFocus() {
  const active = document.activeElement;
  const row = active?.closest?.("[data-task-id]");
  if (!row || !elements.taskList.contains(row)) {
    return null;
  }
  let control = active.dataset.control;
  if (control === "save" || control === "cancel") {
    control = "edit";
  }
  return { id: row.dataset.taskId, control };
}

function focusTaskControl(id, control) {
  const row = [...elements.taskList.querySelectorAll("[data-task-id]")]
    .find((item) => item.dataset.taskId === id);
  const target = row && [...row.querySelectorAll("[data-control]")]
    .find((item) => item.dataset.control === control);
  target?.focus();
  return Boolean(target);
}

function renderTasks(state) {
  const focus = captureListFocus();
  const visible = getVisibleTasks(state.tasks, state.filters);
  const nextTaskId = getNextTaskId(state.tasks);
  const fragment = document.createDocumentFragment();

  visible.forEach((task) => {
    fragment.append(createTaskRow(task, state.drafts[task.id], nextTaskId));
  });
  elements.taskList.replaceChildren(fragment, elements.emptyState);

  const noTasks = state.tasks.length === 0;
  const noMatches = !noTasks && visible.length === 0;
  elements.emptyState.hidden = visible.length > 0;
  elements.emptyTitle.textContent = noTasks
    ? "Your list is clear."
    : noMatches
      ? "No matching tasks."
      : "Nothing here yet.";
  elements.emptyCopy.textContent = noTasks
    ? "Add a task above to get started."
    : noMatches
      ? "Try changing your search or filters."
      : "Add a task or choose a different filter.";

  const count = visible.length;
  const total = state.tasks.length;
  elements.visibleCount.textContent = String(count);
  elements.resultSummary.textContent =
    count === total
      ? `${total} ${total === 1 ? "task" : "tasks"}`
      : `Showing ${count} of ${total} ${total === 1 ? "task" : "tasks"}`;
  elements.clearCompleted.disabled = !state.tasks.some((task) => task.completed);
  elements.filterButtons.forEach((button) => {
    const selected = button.dataset.statusFilter === state.filters.status;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  elements.priorityFilter.value = state.filters.priority;

  if (focus && !focusTaskControl(focus.id, focus.control)) {
    focusTaskControl(focus.id, "edit");
  }
}

function renderStatistics(tasks) {
  const statistics = getStatistics(tasks);
  elements.totalCount.textContent = String(statistics.total);
  elements.pendingCount.textContent = String(statistics.pending);
  elements.completedCount.textContent = String(statistics.completed);
  elements.progressPercent.textContent = `${statistics.percent}%`;
  elements.progressBar.style.width = `${statistics.percent}%`;
  elements.progressTrack.setAttribute("aria-valuenow", String(statistics.percent));

  if (statistics.total === 0) {
    elements.welcomeTitle.textContent = "Make room for what matters.";
    elements.welcomeSubtitle.textContent = "A little progress adds up. Choose your next step.";
  } else if (statistics.pending === 0) {
    elements.welcomeTitle.textContent = "You did it. Take a breath.";
    elements.welcomeSubtitle.textContent = "Everything on your list is complete.";
  } else {
    elements.welcomeTitle.textContent = "Make room for what matters.";
    elements.welcomeSubtitle.textContent = `${statistics.pending} ${statistics.pending === 1 ? "task" : "tasks"} left. Choose your next step.`;
  }
}

function renderUndo(state) {
  const lastAction = state.undoStack.at(-1);
  elements.undoNotice.hidden = !lastAction;
  if (lastAction) {
    const count = state.undoStack.length;
    elements.undoMessage.textContent =
      `${lastAction.label}. ${count} ${count === 1 ? "action" : "actions"} available to undo.`;
    elements.undoButton.textContent = count > 1 ? "Undo last action" : "Undo";
  }
}

function render(state, reason) {
  if (reason === "draft") {
    return;
  }
  renderTasks(state);
  renderStatistics(state.tasks);
  renderUndo(state);
}

function restoreFocusAfterRemoval(removedIds, oldTasks) {
  const removed = oldTasks.filter((task) => removedIds.has(task.id));
  if (removed.length === 0) {
    return;
  }
  const firstIndex = Math.min(...removed.map((task) => oldTasks.findIndex((item) => item.id === task.id)));
  const remaining = store.getState().tasks;
  const target = remaining[firstIndex] ?? remaining[firstIndex - 1];
  if (target && focusTaskControl(target.id, "checkbox")) {
    return;
  }
  elements.titleInput.focus();
}

function updateTitleCounter() {
  elements.titleCount.textContent = `${elements.titleInput.value.length} / ${MAX_TITLE_LENGTH}`;
}

function clearTitleError() {
  elements.titleError.textContent = "";
  elements.titleInput.removeAttribute("aria-invalid");
}

function reportStorageError(error) {
  console.error("FocusList storage error:", error);
  elements.storageWarning.hidden = false;
  elements.saveStatus.textContent = "Could not save on this device";
  announce("Your changes could not be saved on this device. Check browser storage availability.");
}

function saveIfNeeded(state, reason) {
  if (state.tasks === lastSavedTasks) {
    return;
  }
  lastSavedTasks = state.tasks;
  if (state.externalSync) {
    elements.storageWarning.hidden = false;
    elements.saveStatus.textContent = "Updated from another tab";
    return;
  }
  const error = saveTasks(state.tasks);
  if (error) {
    reportStorageError(error);
    return;
  }
  elements.storageWarning.hidden = true;
  elements.saveStatus.textContent = "Saved automatically on this device";
}

store.subscribe((state, reason) => {
  saveIfNeeded(state, reason);
  render(state, reason);
});

elements.taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const task = actions.add(elements.titleInput.value, elements.priorityInput.value);
  if (!task) {
    elements.titleError.textContent = "Enter a task title of 1 to 120 characters.";
    elements.titleInput.setAttribute("aria-invalid", "true");
    elements.titleInput.focus();
    return;
  }
  window.clearTimeout(searchTimer);
  elements.titleInput.value = "";
  elements.search.value = "";
  elements.priorityInput.value = "medium";
  updateTitleCounter();
  clearTitleError();
  elements.titleInput.focus();
  announce(`Added task: ${task.title}. Filters were reset so it is visible.`);
});

elements.titleInput.addEventListener("input", () => {
  updateTitleCounter();
  if (elements.titleInput.value.trim()) {
    clearTitleError();
  }
});

document.querySelector("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
});

elements.search.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  const query = elements.search.value;
  searchTimer = window.setTimeout(() => actions.setFilters({ query }), 100);
});

elements.filterButtons.forEach((button) => {
  button.addEventListener("click", () => actions.setFilters({ status: button.dataset.statusFilter }));
});

elements.priorityFilter.addEventListener("change", () => {
  actions.setFilters({ priority: elements.priorityFilter.value });
});

elements.clearCompleted.addEventListener("click", () => {
  const oldTasks = store.getState().tasks;
  const removed = new Set(oldTasks.filter((task) => task.completed).map((task) => task.id));
  const count = actions.clearCompleted();
  if (count > 0) {
    restoreFocusAfterRemoval(removed, oldTasks);
    announce(`Cleared ${count} completed ${count === 1 ? "task" : "tasks"}. Use Undo to restore them.`);
  }
});

elements.taskList.addEventListener("change", (event) => {
  const checkbox = event.target.closest('input[type="checkbox"][data-control="checkbox"]');
  const row = checkbox?.closest("[data-task-id]");
  if (row) {
    const task = store.getState().tasks.find((item) => item.id === row.dataset.taskId);
    if (actions.toggle(row.dataset.taskId) && task) {
      announce(`${task.title} marked ${checkbox.checked ? "complete" : "active"}.`);
    }
  }
});

elements.taskList.addEventListener("input", (event) => {
  const field = event.target;
  const row = field.closest("[data-task-id]");
  if (!row || field.dataset.control !== "edit-title") {
    return;
  }
  actions.updateDraft(row.dataset.taskId, "title", field.value);
  field.removeAttribute("aria-invalid");
  const counter = row.querySelector(".edit-count");
  if (counter) {
    counter.textContent = `${field.value.length} / ${MAX_TITLE_LENGTH}`;
  }
  const formError = row.querySelector(".edit-error");
  if (formError) {
    formError.textContent = "";
  }
});

elements.taskList.addEventListener("change", (event) => {
  const field = event.target.closest('select[data-control="edit-priority"]');
  const row = field?.closest("[data-task-id]");
  if (row) {
    actions.updateDraft(row.dataset.taskId, "priority", field.value);
  }
});

elements.taskList.addEventListener("submit", (event) => {
  const form = event.target.closest(".edit-form");
  if (!form) {
    return;
  }
  event.preventDefault();
  const result = actions.saveEdit(form.dataset.taskId);
  if (!result.saved) {
    let error = form.querySelector(".edit-error");
    if (!error) {
      error = document.createElement("p");
      error.className = "edit-error";
      error.setAttribute("role", "alert");
      form.append(error);
    }
    error.textContent = result.error;
    const title = form.querySelector('[data-control="edit-title"]');
    title?.setAttribute("aria-invalid", "true");
    title?.focus();
    return;
  }
  announce(`Updated task: ${result.task.title}.`);
});

elements.taskList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-control]");
  if (!button) {
    return;
  }
  const id = button.dataset.taskId;
  if (button.dataset.control === "edit") {
    if (actions.startEdit(id)) {
      focusTaskControl(id, "edit-title");
    }
    return;
  }
  if (button.dataset.control === "cancel") {
    actions.cancelEdit(id);
    announce("Editing canceled. The task was not changed.");
    return;
  }
  if (button.dataset.control === "delete") {
    const oldTasks = store.getState().tasks;
    const task = actions.remove(id);
    if (task) {
      restoreFocusAfterRemoval(new Set([id]), oldTasks);
      announce(`Deleted task: ${task.title}. Use Undo to restore it.`);
    }
  }
});

elements.undoButton.addEventListener("click", () => {
  const action = actions.undo();
  if (!action) {
    return;
  }
  const restored = action.entries[0]?.task;
  announce(`${action.label} undone.`);
  if (restored && focusTaskControl(restored.id, "checkbox")) {
    return;
  }
  elements.titleInput.focus();
});

elements.dismissUndo.addEventListener("click", () => {
  actions.dismissUndo();
  announce("Undo history dismissed.");
});

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY && event.key !== null) {
    return;
  }
  const parsed = event.newValue === null
    ? { tasks: [], error: null }
    : parseStorageEvent(event.newValue);
  if (parsed.error) {
    reportStorageError(parsed.error, "load");
    return;
  }
  lastSavedTasks = parsed.tasks;
  actions.sync(parsed.tasks);
  announce("Tasks were updated from another browser tab.");
});

if (loaded.error) {
  reportStorageError(loaded.error, "load");
} else if (loaded.tasks.length > 0) {
  elements.saveStatus.textContent = "Loaded from this device";
}

render(store.getState(), "initial");
updateTitleCounter();
setDate();
