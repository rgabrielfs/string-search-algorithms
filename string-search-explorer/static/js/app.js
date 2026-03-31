// ─── STATE ───────────────────────────────────────────────────────────────────
const state = {
  files: [],
  activeFileIndex: 0,
  lastResult: null,
  lastCompare: null,
  stepIndex: 0,
  autoPlayTimer: null,
};

// ─── UTILS ───────────────────────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function fmtNum(n) {
  return n?.toLocaleString?.() ?? n;
}

function fmtTime(ms) {
  if (ms === undefined || ms === null) return "--";
  if (ms < 1) return `${(ms * 1000).toFixed(2)} µs`;
  return `${ms.toFixed(4)} ms`;
}

function fmtSize(n) {
  if (n < 1000) return `${n} chars`;
  return `${(n / 1000).toFixed(1)}k chars`;
}

function truncate(str, len = 60) {
  return str.length > len ? str.slice(0, len) + "..." : str;
}

function badgeHTML(result) {
  const labels = {
    match: "match", mismatch: "miss", found: "found",
    skip: "skip", info: "info", hash_match: "hash ok",
    hash_mismatch: "hash miss", roll: "roll", shift: "shift",
  };
  const label = labels[result] || result;
  return `<span class="step-badge badge-${result}">${label}</span>`;
}

// ─── STATUS BAR ──────────────────────────────────────────────────────────────
function setStatus(msg, state = "ready") {
  const indicator = $("#status-indicator");
  const text = $("#status-text");
  indicator.className = `status-indicator ${state}`;
  text.textContent = msg;
}

// ─── ALGO INFO ───────────────────────────────────────────────────────────────
const ALGO_INFO = {
  naive: { best: "O(n)", avg: "O(n * m)", worst: "O(n * m)", desc: "Compares pattern at every position left-to-right" },
  rabin_karp: { best: "O(n + m)", avg: "O(n + m)", worst: "O(n * m)", desc: "Uses rolling hash to skip non-matching windows" },
  kmp: { best: "O(n)", avg: "O(n + m)", worst: "O(n + m)", desc: "Uses LPS table to skip redundant comparisons" },
  boyer_moore: { best: "O(n / m)", avg: "O(n / m)", worst: "O(n * m)", desc: "Scans right-to-left, jumps using bad character table" },
};

function updateAlgoInfo() {
  const alg = $("#alg-select").value;
  const info = ALGO_INFO[alg];
  if (!info) return;
  $("#algo-info").innerHTML = `
    <div>${info.desc}</div>
    <div style="margin-top:6px">
      Best: <span>${info.best}</span> &nbsp;|&nbsp;
      Avg: <span>${info.avg}</span> &nbsp;|&nbsp;
      Worst: <span>${info.worst}</span>
    </div>
  `;
}

// ─── FILE HANDLING ────────────────────────────────────────────────────────────
async function uploadFiles(fileList) {
  if (!fileList.length) return;
  const formData = new FormData();
  let hasValid = false;
  for (const f of fileList) {
    if (f.name.endsWith(".txt")) {
      formData.append("files", f);
      hasValid = true;
    }
  }
  if (!hasValid) {
    showAlert("Only .txt files are accepted.", "error");
    return;
  }

  setStatus("Uploading files...", "running");

  try {
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    state.files.push(...data.files);
    state.activeFileIndex = state.files.length - 1;
    renderFileList();
    updateTextArea();
    setStatus(`${state.files.length} file(s) loaded`, "ready");
  } catch (err) {
    showAlert(err.message, "error");
    setStatus("Upload failed", "error");
  }
}

function renderFileList() {
  const list = $("#file-list");
  list.innerHTML = "";
  state.files.forEach((f, i) => {
    const el = document.createElement("div");
    el.className = `file-item${i === state.activeFileIndex ? " active" : ""}`;
    el.innerHTML = `
      <span class="file-name" title="${f.filename}">${f.filename}</span>
      <span class="file-size">${fmtSize(f.size)}</span>
    `;
    el.onclick = () => {
      state.activeFileIndex = i;
      renderFileList();
      updateTextArea();
    };
    list.appendChild(el);
  });
}

