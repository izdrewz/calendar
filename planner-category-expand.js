(() => {
  if (window.__plannerCategoryExpandLoaded) return;
  window.__plannerCategoryExpandLoaded = true;

  const KEY = "planner-category-tray-expanded-v1";

  function expanded() {
    return localStorage.getItem(KEY) === "true";
  }

  function setExpanded(value) {
    localStorage.setItem(KEY, value ? "true" : "false");
    applyState();
  }

  function ensureButton() {
    const panel = document.querySelector(".mock-category-panel");
    const list = document.getElementById("unscheduledList");
    if (!panel || !list || panel.querySelector(".category-expand-toggle")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-expand-toggle ghost";
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      setExpanded(!expanded());
    });
    panel.insertBefore(button, list);
  }

  function applyState() {
    const panel = document.querySelector(".mock-category-panel");
    const button = panel?.querySelector(".category-expand-toggle");
    if (!panel || !button) return;
    const isExpanded = expanded();
    panel.classList.toggle("category-tray-expanded", isExpanded);
    button.textContent = isExpanded ? "Collapse" : "Expand";
    button.setAttribute("aria-expanded", String(isExpanded));
  }

  function refresh() {
    ensureButton();
    applyState();
  }

  document.addEventListener("DOMContentLoaded", refresh);
  window.addEventListener("load", refresh);
  document.addEventListener("click", () => setTimeout(refresh, 80), true);
  document.addEventListener("drop", () => setTimeout(refresh, 120), true);
  document.addEventListener("submit", () => setTimeout(refresh, 120), true);
})();
