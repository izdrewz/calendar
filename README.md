# Focus Week Planner

An ADHD-friendly life-admin planner for people who know they need to do something a certain number of times per week, but do not want the app to choose the times for them.

Example: create **Exam study — 5× per week — 90 min**. The app creates five draggable copies for the current week. You drag each one into the calendar where it actually fits.

## Apps in this repo

- `index.html` — weekly drag-and-drop calendar planner
- `stock.html` — clothes stock list for selling, keeping, upscaling, photos, locations, and repairs
- `gifts.html` — gift planner for birthdays, Christmas, budgets, ideas, bought/wrapped/given status

## Calendar planner features

- Creates weekly recurring task copies like `Study 1/3`, `Study 2/3`, `Study 3/3`
- Adds removable one-off cards for temporary tasks like measuring windows, buying sticky paper, installing a hanger, or listing five clothes items
- Lets you drag and drop each copy onto a weekly calendar
- Supports tap-to-place for mobile: tap a card, then tap a calendar slot
- Tracks scheduled, done, skipped, and unplanned tasks
- Shows task type, priority, energy, first step, and details directly on the calendar cards
- Has a Life Admin Starter Pack based on study, daily reset, admin, cleaning, room setup, clothes, creative, rest, and weekly review tasks
- Has Calm Mode to reduce visual clutter
- Has Hide Done to keep completed/skipped tasks out of the way
- Includes a 25-minute focus timer
- Adds per-task timers that can be started, paused, and left running until you pause/reset your own tracking
- Logs daily goals, end-session choices, timer starts/pauses, and weekly review data
- Asks for today’s goals when you open the planner if no goal is saved for that day
- End-session flow shows unfinished tasks and lets you return them to the drag/drop pile, schedule them tomorrow, keep them where they are, or skip them
- Monday weekly review summarises done/scheduled/skipped counts and tracked time by task/habit/project
- Supports browser reminders while the app is open
- Exports/imports planner data as JSON
- Downloads session logs as JSON
- Works without a backend or account
- Includes a basic offline/PWA setup

## How to use the calendar

1. Open `index.html` in a browser.
2. Click **Load life-admin starter pack** if you want the suggested setup.
3. Add recurring task rules for habits or routines.
   - Example: `Exam study`, `5× per week`, `90 minutes`, `Highest priority`
4. Add one-off cards for temporary tasks.
   - Example: `Measure window for bug mesh`, `30 minutes`, `Room Setup`
5. Drag generated cards from **Unscheduled** into the week.
6. Use the task timer buttons when you want to track time spent.
7. Mark tasks done, skipped, unplanned, or remove one-off cards.
8. Use **End session for today** to decide what happens to unfinished tasks.
9. Use **Weekly review** on Monday or whenever you want a progress summary.
10. Use Export and Download logs to back up your planner.

## When to use each app

| Need | Use |
|---|---|
| Schedule study, cleaning, room resets, admin, hobbies, or one-off tasks | Calendar planner |
| Track clothes to keep, sell, upscale, photograph, list, or repair | Clothes stock list |
| Track birthdays, Christmas, budgets, gift ideas, and bought/wrapped/given status | Gift planner |

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
- Data is saved per browser/device unless you export/import JSON and session logs.
- A browser app cannot silently choose folders, save outside Downloads, or commit to GitHub without you taking action.
- Google Calendar sync is not included yet.
- New separate GitHub repositories were not created; the available GitHub tools exposed file creation/editing in the existing repository, so the extra apps were added as pages in this repo.
