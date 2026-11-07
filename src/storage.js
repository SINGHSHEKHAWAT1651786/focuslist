import { validateTasks } from "./task-model.js";

export const STORAGE_KEY = "focuslist.tasks.v1";

export function loadTasks(storage) {
  try {
    storage ??= window.localStorage;
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) {
      return { tasks: [], error: null };
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { tasks: [], error: new Error("Stored task data is invalid.") };
    }

    return { tasks: validateTasks(parsed), error: null };
  } catch (error) {
    return {
      tasks: [],
      error: error instanceof Error ? error : new Error("Could not read local storage."),
    };
  }
}

export function saveTasks(tasks, storage) {
  try {
    storage ??= window.localStorage;
    storage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error("Could not write local storage.");
  }
}

export function parseStorageEvent(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? { tasks: validateTasks(parsed), error: null } : {
      tasks: [],
      error: new Error("Another tab stored invalid task data."),
    };
  } catch (error) {
    return {
      tasks: [],
      error: error instanceof Error ? error : new Error("Could not read updated task data."),
    };
  }
}