function updateTextArea() {
  const f = state.files[state.activeFileIndex];
  if (!f) return;
  $("#text-input").value = f.content;
  setStatus(`Editing: ${f.filename}`, "ready");
}

// ─── SEARCH ──────────────────────────────────────────────────────────────────
async function runSearch(compareAll = false) {
  const text = $("#text-input").value.trim();
  const pattern = $("#pattern-input").value.trim();
  const algorithm = $("#alg-select").value;

  if (!text) { showAlert("Please enter or upload a text to search in.", "error"); return; }
  if (!pattern) { showAlert("Please enter a search pattern.", "error"); return; }

  setStatus("Running...", "running");
  setButtons(true);

  try {
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, pattern, algorithm, all_algorithms: compareAll }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    if (compareAll) {
      state.lastCompare = data.results;
      renderCompare(data.results);
      activateTab("tab-compare");
    } else {
      state.lastResult = data.result;
      state.stepIndex = 0;
      renderResult(data.result);
      activateTab("tab-results");
    }

    setStatus("Done", "ready");
  } catch (err) {
    showAlert(err.message, "error");
    setStatus("Error", "error");
  } finally {
    setButtons(false);
  }
}

function setButtons(disabled) {
  $$(".btn-primary, .btn-secondary, .btn-compare").forEach(b => b.disabled = disabled);
}

