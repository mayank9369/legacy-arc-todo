Legacy Arc To-do
=================

Simple responsive To‑Do app with a consistency calendar.

Features
- Add daily tasks on the home page (home lists only today's tasks).
- Mark tasks complete — completions are recorded with the date they are completed and persist for the calendar.
- Full-year consistency calendar showing days with completed tasks (streaks, counts).
- Theme toggle (light/dark), progress bar, motivational quote that rotates daily.
- No frameworks — pure HTML, CSS, and vanilla JavaScript.

Important behavior notes
- Home shows only tasks whose `createdAt` equals today's local date. Tasks created on previous days do not appear on the home page.
- When you complete a task from the calendar overlay or popover for a specific date, the completion is attributed to that date (so the calendar will show it permanently for that date).
- The app uses local YYYY-MM-DD date keys (not UTC ISO slicing) to avoid timezone off-by-one issues.
- The motivational quote is chosen deterministically each day (based on local date) so it changes daily on all devices.
- At local midnight the app triggers a refresh to clear the home list for the new day and update the quote.

Running locally
1. Open `index.html` in a browser.
2. Use `calendar.html` to view yearly consistency.

Development
- Code is in `index.html`, `calendar.html`, `style.css`, and `script.js`.
- Data is persisted in `localStorage` under the key `todoApp`.

License
- Personal project.