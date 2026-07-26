// app.js
// Beginner-friendly, heavily commented rendering + interaction logic.
//
// BlockPeek is READ-ONLY: every network call below is a GET request to
// TonAPI's public endpoints. There is no wallet connect, no signing,
// and no way for this page to move funds.

// ---------------------------------------------------------------------
// 0. Small helpers
// ---------------------------------------------------------------------
const els = {
  crumbAddr: document.getElementById("crumbAddr"),
  emptyState: document.getElementById("emptyState"),
  loadingState: document.getElementById("loadingState"),
  errorState: document.getElementById("errorState"),
  errorMsg: document.getElementById("errorMsg"),
  resultWrap: document.getElementById("resultWrap"),
  fullAddress: document.getElementById("fullAddress"),
  balanceVal: document.getElementById("balanceVal"),
  balanceUsd: document.getElementById("balanceUsd"),
  contractType: document.getElementById("contractType"),
  statusLabel: document.getElementById("statusLabel"),
  statusDot: document.getElementById("statusDot"),
  chainTag: document.getElementById("chainTag"),
  tokenCount: document.getElementById("tokenCount"),
  historyBody: document.getElementById("historyBody"),
  nodesBalanceVal: document.getElementById("nodesBalanceVal"),
  nodesBalanceUsd: document.getElementById("nodesBalanceUsd"),
};

function showOnly(stateEl) {
  [els.emptyState, els.loadingState, els.errorState, els.resultWrap].forEach((el) => {
    if (el) el.hidden = el !== stateEl;
  });
}

// ---------------------------------------------------------------------
// Nodes Balance: a plain editable line, not fetched from the blockchain.
// Values live in config.js (NODES_BALANCE) — edit that file to change
// what shows up here.
// ---------------------------------------------------------------------
els.nodesBalanceVal.textContent = `${NODES_BALANCE.amount} ${NODES_BALANCE.symbol} (prev. ${NODES_BALANCE.prevSymbol})`;
els.nodesBalanceUsd.textContent = `≈ $${NODES_BALANCE.usdValue}`;

// ---------------------------------------------------------------------
// Info-icon tooltips: hover shows it on desktop (pure CSS), tapping the
// button toggles it open on mobile. Text for each comes from config.js.
// ---------------------------------------------------------------------
function wireTooltip(btnId, tooltipId, text) {
  const btn = document.getElementById(btnId);
  const tooltip = document.getElementById(tooltipId);
  const wrap = btn && btn.closest(".info-wrap");
  if (!wrap || !btn || !tooltip) return;
  tooltip.textContent = text;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".info-wrap.is-open").forEach((w) => {
      if (w !== wrap) w.classList.remove("is-open");
    });
    wrap.classList.toggle("is-open");
  });
}

wireTooltip("nodesInfoBtn", "nodesTooltip", NODES_BALANCE.tooltip);
wireTooltip("contractInfoBtn", "contractTooltip", CONTRACT_TYPE_TOOLTIP);

document.addEventListener("click", () => {
  document.querySelectorAll(".info-wrap.is-open").forEach((w) => w.classList.remove("is-open"));
});

function nanoToTon(nano) {
  const n = typeof nano === "string" ? parseFloat(nano) : nano;
  if (Number.isNaN(n)) return 0;
  return n / 1e9;
}

function formatTon(amount, symbol = "TON") {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (amount < 0) return `– ${formatted} ${symbol}`;
  return `+${formatted} ${symbol}`;
}

function shortAddr(addr) {
  if (!addr) return "unknown";
  // Readable names (e.g. TON DNS domains like "soulfarmbot.ton") should be
  // shown in full — only raw base64/hex addresses get the middle-truncated
  // "EQxxx…yyy" treatment.
  const looksLikeDomain = /\.[a-z]{2,}$/i.test(addr) && addr.length <= 32;
  if (looksLikeDomain) return addr;
  return addr.length > 14 ? `${addr.slice(0, 6)}…${addr.slice(-6)}` : addr;
}

