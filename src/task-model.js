export const PRIORITIES = Object.freeze(["high", "medium", "low"]);

export const DEFAULT_FILTERS = Object.freeze({
  status: "all",
  priority: "all",
  query: "",
});

export const MAX_TITLE_LENGTH = 120;
export const MAX_UNDO_ACTIONS = 20;

export function normalizeTitle(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function isValidTask(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.title === "string" &&
    normalizeTitle(value.title).length > 0 &&
    normalizeTitle(value.title).length <= MAX_TITLE_LENGTH &&
    PRIORITIES.includes(value.priority) &&
    typeof value.completed === "boolean"
  );
}

export function validateTasks(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenIds = new Set();
  return value.flatMap((task) => {
    if (!isValidTask(task) || seenIds.has(task.id)) {
      return [];
    }

    seenIds.add(task.id);
    return [{
      id: task.id,
      title: normalizeTitle(task.title),
      priority: task.priority,
      completed: task.completed,
      createdAt: Number.isFinite(task.createdAt) ? task.createdAt : 0,
    }];
  });
}

export function getVisibleTasks(tasks, filters) {
  const query = filters.query.trim().toLocaleLowerCase();
  return tasks.filter((task) => {
    const matchesStatus =
      filters.status === "all" ||
      (filters.status === "active" && !task.completed) ||
      (filters.status === "completed" && task.completed);
    const matchesPriority =
      filters.priority === "all" || task.priority === filters.priority;
    const matchesQuery =
      query.length === 0 || task.title.toLocaleLowerCase().includes(query);

    return matchesStatus && matchesPriority && matchesQuery;
  });
}

export function getStatistics(tasks) {
  const completed = tasks.filter((task) => task.completed).length;
  return {
    total: tasks.length,
    completed,
    pending: tasks.length - completed,
    percent: tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100),
  };
}

export function getNextTaskId(tasks) {
  const priorityRank = { high: 0, medium: 1, low: 2 };
  return tasks
    .filter((task) => !task.completed)
    .reduce((next, task) => {
      if (!next || priorityRank[task.priority] < priorityRank[next.priority]) {
        return task;
      }
      return next;
    }, null)?.id ?? null;
}