// ─── RENDER RESULT ───────────────────────────────────────────────────────────
function renderResult(result) {
  const container = $("#results-panel");
  container.innerHTML = "";

  // Metrics
  const metrics = document.createElement("div");
  metrics.className = "metrics-grid";
  metrics.innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Occurrences</div>
      <div class="metric-value">${result.occurrences.length}</div>
      <div class="metric-sub">matches found</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Comparisons</div>
      <div class="metric-value">${fmtNum(result.total_comparisons)}</div>
      <div class="metric-sub">character comparisons</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Time</div>
      <div class="metric-value">${fmtTime(result.execution_time_ms)}</div>
      <div class="metric-sub">execution time</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Text Size</div>
      <div class="metric-value">${fmtSize(result.text_length)}</div>
      <div class="metric-sub">n=${result.text_length}, m=${result.pattern_length}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Complexity</div>
      <div class="metric-value" style="font-size:0.85rem">${result.complexity_worst}</div>
      <div class="metric-sub">worst case</div>
    </div>
  `;
  container.appendChild(metrics);

  // Occurrences
  if (result.occurrences.length > 0) {
    const occ = document.createElement("div");
    occ.className = "occurrences-box";
    occ.innerHTML = `<div class="occurrences-label">Found at positions</div>`;
    const chips = document.createElement("div");
    result.occurrences.slice(0, 100).forEach(pos => {
      const chip = document.createElement("span");
      chip.className = "occurrence-chip";
      chip.textContent = pos;
      chip.title = `Position ${pos}`;
      chips.appendChild(chip);
    });
    if (result.occurrences.length > 100) {
      chips.innerHTML += `<span style="color:var(--white-muted);font-size:0.65rem;margin-left:6px">+${result.occurrences.length - 100} more</span>`;
    }
    occ.appendChild(chips);
    container.appendChild(occ);
  } else {
    const noOcc = document.createElement("div");
    noOcc.className = "alert alert-info";
    noOcc.textContent = `Pattern not found in text`;
    container.appendChild(noOcc);
  }

  // Aux structures
  renderAuxStructures(result, container);

  // Separator
  const sep = document.createElement("div");
  sep.className = "section-title";
  sep.style.marginTop = "8px";
  sep.textContent = "Step-by-Step Execution";
  container.appendChild(sep);

  // Step visualizer
  renderStepVisualizer(result, container);
}

function renderAuxStructures(result, container) {
  const aux = result.aux_structures;
  if (!aux || Object.keys(aux).length === 0) return;

  const wrap = document.createElement("div");
  wrap.className = "occurrences-box";
  wrap.style.marginBottom = "12px";

  if (aux.lps_table) {
    wrap.innerHTML = `<div class="occurrences-label">LPS Table (Longest Proper Prefix Suffix)</div>`;
    const row = document.createElement("div");
    row.className = "lps-row";
    const pattern = result.pattern;
    aux.lps_table.forEach((val, i) => {
      const cell = document.createElement("div");
      cell.className = "lps-cell";
      cell.innerHTML = `<div class="lps-char">${pattern[i] || ""}</div><div class="lps-val">${val}</div>`;
      row.appendChild(cell);
    });
    wrap.appendChild(row);
    container.appendChild(wrap);
  }

  if (aux.bad_char_table) {
    wrap.innerHTML = `<div class="occurrences-label">Bad Character Table</div>`;
    const table = document.createElement("table");
    table.className = "aux-table";
    table.innerHTML = `<thead><tr><th>Char</th><th>Last Index in Pattern</th></tr></thead>`;
    const tbody = document.createElement("tbody");
    Object.entries(aux.bad_char_table).forEach(([ch, idx]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${ch === " " ? "[space]" : ch}</td><td>${idx}</td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    container.appendChild(wrap);
  }

  if (aux.base && aux.mod) {
    const info = document.createElement("div");
    info.className = "alert alert-info";
    info.style.marginBottom = "12px";
    info.textContent = `Rabin-Karp hash: BASE=${aux.base}, MOD=${aux.mod}`;
    container.appendChild(info);
  }
}

// ─── STEP VISUALIZER ─────────────────────────────────────────────────────────
function renderStepVisualizer(result, container) {
  const steps = result.steps;
  if (!steps || steps.length === 0) {
    container.innerHTML += `<div class="no-results">No steps recorded.</div>`;
    return;
  }

  const text = $("#text-input").value;
  const pattern = result.pattern;

  // Text display (truncated)
  const TEXT_DISPLAY_LIMIT = 500;
  const textSlice = text.slice(0, TEXT_DISPLAY_LIMIT);
  const textMore = text.length > TEXT_DISPLAY_LIMIT;

  const textVizWrap = document.createElement("div");
  textVizWrap.id = "text-viz-wrap";

  const patViz = document.createElement("div");
  patViz.className = "pattern-visualizer";
  patViz.id = "pattern-viz";
  [...pattern].forEach((ch, i) => {
    const span = document.createElement("span");
    span.className = "pat-char";
    span.textContent = ch;
    span.id = `pc-${i}`;
    patViz.appendChild(span);
  });

  const textVizLabel = document.createElement("div");
  textVizLabel.className = "section-title";
  textVizLabel.textContent = `Text${textMore ? ` (showing first ${TEXT_DISPLAY_LIMIT} chars)` : ""}`;
  textVizWrap.appendChild(textVizLabel);

  const textViz = document.createElement("div");
  textViz.className = "text-visualizer";
  textViz.id = "text-viz";
  [...textSlice].forEach((ch, i) => {
    const span = document.createElement("span");
    span.className = "text-char";
    span.textContent = ch === " " ? "\u00a0" : ch;
    span.id = `tc-${i}`;
    textViz.appendChild(span);
  });
  textVizWrap.appendChild(textViz);

  const patLabel = document.createElement("div");
  patLabel.className = "section-title";
  patLabel.textContent = "Pattern";

  container.appendChild(textVizWrap);
  container.appendChild(patLabel);
  container.appendChild(patViz);

  // Step controls
  const controls = document.createElement("div");
  controls.className = "step-controls";
  controls.innerHTML = `
    <span class="step-counter">Step <span id="step-cur">0</span> / <span id="step-total">${steps.length}</span></span>
    <button class="btn btn-ghost" id="btn-prev">Prev</button>
    <input type="range" class="step-slider" id="step-slider" min="0" max="${steps.length}" value="0">
    <button class="btn btn-ghost" id="btn-next">Next</button>
    <button class="btn btn-ghost" id="btn-play">Play</button>
    <button class="btn btn-ghost" id="btn-reset">Reset</button>
  `;
  container.appendChild(controls);

  // Step log
  const logWrap = document.createElement("div");
  logWrap.className = "step-log";
  logWrap.innerHTML = `<div class="step-log-header">Execution Log</div>`;
  const logBody = document.createElement("div");
  logBody.id = "step-log-body";

  steps.slice(0, 200).forEach((step, i) => {
    const entry = document.createElement("div");
    entry.className = "step-entry";
    entry.id = `step-entry-${i}`;
    entry.innerHTML = `
      <span class="step-num">#${step.step_number}</span>
      <div>
        <div class="step-comparison">${step.comparison}</div>
        ${step.note ? `<div class="step-note">${step.note}</div>` : ""}
      </div>
      ${badgeHTML(step.result)}
    `;
    logBody.appendChild(entry);
  });

  if (steps.length > 200) {
    const more = document.createElement("div");
    more.className = "no-results";
    more.textContent = `... and ${steps.length - 200} more steps`;
    logBody.appendChild(more);
  }

  logWrap.appendChild(logBody);
  container.appendChild(logWrap);

  // Wire controls
  function applyStep(idx) {
    state.stepIndex = Math.max(0, Math.min(steps.length, idx));

    // Reset highlights
    $$(".text-char").forEach(el => el.className = "text-char");
    $$(".pat-char").forEach(el => el.className = "pat-char");

    if (state.stepIndex === 0) {
      $("#step-cur").textContent = 0;
      $("#step-slider").value = 0;
      $$(".step-entry").forEach(e => e.classList.remove("current"));
      return;
    }

    const step = steps[state.stepIndex - 1];

    // Highlight text
    step.highlight_text?.forEach(i => {
      const el = $(`#tc-${i}`);
      if (!el) return;
      if (step.result === "found") el.classList.add("hl-found");
      else if (step.result === "match" || step.result === "hash_match") el.classList.add("hl-match");
      else if (step.result === "mismatch" || step.result === "hash_mismatch") {
        const isLast = i === (step.highlight_text[step.highlight_text.length - 1]);
        el.classList.add(isLast ? "hl-mismatch" : "hl-window");
      }
      else el.classList.add("hl-window");
    });

    // Highlight pattern
    step.highlight_pattern?.forEach(i => {
      const el = $(`#pc-${i}`);
      if (!el) return;
      if (step.result === "found") el.classList.add("hl-found");
      else if (step.result === "match") el.classList.add("hl-match");
      else if (step.result === "mismatch") {
        const isLast = i === (step.highlight_pattern[step.highlight_pattern.length - 1]);
        el.classList.add(isLast ? "hl-mismatch" : "hl-match");
      }
      else el.classList.add("hl-current");
    });

    // Update counter
    $("#step-cur").textContent = state.stepIndex;
    $("#step-slider").value = state.stepIndex;

    // Highlight log entry
    $$(".step-entry").forEach(e => e.classList.remove("current"));
    const entryEl = $(`#step-entry-${state.stepIndex - 1}`);
    if (entryEl) {
      entryEl.classList.add("current");
      entryEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    // Scroll text to visible area
    const tcEl = $(`#tc-${step.text_index}`);
    if (tcEl) tcEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  $("#btn-prev").onclick = () => { stopPlay(); applyStep(state.stepIndex - 1); };
  $("#btn-next").onclick = () => { stopPlay(); applyStep(state.stepIndex + 1); };
  $("#btn-reset").onclick = () => { stopPlay(); applyStep(0); };
  $("#step-slider").oninput = (e) => { stopPlay(); applyStep(+e.target.value); };

  let playing = false;
  function stopPlay() {
    playing = false;
    clearInterval(state.autoPlayTimer);
    const btn = $("#btn-play");
    if (btn) btn.textContent = "Play";
  }

  $("#btn-play").onclick = () => {
    if (playing) { stopPlay(); return; }
    playing = true;
    $("#btn-play").textContent = "Pause";
    if (state.stepIndex >= steps.length) applyStep(0);
    state.autoPlayTimer = setInterval(() => {
      if (state.stepIndex >= steps.length) { stopPlay(); return; }
      applyStep(state.stepIndex + 1);
    }, 150);
  };
}

