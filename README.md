# FocusList

FocusList is a responsive, frontend-only to-do app for planning a day one task at a time. Tasks are stored in the browser; no account, backend, or external database is used.

**Live app:** [https://subtle-gumption-494642.netlify.app/](https://subtle-gumption-494642.netlify.app/)

## Features

- Add, edit, complete, and delete tasks with High, Medium, or Low priority.
- Search by title and filter by completion status and priority.
- See total, pending, completed, and progress statistics.
- Automatically save tasks in local storage and synchronize changes between open tabs.
- Undo multiple delete and clear-completed actions.
- Keep task order stable when completion or priority changes.
- View a daily priority indicator, responsive layouts, dark-mode styling, and a print-friendly task list.

## Run locally

Requires Node.js 20 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. This project uses Vite modules, so open it through the development server instead of opening `index.html` directly.

## Test and build

```sh
npm test
npm run build
npm run preview
```

The production site is written to `dist/`. Deploy that directory to Netlify, or use the included GitHub Pages workflow to build and publish the site.

## Accessibility and design

The interface uses semantic page landmarks, labeled controls, visible keyboard focus, a skip link, concise live announcements, and 44px minimum interactive targets. Priority is conveyed with text as well as color. Windows forced-colors mode, reduced motion, narrow screens, short desktop viewports, dark mode, and printing have dedicated styles.

The app keeps the initial page content meaningful before JavaScript runs. Search results are not announced on every keystroke; task changes and undo actions use a separate status message.

## Data and limitations

Tasks remain in the current browser's local storage. Clearing site data or using another browser/device does not transfer them. Storage can be unavailable or full; in that case the app shows that changes could not be saved. Cross-tab updates apply the most recent local-storage change and replace the current tab's task list.

FocusList does not currently provide cloud sync, accounts, due dates, drag-and-drop ordering, or import/export.

## Deployment

For Netlify, connect this repository and use:

- **Build command:** `npm run build`
- **Publish directory:** `dist`

GitHub Pages serves the repository root, which also works without a build step. The GitHub Actions workflow runs the tests and production build on each push and pull request. For Netlify, deploy the generated `dist/` folder or connect the repository using the build settings above.
