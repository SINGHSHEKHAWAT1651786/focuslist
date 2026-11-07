import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../src/store.js";

function fixture(title, completed = false) {
  return {
    id: title.toLowerCase().replaceAll(" ", "-"),
    title,
    priority: "medium",
    completed,
    createdAt: 0,
  };
}

test("adding a task normalizes the title and resets active filters", () => {
  const store = createStore();
  store.actions.setFilters({ status: "completed", priority: "low", query: "hidden" });
  const task = store.actions.add("  write   tests  ", "high");
  assert.equal(task.title, "write tests");
  assert.deepEqual(store.getState().filters, { status: "all", priority: "all", query: "" });
  assert.equal(store.getState().tasks[0].id, task.id);
});

test("completion preserves task order", () => {
  const store = createStore([fixture("First"), fixture("Second")]);
  store.actions.toggle("second");
  assert.deepEqual(store.getState().tasks.map((task) => task.id), ["first", "second"]);
});

test("multiple deletions can be undone in reverse action order", () => {
  const store = createStore([fixture("First"), fixture("Second"), fixture("Third")]);
  store.actions.remove("first");
  store.actions.remove("third");
  assert.deepEqual(store.getState().tasks.map((task) => task.id), ["second"]);
  assert.equal(store.actions.undo().label, "Deleted “Third”");
  assert.equal(store.actions.undo().label, "Deleted “First”");
  assert.deepEqual(store.getState().tasks.map((task) => task.id), ["first", "second", "third"]);
});

test("clearing completed tasks is one undoable action and restores original order", () => {
  const store = createStore([
    fixture("First", true),
    fixture("Second"),
    fixture("Third", true),
  ]);
  assert.equal(store.actions.clearCompleted(), 2);
  assert.deepEqual(store.getState().tasks.map((task) => task.id), ["second"]);
  store.actions.undo();
  assert.deepEqual(store.getState().tasks.map((task) => task.id), ["first", "second", "third"]);
});

test("edits remain in state when filters change or another task is edited", () => {
  const store = createStore([fixture("First"), fixture("Second")]);
  store.actions.startEdit("first");
  store.actions.updateDraft("first", "title", "Unfinished draft");
  store.actions.setFilters({ query: "second" });
  store.actions.startEdit("second");
  assert.equal(store.getState().drafts.first.title, "Unfinished draft");
  assert.equal(store.getState().drafts.second.title, "Second");
});

test("cross-tab sync preserves a draft whose task was deleted in another tab", () => {
  const store = createStore([fixture("First")]);
  store.actions.startEdit("first");
  store.actions.updateDraft("first", "title", "Unsaved change");
  store.actions.sync([]);
  assert.equal(store.getState().tasks[0].id, "first");
  assert.equal(store.getState().drafts.first.title, "Unsaved change");
  assert.equal(store.getState().externalSync, false);
});

test("edit validation rejects empty titles and preserves the draft until canceled", () => {
  const store = createStore([fixture("First")]);
  store.actions.startEdit("first");
  store.actions.updateDraft("first", "title", "  ");
  assert.deepEqual(store.actions.saveEdit("first"), {
    saved: false,
    error: "Enter a task title before saving.",
  });
  assert.equal(store.getState().drafts.first.title, "  ");
  store.actions.cancelEdit("first");
  assert.equal(store.getState().drafts.first, undefined);
});

test("unchanged actions do not notify and subscribers can unsubscribe", () => {
  const store = createStore([fixture("First")]);
  let notifications = 0;
  const unsubscribe = store.subscribe(() => notifications++);
  store.actions.toggle("missing");
  store.actions.setFilters({ status: "all" });
  assert.equal(notifications, 0);
  unsubscribe();
  store.actions.toggle("first");
  assert.equal(notifications, 0);
});

test("dismissal clears the undo history", () => {
  const store = createStore([fixture("First")]);
  store.actions.remove("first");
  store.actions.dismissUndo();
  assert.equal(store.getState().undoStack.length, 0);
  assert.equal(store.actions.undo(), null);
});