// ─── COMPARE RENDER ───────────────────────────────────────────────────────────
function renderCompare(results) {
  const container = $("#compare-panel");
  container.innerHTML = "";

  const algs = Object.keys(results);
  if (!algs.length) { container.innerHTML = `<div class="no-results">No results</div>`; return; }

  const maxTime = Math.max(...algs.map(k => results[k]?.execution_time_ms || 0)) || 1;
  const maxComp = Math.max(...algs.map(k => results[k]?.total_comparisons || 0)) || 1;

  const title = document.createElement("div");
  title.className = "section-title";
  title.textContent = "Algorithm Comparison";
  container.appendChild(title);

  const table = document.createElement("table");
  table.className = "compare-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Algorithm</th>
        <th>Occurrences</th>
        <th>Comparisons</th>
        <th>Time</th>
        <th>Complexity (Avg)</th>
        <th>Complexity (Worst)</th>
      </tr>
    </thead>
  `;

  const minTime = Math.min(...algs.map(k => results[k]?.execution_time_ms || Infinity));
  const minComp = Math.min(...algs.map(k => results[k]?.total_comparisons || Infinity));

  const tbody = document.createElement("tbody");
  algs.forEach(key => {
    const r = results[key];
    if (!r) return;
    const isTimeWinner = r.execution_time_ms === minTime;
    const isCompWinner = r.total_comparisons === minComp;

    const timeBar = Math.max(4, (r.execution_time_ms / maxTime) * 160);
    const compBar = Math.max(4, (r.total_comparisons / maxComp) * 160);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="color:var(--white);font-weight:500">${r.algorithm}${isTimeWinner ? `<span class="winner-badge">fastest</span>` : ""}</td>
      <td>${fmtNum(r.occurrences.length)}</td>
      <td>
        <div class="bar-wrap">
          <div class="bar" style="width:${compBar}px;${isCompWinner ? "background:var(--accent-found)" : ""}"></div>
          <span class="bar-label">${fmtNum(r.total_comparisons)}${isCompWinner ? " *" : ""}</span>
        </div>
      </td>
      <td>
        <div class="bar-wrap">
          <div class="bar" style="width:${timeBar}px;${isTimeWinner ? "background:var(--accent-found)" : ""}"></div>
          <span class="bar-label">${fmtTime(r.execution_time_ms)}</span>
        </div>
      </td>
      <td style="color:var(--blue-glow)">${r.complexity_average}</td>
      <td style="color:var(--white-muted)">${r.complexity_worst}</td>
    `;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);

  // Summary
  const summary = document.createElement("div");
  summary.className = "alert alert-info";
  summary.style.marginTop = "16px";
  const winner = algs.reduce((a, b) => (results[a]?.execution_time_ms || 0) < (results[b]?.execution_time_ms || 0) ? a : b);
  summary.textContent = `Fastest algorithm: ${results[winner]?.algorithm} (${fmtTime(results[winner]?.execution_time_ms)}) — n=${results[winner]?.text_length}, m=${results[winner]?.pattern_length}`;
  container.appendChild(summary);
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
function activateTab(tabId) {
  $$(".tab").forEach(t => t.classList.remove("active"));
  $$(".tab-content").forEach(c => c.classList.remove("active"));
  const tab = $(`[data-tab="${tabId}"]`);
  const content = $(`#${tabId}`);
  if (tab) tab.classList.add("active");
  if (content) content.classList.add("active");
}

