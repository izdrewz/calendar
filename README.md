# Focus Week Planner

An ADHD-friendly weekly planner for people who know they need to do something a certain number of times per week, but do not want the app to choose the times for them.

Example: create **Gym — 3× per week — 45 min**. The app creates three draggable copies for the current week. You drag each one into the calendar where it actually fits.

## What it does

- Creates weekly recurring task copies like `Study 1/3`, `Study 2/3`, `Study 3/3`
- Lets you drag and drop each copy onto a weekly calendar
- Supports tap-to-place for mobile: tap a card, then tap a calendar slot
- Saves everything in the browser with `localStorage`
- Tracks scheduled, done, skipped, and unplanned tasks
- Has Calm Mode to reduce visual clutter
- Has Hide Done to keep completed/skipped tasks out of the way
- Includes a 25-minute focus timer
- Supports browser reminders while the app is open
- Exports/imports planner data as JSON
- Works without a backend or account
- Includes a basic offline/PWA setup

## How to use it

1. Open `index.html` in a browser.
2. Add a task rule.
   - Example: `Study`, `3× per week`, `45 minutes`
3. Drag the generated copies from **Unscheduled** into the week.
4. Mark tasks done, skipped, or unplan them if you need to move them.
5. Use Export to back up your planner.

## GitHub Pages

This is a static app. To publish it with GitHub Pages:

1. Go to the repository settings.
2. Open **Pages**.
3. Choose **Deploy from a branch**.
4. Select the `main` branch and `/root`.
5. Save.

After GitHub Pages finishes deploying, the app will be available at the Pages URL shown there.

## Privacy

Your planner data stays in your browser. There is no server, login, analytics, or tracking.

## Limitations

- Reminders only work while the app is open because this version has no server.
- Data is saved per browser/device unless you export/import JSON.
- Google Calendar sync is not included yet.
