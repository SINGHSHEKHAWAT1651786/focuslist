import { UNDO_MS, createStore } from './src/task-model.js';
import { storage } from './src/task-storage.js';
import { render, renderDate } from './src/task-view.js';
import { bindAddForm, bindFilters, bindList, bindShortcuts } from './src/task-controller.js';

const init = () => {
  const store = createStore(storage.load());
  let savedTasks = store.getState().tasks;
  let lastUndo = null;
  let undoTimer = 0;

  store.subscribe((state) => {
    if (state.tasks !== savedTasks) {
      savedTasks = state.tasks;
      storage.save(state.tasks);
    }

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
  document.querySelector('#undo').addEventListener('click', store.actions.undo);

  renderDate();
  render(store.getState());
};

init();
