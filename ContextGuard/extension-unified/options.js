const listEl = document.getElementById("overrideList");
const clearAllBtn = document.getElementById("clearAllBtn");

function loadOverrides() {
  chrome.storage.local.get({ overrides: {} }, (stored) => {
    render(stored.overrides || {});
  });
}

function render(overrides) {
  const entries = Object.entries(overrides).sort(
    (a, b) => (b[1].addedAt || 0) - (a[1].addedAt || 0)
  );

  if (entries.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No manual overrides yet. Blocked and allowed posts you\'ve set will show up here.</div>';
    clearAllBtn.style.display = "none";
    return;
  }

  clearAllBtn.style.display = "inline";
  listEl.innerHTML = "";

  for (const [hash, entry] of entries) {
    const row = document.createElement("div");
    row.className = "override-row";

    const tag = document.createElement("span");
    tag.className = "state-tag " + (entry.state === "block" ? "block" : "allow");
    tag.textContent = entry.state === "block" ? "Blocked" : "Allowed";

    const snippet = document.createElement("span");
    snippet.className = "snippet";
    snippet.textContent = entry.snippet || "(no preview available)";
    snippet.title = entry.snippet || "";

    const switchBtn = document.createElement("button");
    switchBtn.textContent = entry.state === "block" ? "Switch to allow" : "Switch to block";
    switchBtn.addEventListener("click", () => {
      overrides[hash] = { ...entry, state: entry.state === "block" ? "allow" : "block", addedAt: Date.now() };
      save(overrides);
    });

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      delete overrides[hash];
      save(overrides);
    });

    row.appendChild(tag);
    row.appendChild(snippet);
    row.appendChild(switchBtn);
    row.appendChild(removeBtn);
    listEl.appendChild(row);
  }
}

function save(overrides) {
  chrome.storage.local.set({ overrides });
}

clearAllBtn.addEventListener("click", () => {
  if (!confirm("Remove all manual block/allow overrides? This can't be undone.")) return;
  save({});
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.overrides) {
    render(changes.overrides.newValue || {});
  }
});

loadOverrides();
