import { isTask } from './task-model.js';

export const STORAGE_KEY = 'focuslist:v1';

export const storage = {
  load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data)
        ? data.filter(isTask).map((task) => ({ ...task, createdAt: Number(task.createdAt) || 0 }))
        : [];
    } catch (error) {
      console.warn('FocusList could not read saved tasks; starting with an empty list.', error);
      return [];
    }
  },
  save(tasks) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
      console.warn('FocusList could not save tasks in this browser.', error);
    }
  },
};
