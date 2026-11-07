import test from "node:test";
import assert from "node:assert/strict";
import {
  getNextTaskId,
  getStatistics,
  getVisibleTasks,
  normalizeTitle,
  validateTasks,
} from "../src/task-model.js";

const tasks = [
  { id: "low", title: "  water plants ", priority: "low", completed: false, createdAt: 1 },
  { id: "high", title: "Write report", priority: "high", completed: false, createdAt: 2 },
  { id: "done", title: "Email team", priority: "medium", completed: true, createdAt: 3 },
];

test("normalizes whitespace without truncating titles", () => {
  assert.equal(normalizeTitle("  plan   the  week \n"), "plan the week");
});

test("validates stored tasks and rejects inherited priority keys", () => {
  const inheritedPriority = { ...tasks[0], id: "bad", priority: "constructor" };
  const result = validateTasks([...tasks, inheritedPriority, tasks[0]]);
  assert.deepEqual(result.map((task) => task.id), ["low", "high", "done"]);
  assert.equal(result[0].title, "water plants");
});

test("filters by title, completion, and priority without sorting", () => {
  const visible = getVisibleTasks(tasks, {
    status: "active",
    priority: "all",
    query: " ",
  });
  assert.deepEqual(visible.map((task) => task.id), ["low", "high"]);
  assert.deepEqual(
    getVisibleTasks(tasks, { status: "all", priority: "high", query: "REPORT" })
      .map((task) => task.id),
    ["high"],
  );
});

test("computes task statistics for empty and populated lists", () => {
  assert.deepEqual(getStatistics([]), { total: 0, completed: 0, pending: 0, percent: 0 });
  assert.deepEqual(getStatistics(tasks), { total: 3, completed: 1, pending: 2, percent: 33 });
});

test("selects the most urgent pending task regardless of display order", () => {
  assert.equal(getNextTaskId(tasks), "high");
  assert.equal(getNextTaskId([{ ...tasks[2], completed: false }]), "done");
  assert.equal(getNextTaskId([{ ...tasks[2], completed: true }]), null);
});
