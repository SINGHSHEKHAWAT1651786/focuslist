# FocusList

A frontend-only to-do app: plan the day, see what to do next, finish what matters.
Vanilla HTML, CSS and JavaScript. No build step, no dependencies, no backend. Tasks are saved in the browser's localStorage.

## Run
Open `index.html` in a browser. It loads one font from Google Fonts and falls back to system fonts when offline.

## Deploy (static hosting, no build)
- Netlify: drag this folder onto https://app.netlify.com/drop
- GitHub Pages: push these files to a repo, then Settings > Pages > deploy from the main branch (root).
- Vercel: run `npx vercel` in this folder.

## Features
Add, complete, edit and delete tasks. High / Medium / Low priority. Search, plus filters by status and priority.
Live Total / Completed / Pending stats with a progress ring. An "Up next" card for the most urgent task.
Undo after delete. Tasks persist across reloads. Shortcuts: N (new task), / (search), Enter saves an edit, Esc cancels it.

## Structure
- `index.html`: semantic markup and accessibility labels
- `styles.css`: design tokens first, then base, layout, components and responsive rules
- `app.js`: one script, sections in data-flow order:
  constants, helpers, storage, store (state + actions), selectors (filtering, stats), view (render functions), controllers (event binding), bootstrap

State is the single source of truth. Every change goes through a store action and the view re-renders from state.
Filters and stats are derived by selectors and never stored. User text is inserted as text nodes, never as HTML.