async function tonApiGet(path) {
  const headers = { accept: "application/json" };
  if (TON_CONFIG.apiKey) headers["Authorization"] = `Bearer ${TON_CONFIG.apiKey}`;
  const res = await fetch(`${TON_CONFIG.apiBase}${path}`, { headers });
  if (!res.ok) {
    if (res.status === 404) throw new Error("That address doesn't look like a known TON account yet.");
    if (res.status === 429) throw new Error("TonAPI rate limit hit — wait a few seconds and try again.");
    throw new Error(`TonAPI error (${res.status}). The address may be malformed.`);
  }
  return res.json();
}

// ---------------------------------------------------------------------
// 2. Search bar wiring
// ---------------------------------------------------------------------
document.getElementById("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const value = document.getElementById("searchInput").value.trim();
  if (value) loadAddress(value);
});

const exampleBtn = document.getElementById("exampleBtn");
if (exampleBtn) {
  exampleBtn.addEventListener("click", () => {
    const addr = exampleBtn.textContent.trim();
    document.getElementById("searchInput").value = addr;
    loadAddress(addr);
  });
}

// ---------------------------------------------------------------------
// 3. Main flow: fetch live account + jettons + history from TonAPI
// ---------------------------------------------------------------------
let currentTokenFilter = "all";
let currentSort = "newest";
let currentDateFilter = "all";
let currentRows = [];
let currentAddress = null;

async function loadAddress(address) {
  currentAddress = address;
  showOnly(els.loadingState);

  try {
    const [account, jettons, events] = await Promise.all([
      tonApiGet(`/accounts/${encodeURIComponent(address)}`),
      tonApiGet(`/accounts/${encodeURIComponent(address)}/jettons`).catch(() => ({ balances: [] })),
      tonApiGet(`/accounts/${encodeURIComponent(address)}/events?limit=25`).catch(() => ({ events: [] })),
    ]);

    // TON price is a nice-to-have — don't fail the whole page if it's unavailable
    let usdPerTon = null;
    try {
      const rates = await tonApiGet(`/rates?tokens=ton&currencies=usd`);
      usdPerTon = rates?.rates?.TON?.prices?.USD ?? null;
    } catch (_) {}

    renderAccount(account, jettons, usdPerTon);
    currentRows = buildHistoryRows(events, account.address || address);
    renderHistory();
    showOnly(els.resultWrap);
  } catch (err) {
    els.errorMsg.textContent = err.message || "Couldn't load that address.";
    showOnly(els.errorState);
  }
}

function renderAccount(account, jettons, usdPerTon) {
  const displayAddr = account.name || currentAddress;
  els.crumbAddr.textContent = shortAddr(displayAddr);
  els.fullAddress.textContent = currentAddress;

  const balanceTon = nanoToTon(account.balance);
  els.balanceVal.textContent = `${balanceTon.toLocaleString(undefined, { maximumFractionDigits: 4 })} GRAM (prev. TON)`;
  els.balanceUsd.textContent = usdPerTon != null ? `≈ $${(balanceTon * usdPerTon).toFixed(2)}` : "";

  els.contractType.textContent = (account.interfaces && account.interfaces.length)
    ? account.interfaces.join(", ")
    : (account.is_wallet ? "wallet" : "contract");

  const status = account.status || "unknown";
  els.statusLabel.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  els.statusDot.style.background = status === "active" ? "var(--good)" : "var(--muted)";
  els.statusDot.style.animation = status === "active" ? "" : "none";

  const rawAddr = account.address || "";
  const [workchain, hex] = rawAddr.split(":");
  els.chainTag.textContent = hex ? `${workchain}:${hex.slice(0, 3)}…${hex.slice(-6)}` : "";

  els.tokenCount.textContent = jettons.balances ? jettons.balances.length : 0;
}

