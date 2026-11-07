import { MAX_TITLE, PRIORITIES, RING_LENGTH, selectStats, selectVisibleTasks } from './task-model.js';

const $ = (selector, root = document) => root.querySelector(selector);

const h = (tag, props = {}, ...children) => {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') element.className = value;
    else if (key === 'dataset') Object.assign(element.dataset, value);
    else if (key in element) element[key] = value;
    else element.setAttribute(key, value);
  }
  element.append(...children.flat().filter(Boolean));
  return element;
};

const actionButton = (label, action, task) => h('button', {
  type: 'button',
  class: `btn btn-ghost${action === 'delete' ? ' btn-danger' : ''}`,
  dataset: { action },
  'aria-label': `${label} task: ${task.title}`,
}, label);

const taskAttributes = (task, extra = '') => ({
  class: `task${extra}`,
  dataset: { id: task.id, priority: task.priority, done: String(task.completed) },
});

const renderTaskItem = (task, isFocus) => h('li', taskAttributes(task, isFocus ? ' is-focus' : ''),
  h('input', {
    type: 'checkbox',
    class: 'check',
    id: `chk-${task.id}`,
    checked: task.completed,
    dataset: { action: 'toggle' },
  }),
  h('div', { class: 'task-body' },
    isFocus && !task.completed && h('span', { class: 'up-next' }, 'Up next'),
    h('label', { class: 'task-title', htmlFor: `chk-${task.id}` }, task.title),
    h('span', { class: 'badge' }, h('b', {}, h('i'), h('i'), h('i')), PRIORITIES[task.priority])),
  h('div', { class: 'task-actions' },
    actionButton('Edit', 'edit', task),
    actionButton('Delete', 'delete', task)));

const renderEditItem = (task) => {
  const prioritySelect = h('select', { class: 'field', name: 'priority', 'aria-label': 'Priority' },
    ...Object.entries(PRIORITIES).map(([value, label]) => h('option', { value }, label)));
  prioritySelect.value = task.priority;

  return h('li', taskAttributes(task),
    h('form', { class: 'edit-form' },
      h('label', { class: 'sr-only', htmlFor: `edit-${task.id}` }, 'Task title'),
      h('input', {
        class: 'field edit-input',
        id: `edit-${task.id}`,
        name: 'title',
        value: task.title,
        maxLength: MAX_TITLE,
        autocomplete: 'off',
      }),
      prioritySelect,
      h('div', { class: 'task-actions' },
        h('button', { type: 'submit', class: 'btn btn-primary' }, 'Save'),
        h('button', { type: 'button', class: 'btn btn-ghost', dataset: { action: 'cancel' } }, 'Cancel'))));
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
  $('#subline').textContent = !total
    ? 'Add your first task below.'
    : pending
      ? `${completed} of ${total} done`
      : 'Everything is done. Nice work.';
};

const renderFilters = ({ query, status, priority }) => {
  document.querySelectorAll('[data-status]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.status === status));
  });
  document.querySelectorAll('[data-pfilter]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.pfilter === priority));
  });
  if ($('#search').value !== query) $('#search').value = query;
};

const renderList = (state) => {
  const visibleTasks = selectVisibleTasks(state);
  const hasTasks = state.tasks.length > 0;
  const focusId = state.filters.status === 'completed' ? null : visibleTasks.find((task) => !task.completed)?.id;

  $('#task-list').replaceChildren(...visibleTasks.map((task) => (
    task.id === state.editingId
      ? renderEditItem(task)
      : renderTaskItem(task, task.id === focusId)
  )));
  $('#empty').hidden = visibleTasks.length > 0;
  $('#empty-title').textContent = hasTasks ? 'No tasks match your filters' : 'Nothing on your list yet';
  $('#empty-hint').textContent = hasTasks
    ? 'Try a different search or reset the filters.'
    : 'Add your first task and choose how urgent it is.';
  $('#reset-filters').hidden = !hasTasks;
  $('#result-count').textContent = hasTasks ? `Showing ${visibleTasks.length} of ${state.tasks.length} tasks` : '';
  $('#clear-completed').hidden = !state.tasks.some((task) => task.completed);
};

const renderToast = ({ undo }) => {
  $('#toast').hidden = !undo;
  $('#toast-msg').textContent = undo ? `Deleted “${undo.task.title}”` : '';
};

export const renderDate = () => {
  const now = new Date();
  const format = (options) => new Intl.DateTimeFormat(undefined, options).format(now);
  $('#date').replaceChildren(
    `${format({ weekday: 'long' })},`,
    h('br'),
    format({ day: 'numeric', month: 'long' }),
  );
};

export const render = (state) => {
  renderProgress(state.tasks);
  renderFilters(state.filters);
  renderList(state);
  renderToast(state);
};

export const focusTaskControl = (id, action) => {
  $(`[data-id="${CSS.escape(id)}"] [data-action="${action}"]`)?.focus();
};
