import { MAX_TITLE, normalizeTitle } from './task-model.js';
import { focusTaskControl } from './task-view.js';

const $ = (selector, root = document) => root.querySelector(selector);

export const bindAddForm = ({ add }) => {
  const input = $('#new-title');
  const error = $('#add-error');
  input.maxLength = MAX_TITLE;

  input.addEventListener('input', () => {
    error.textContent = '';
    input.removeAttribute('aria-invalid');
  });

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

export const bindFilters = ({ setFilter, resetFilters, clearCompleted }) => {
  const onPress = (selector, key, attribute) => {
    $(selector).addEventListener('click', (event) => {
      const button = event.target.closest(`[data-${attribute}]`);
      if (button) {
        const datasetKey = key === 'priority' ? 'pfilter' : 'status';
        setFilter({ [key]: button.dataset[datasetKey] });
      }
    });
  };

  onPress('#status-filter', 'status', 'status');
  onPress('#pfilter', 'priority', 'pfilter');
  $('#search').addEventListener('input', (event) => setFilter({ query: event.target.value }));
  $('#reset-filters').addEventListener('click', resetFilters);
  $('#clear-completed').addEventListener('click', clearCompleted);
};

export const bindList = ({ actions }) => {
  const list = $('#task-list');
  const idOf = (element) => element.closest('[data-id]')?.dataset.id;
  const leaveEdit = (id) => {
    actions.cancelEdit();
    focusTaskControl(id, 'edit');
  };
  const handlers = {
    edit: (id) => {
      actions.startEdit(id);
      $('.edit-input', list)?.focus();
    },
    delete: (id) => actions.remove(id),
    cancel: leaveEdit,
  };

  list.addEventListener('change', (event) => {
    if (event.target.matches('[data-action="toggle"]')) actions.toggle(idOf(event.target));
  });
  list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (button) handlers[button.dataset.action]?.(idOf(button));
  });
  list.addEventListener('submit', (event) => {
    event.preventDefault();
    const id = idOf(event.target);
    const data = new FormData(event.target);
    const title = normalizeTitle(String(data.get('title')));

    if (!title) {
      $('.edit-input', event.target).focus();
      return;
    }

    actions.update(id, title, String(data.get('priority')));
    focusTaskControl(id, 'edit');
  });
  list.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && event.target.closest('.edit-form')) leaveEdit(idOf(event.target));
  });
};

export const bindShortcuts = () => {
  document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    const target = { n: '#new-title', '/': '#search' }[event.key];
    if (target) {
      event.preventDefault();
      $(target).focus();
    }
  });
};