// Turn TonAPI "events" (each with one or more actions) into flat table rows
function buildHistoryRows(eventsResponse, myRawAddress) {
  const rows = [];
  const events = eventsResponse.events || [];

  events.forEach((event) => {
    const timestampMs = (event.timestamp || 0) * 1000;
    const dt = new Date(timestampMs);
    const date = dt.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
    const time = dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    const failed = event.in_progress === false && (event.actions || []).some((a) => a.status === "failed");

    (event.actions || []).forEach((action) => {
      const row = actionToRow(action, myRawAddress, date, time, failed, timestampMs);
      if (row) rows.push(row);
    });
  });

  return rows;
}

function actionToRow(action, myRawAddress, date, time, failed, timestampMs) {
  const preview = action.simple_preview || {};
  let label = preview.name || action.type || "Contract call";
  let party = "unknown";
  let amountTon = null;
  let symbol = "TON";
  let negative = false;
  let memo = "-";

  if (action.type === "TonTransfer" && action.TonTransfer) {
    const t = action.TonTransfer;
    const isOutgoing = t.sender && t.sender.address === myRawAddress;
    negative = isOutgoing;
    party = isOutgoing ? (t.recipient?.name || t.recipient?.address) : (t.sender?.name || t.sender?.address);
    amountTon = nanoToTon(t.amount) * (isOutgoing ? -1 : 1);
    label = isOutgoing ? "Sent TON" : "Received TON";
    if (t.comment) memo = t.comment;
  } else if (action.type === "JettonTransfer" && action.JettonTransfer) {
    const j = action.JettonTransfer;
    const isOutgoing = j.sender && j.sender.address === myRawAddress;
    negative = isOutgoing;
    party = isOutgoing ? (j.recipient?.name || j.recipient?.address) : (j.sender?.name || j.sender?.address);
    symbol = j.jetton?.symbol || "TOKEN";
    const decimals = j.jetton?.decimals ?? 9;
    amountTon = (parseFloat(j.amount) / Math.pow(10, decimals)) * (isOutgoing ? -1 : 1);
    label = isOutgoing ? `Sent ${symbol}` : `Received ${symbol}`;
    if (j.comment) memo = j.comment;
  } else if (preview.value) {
    // Fallback: use TonAPI's own human-readable preview string, e.g. "-1.5 TON"
    negative = preview.value.trim().startsWith("-");
    party = (preview.accounts && preview.accounts[0] && (preview.accounts[0].name || preview.accounts[0].address)) || "contract";
  }

  // A failed action's job/trace id is genuinely useful context, so surface it
  // in the memo slot when there's no user comment to show instead.
  if (failed && memo === "-" && action.tx_hash) memo = `job-${action.tx_hash.slice(0, 20)}`;

  return {
    date,
    time,
    timestampMs,
    type: failed ? "send-failed" : negative ? "send" : "receive",
    label,
    party: shortAddr(party),
    memo,
    amount: amountTon != null ? formatTon(amountTon, symbol) : (preview.value || "—"),
    negative,
    rawAmount: amountTon != null ? Math.abs(amountTon) : 0,
  };
}

function arrowFor(type) {
  if (type === "send") return `<span class="tx-arrow out">↑</span>`;
  if (type === "receive") return `<span class="tx-arrow in">↓</span>`;
  return `<span class="tx-arrow fail">✕</span>`;
}

function getFilteredSortedHistory() {
  let rows = currentRows.slice();

  if (currentTokenFilter === "TON") {
    rows = rows.filter((r) => r.amount.includes(" TON"));
  } else if (currentTokenFilter === "jetton") {
    rows = rows.filter((r) => !r.amount.includes(" TON"));
  }

  if (currentDateFilter !== "all") {
    const days = parseInt(currentDateFilter, 10);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    rows = rows.filter((r) => r.timestampMs >= cutoff);
  }

  if (currentSort === "amount") {
    rows.sort((a, b) => b.rawAmount - a.rawAmount);
  } else if (currentSort === "oldest") {
    rows = rows.slice().reverse();
  }

  return rows;
}

