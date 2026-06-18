(() => {
  const storageKey = "focus-week-planner-v2";
  const oldStorageKey = "focus-week-planner-v1";
  const taskId = "seed-dsa-form-2026-06-20-morning";
  const taskTitle = "Fill in DSA form";
  const scheduledFor = new Date(2026, 5, 20, 10, 0, 0, 0);

  function startOfWeekDate(date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    const mondayOffset = (copy.getDay() + 6) % 7;
    copy.setDate(copy.getDate() - mondayOffset);
    return copy;
  }

  function weekKey(date) {
    const copy = startOfWeekDate(date);
    const year = copy.getFullYear();
    const month = String(copy.getMonth() + 1).padStart(2, "0");
    const day = String(copy.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function defaultPlannerState() {
    return {
      tasks: [],
      weeks: {},
      settings: {
        calmMode: false,
        hideDone: false,
        reminders: false,
        awakeStart: 6,
        awakeEnd: 23,
        slotMinutes: 30
      }
    };
  }

  function getPlannerState() {
    try {
      if (typeof state !== "undefined" && state && typeof state === "object") return state;
    } catch (error) {
      // Fall back to localStorage if the main planner state is not visible here.
    }

    try {
      const raw = localStorage.getItem(storageKey) || localStorage.getItem(oldStorageKey);
      return raw ? JSON.parse(raw) : defaultPlannerState();
    } catch (error) {
      console.warn("Could not read planner data before adding the DSA form task", error);
      return defaultPlannerState();
    }
  }

  function savePlannerState(plannerState) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(plannerState));
    } catch (error) {
      console.warn("Could not save the DSA form task", error);
    }
  }

  function hasDsaTask(plannerState, targetWeekKey) {
    return Object.entries(plannerState.weeks || {}).some(([key, week]) => {
      return (week.instances || []).some(instance => {
        if (instance.deleted) return false;
        if (instance.id === taskId) return true;
        if (key !== targetWeekKey) return false;
        return String(instance.title || "").trim().toLowerCase() === taskTitle.toLowerCase();
      });
    });
  }

  const plannerState = getPlannerState();
  plannerState.tasks ||= [];
  plannerState.weeks ||= {};
  plannerState.settings ||= defaultPlannerState().settings;

  const targetWeekKey = weekKey(scheduledFor);
  plannerState.weeks[targetWeekKey] ||= { instances: [] };

  if (!hasDsaTask(plannerState, targetWeekKey)) {
    plannerState.weeks[targetWeekKey].instances.push({
      id: taskId,
      source: "one-off",
      title: taskTitle,
      duration: 60,
      energy: "medium",
      type: "Admin",
      priority: "Highest",
      category: "Admin",
      step: "Open the DSA form",
      details: "Complete the DSA form on Saturday morning.",
      scheduledAt: scheduledFor.toISOString(),
      status: "scheduled",
      note: "",
      notified: false,
      removable: true,
      createdAt: new Date().toISOString()
    });
    savePlannerState(plannerState);

    try {
      if (typeof render === "function") render();
    } catch (error) {
      console.info("DSA form task was saved; reload the planner if it does not appear immediately.", error);
    }
  }
})();
