import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createStore,
  normalizeTitle,
  selectStats,
  selectVisibleTasks,
} from '../src/task-model.js';

const tasks = [
  { id: 'medium-active', title: 'Write report', priority: 'medium', completed: false, createdAt: 1 },
  { id: 'high-active', title: 'Fix urgent bug', priority: 'high', completed: false, createdAt: 2 },
  { id: 'low-completed', title: 'Read notes', priority: 'low', completed: true, createdAt: 3 },
];

test('normalizes whitespace and enforces the title limit', () => {
  assert.equal(normalizeTitle('  Plan   the day  '), 'Plan the day');
  assert.equal(normalizeTitle('x'.repeat(130)).length, 120);
});

test('filters by case-insensitive title, status, and priority', () => {
  const state = { tasks, filters: { query: 'URGENT', status: 'active', priority: 'high' } };
  assert.deepEqual(selectVisibleTasks(state).map((task) => task.id), ['high-active']);
});

test('orders active high-priority tasks first and completed tasks last', () => {
  const state = { tasks, filters: { query: '', status: 'all', priority: 'all' } };
  assert.deepEqual(selectVisibleTasks(state).map((task) => task.id), [
    'high-active',
    'medium-active',
    'low-completed',
  ]);
});

test('returns task statistics from the full task list', () => {
  assert.deepEqual(selectStats(tasks), { total: 3, completed: 1, pending: 2 });
});

test('adds, toggles, and updates tasks without mutating prior state', () => {
  const store = createStore([], () => 'new-task');
  store.actions.add('New task', 'high');
  const addedState = store.getState();
  store.actions.toggle('new-task');
  assert.equal(addedState.tasks[0].completed, false);
  assert.equal(store.getState().tasks[0].completed, true);
  store.actions.update('new-task', 'Updated task', 'low');
  assert.deepEqual(store.getState().tasks[0], {
    id: 'new-task',
    title: 'Updated task',
    priority: 'low',
    completed: true,
    createdAt: store.getState().tasks[0].createdAt,
  });
});

test('deletes and restores the task in its original position', () => {
  const store = createStore(tasks, () => 'unused');
  store.actions.remove('high-active');
  assert.equal(store.getState().tasks.length, 2);
  store.actions.undo();
  assert.deepEqual(store.getState().tasks, tasks);
});

test('clears only completed tasks', () => {
  const store = createStore(tasks, () => 'unused');
  store.actions.clearCompleted();
  assert.deepEqual(store.getState().tasks.map((task) => task.id), ['medium-active', 'high-active']);
});

test('notifies subscribers and supports unsubscribing', () => {
  const store = createStore([], () => 'new-task');
  let notifications = 0;
  const unsubscribe = store.subscribe(() => { notifications += 1; });
  store.actions.add('One', 'medium');
  unsubscribe();
  store.actions.add('Two', 'low');
  assert.equal(notifications, 1);
});
