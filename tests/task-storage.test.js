import assert from 'node:assert/strict';
import test from 'node:test';
import { STORAGE_KEY, storage } from '../src/task-storage.js';

const withLocalStorage = (methods, run) => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = methods;
  try {
    run();
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
};

test('loads valid tasks and skips malformed entries', () => {
  const entries = [
    { id: 'valid', title: 'Keep', priority: 'high', completed: false, createdAt: '42' },
    { id: 'invalid', title: 'Skip', priority: 'urgent', completed: false },
  ];
  withLocalStorage({ getItem: () => JSON.stringify(entries) }, () => {
    assert.deepEqual(storage.load(), [{ ...entries[0], createdAt: 42 }]);
  });
});

test('saves tasks under the application storage key', () => {
  let savedKey;
  let savedValue;
  const tasks = [{ id: '1', title: 'Task', priority: 'low', completed: false, createdAt: 10 }];
  withLocalStorage({
    getItem: () => null,
    setItem: (key, value) => {
      savedKey = key;
      savedValue = value;
    },
  }, () => storage.save(tasks));
  assert.equal(savedKey, STORAGE_KEY);
  assert.deepEqual(JSON.parse(savedValue), tasks);
});

test('reports malformed saved data rather than failing startup silently', () => {
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  try {
    withLocalStorage({ getItem: () => '{invalid json' }, () => {
      assert.deepEqual(storage.load(), []);
    });
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warnings.length, 1);
});
