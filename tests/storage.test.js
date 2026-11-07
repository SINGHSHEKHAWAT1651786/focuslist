import test from "node:test";
import assert from "node:assert/strict";
import { loadTasks, parseStorageEvent, saveTasks, STORAGE_KEY } from "../src/storage.js";

function mockStorage(initialValue = null) {
  const values = new Map(initialValue === null ? [] : [[STORAGE_KEY, initialValue]]);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    values,
  };
}

test("loads and saves valid tasks", () => {
  const tasks = [{
    id: "task-1",
    title: "  Review  ",
    priority: "high",
    completed: false,
    createdAt: 10,
  }];
  const storage = mockStorage(JSON.stringify(tasks));
  assert.deepEqual(loadTasks(storage), {
    tasks: [{ ...tasks[0], title: "Review" }],
    error: null,
  });
  assert.equal(saveTasks(tasks, storage), null);
  assert.equal(JSON.parse(storage.values.get(STORAGE_KEY))[0].id, "task-1");
});

test("reports invalid stored JSON rather than silently claiming it loaded", () => {
  const storage = mockStorage("{");
  const result = loadTasks(storage);
  assert.deepEqual(result.tasks, []);
  assert.ok(result.error instanceof Error);
});

test("returns read and write errors from storage", () => {
  const deniedStorage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("quota");
    },
  };
  assert.match(loadTasks(deniedStorage).error.message, /blocked/);
  assert.match(saveTasks([], deniedStorage).message, /quota/);
});

test("validates storage event data", () => {
  assert.deepEqual(parseStorageEvent("[]"), { tasks: [], error: null });
  assert.ok(parseStorageEvent("invalid").error instanceof Error);
});
