# FocusList

A frontend-only to-do app: plan the day, see what to do next, finish what matters.
Vanilla HTML, CSS and JavaScript. No build step, no dependencies, no backend. Tasks are saved in the browser's localStorage.

## Live demo
[Open FocusList on Netlify](https://papaya-monstera-61cf80.netlify.app/)

## Run
Open `index.html` in a browser. The app uses system fonts and needs no network connection.

## Test
Run `npm test` with Node.js 18 or newer. Tests use Node's built-in test runner; no packages need to be installed.

## Deploy (static hosting, no build)
- Netlify: drag this folder onto https://app.netlify.com/drop
- GitHub Pages: deploy from the `main` branch and `/ (root)` in the repository's Pages settings.
- Vercel: run `npx vercel` in this folder.

## Features
Add, complete, edit and delete tasks. High / Medium / Low priority. Search, plus filters by status and priority.
Live Total / Completed / Pending stats with a progress ring. An "Up next" card for the most urgent task.
Undo after delete. Tasks persist across reloads. Shortcuts: N (new task), / (search), Enter saves an edit, Esc cancels it.

## Structure
- `index.html`: semantic markup and accessibility labels
- `styles.css`: design tokens first, then base, layout, components and responsive rules
- `app.js`: application bootstrap and dependency wiring
- `src/task-model.js`: task state, actions, validation, filtering, and statistics
- `src/task-storage.js`: validated localStorage persistence
- `src/task-view.js`: accessible DOM rendering
- `src/task-controller.js`: form, filter, keyboard, and task event handlers
- `tests/`: model, filtering, state, and persistence tests

State is the single source of truth. Every change goes through a store action and the view re-renders from state.
Filters and stats are derived by selectors and never stored. User text is inserted as text nodes, never as HTML.
