const config = window.TABLE_APP_CONFIG;
const storeKey = `focus-week-planner-${config.key}-v1`;
let rows = loadRows();

const tbody = document.getElementById("tableBody");
const addRow = document.getElementById("addRow");
const exportRows = document.getElementById("exportRows");
const importRows = document.getElementById("importRows");
const seedRows = document.getElementById("seedRows");

render();

addRow.addEventListener("click", () => {
  rows.push(emptyRow());
  saveRows();
  render();
});

exportRows.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${config.key}-backup.json`;
  anchor.click();
  URL.revokeObjectURL(url);
});

importRows.addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result));
      if (!Array.isArray(imported)) throw new Error("Invalid file");
      if (!confirm("Import this file? It will replace the rows in this browser.")) return;
      rows = imported.map(row => ({ id: makeId(), ...row }));
      saveRows();
      render();
    } catch (error) {
      alert("Could not import that file.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
});

if (seedRows) {
  seedRows.addEventListener("click", () => {
    const existing = new Set(rows.map(row => JSON.stringify(row)));
    let added = 0;
    config.sampleRows.forEach(sample => {
      const row = { id: makeId(), ...sample };
      const key = JSON.stringify(sample);
      if (existing.has(key)) return;
      rows.push(row);
      added += 1;
    });
    saveRows();
    render();
    alert(added ? `Added ${added} starter rows.` : "Starter rows are already there.");
  });
}

function loadRows() {
  try {
    const raw = localStorage.getItem(storeKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRows() {
  localStorage.setItem(storeKey, JSON.stringify(rows));
}

function emptyRow() {
  const row = { id: makeId() };
  config.columns.forEach(column => {
    row[column.key] = column.default || "";
  });
  return row;
}

function render() {
  tbody.innerHTML = "";
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = config.columns.length + 1;
    td.textContent = "No rows yet. Add one, or load starter rows.";
    td.className = "hint-cell";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement("tr");
    config.columns.forEach(column => {
      const td = document.createElement("td");
      const input = createInput(column, row[column.key] || "");
      input.addEventListener("input", () => {
        row[column.key] = input.value;
        saveRows();
      });
      td.appendChild(input);
      tr.appendChild(td);
    });
    const actionTd = document.createElement("td");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      if (!confirm("Remove this row?")) return;
      rows = rows.filter(item => item.id !== row.id);
      saveRows();
      render();
    });
    actionTd.appendChild(remove);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
}

function createInput(column, value) {
  if (column.type === "select") {
    const select = document.createElement("select");
    column.options.forEach(option => {
      const opt = document.createElement("option");
      opt.value = option;
      opt.textContent = option;
      select.appendChild(opt);
    });
    select.value = value || column.default || column.options[0];
    return select;
  }

  if (column.type === "textarea") {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    return textarea;
  }

  const input = document.createElement("input");
  input.type = column.type || "text";
  input.value = value;
  return input;
}

function makeId() {
  return crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