// ─── ALERTS ──────────────────────────────────────────────────────────────────
function showAlert(msg, type = "info") {
  const container = $("#alert-container");
  container.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
  setTimeout(() => container.innerHTML = "", 4000);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  updateAlgoInfo();

  // Upload zone
  const zone = $("#upload-zone");
  const fileInput = $("#file-input");

  zone.onclick = () => fileInput.click();
  fileInput.onchange = () => uploadFiles(fileInput.files);

  zone.ondragover = (e) => { e.preventDefault(); zone.classList.add("drag-over"); };
  zone.ondragleave = () => zone.classList.remove("drag-over");
  zone.ondrop = (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    uploadFiles(e.dataTransfer.files);
  };

  // Algo select
  $("#alg-select").onchange = updateAlgoInfo;

  // Buttons
  $("#btn-run").onclick = () => runSearch(false);
  $("#btn-stepmode").onclick = () => runSearch(false).then(() => {
    const el = $("#step-log-body");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  });
  $("#btn-compare").onclick = () => runSearch(true);

  // Tabs
  $$(".tab").forEach(tab => {
    tab.onclick = () => activateTab(tab.dataset.tab);
  });

  // Enter key on pattern input
  $("#pattern-input").onkeydown = (e) => {
    if (e.key === "Enter") runSearch(false);
  };

  setStatus("Ready", "ready");
});