function renderHistory() {
  const body = els.historyBody;
  body.innerHTML = "";

  const rows = getFilteredSortedHistory();
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center; padding:24px;">No transactions found for this address yet.</td></tr>`;
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const failBadge = row.type === "send-failed" ? `<span class="fail-badge">Failed</span>` : "";
    tr.innerHTML = `
      <td class="tx-date">${row.date} ${row.time}</td>
      <td class="tx-type">${arrowFor(row.type)} ${row.label} ${failBadge}</td>
      <td><a href="#" class="tx-party">${row.party}</a></td>
      <td class="tx-memo ${row.memo !== "-" ? "has-value" : ""}">${row.memo}</td>
      <td class="tx-amount ${row.negative ? "neg" : "pos"}">${row.amount}</td>
    `;
    body.appendChild(tr);
  });
}

// ---------------------------------------------------------------------
// 4. Copy-to-clipboard button
// ---------------------------------------------------------------------
document.getElementById("copyBtn").addEventListener("click", () => {
  navigator.clipboard.writeText(els.fullAddress.textContent).catch(() => {});
  const btn = document.getElementById("copyBtn");
  const original = btn.textContent;
  btn.textContent = "✓";
  setTimeout(() => (btn.textContent = original), 1200);
});

document.getElementById("refreshBtn").addEventListener("click", () => {
  if (currentAddress) loadAddress(currentAddress);
});

// ---------------------------------------------------------------------
// 5. Generic dropdown toggling (settings menu + every toolbar filter)
// ---------------------------------------------------------------------
function closeAllDropdowns(except) {
  document.querySelectorAll(".dropdown-panel.is-open").forEach((panel) => {
    if (panel !== except) panel.classList.remove("is-open");
  });
}

document.getElementById("settingsBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  const panel = document.getElementById("settingsPanel");
  const willOpen = !panel.classList.contains("is-open");
  closeAllDropdowns(willOpen ? panel : null);
  panel.classList.toggle("is-open", willOpen);
});

document.querySelectorAll("[data-dd]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const panel = document.querySelector(`[data-panel="${btn.dataset.dd}"]`);
    const willOpen = !panel.classList.contains("is-open");
    closeAllDropdowns(willOpen ? panel : null);
    panel.classList.toggle("is-open", willOpen);
  });
});

document.addEventListener("click", () => closeAllDropdowns());

document.querySelectorAll(".dd-row[data-setting]").forEach((row) => {
  row.addEventListener("click", () => {
    const group = row.closest(".dd-group");
    group.querySelectorAll(".dd-check").forEach((c) => c.remove());
    const check = document.createElement("span");
    check.className = "dd-check";
    check.textContent = "✓";
    row.appendChild(check);
  });
});
document.querySelectorAll(".dd-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    chip.parentElement.querySelectorAll(".dd-chip").forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
  });
});

// ---------------------------------------------------------------------
// 6. Tabs (only "History" has content in this demo)
// ---------------------------------------------------------------------
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
  });
});

// ---------------------------------------------------------------------
// 7. History toolbar filters
// ---------------------------------------------------------------------
document.querySelectorAll("[data-filter-token]").forEach((row) => {
  row.addEventListener("click", () => {
    currentTokenFilter = row.dataset.filterToken;
    document.querySelectorAll("[data-filter-token]").forEach((r) => r.classList.remove("is-active"));
    row.classList.add("is-active");
    renderHistory();
  });
});

document.querySelectorAll("[data-sort]").forEach((row) => {
  row.addEventListener("click", () => {
    currentSort = row.dataset.sort;
    document.querySelectorAll("[data-sort]").forEach((r) => r.classList.remove("is-active"));
    row.classList.add("is-active");
    renderHistory();
  });
});

document.querySelectorAll("[data-date]").forEach((row) => {
  row.addEventListener("click", () => {
    currentDateFilter = row.dataset.date;
    document.querySelectorAll("[data-date]").forEach((r) => r.classList.remove("is-active"));
    row.classList.add("is-active");
    renderHistory();
  });
});

// Also let the tabs themselves reflect the active choice (the History tab
// is the only one with real content in this demo, same as the reference
// site's other tabs — clicking them just swaps the underline for now).

// Start on the empty state until the person searches an address
showOnly(els.emptyState);
