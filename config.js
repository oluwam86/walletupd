// config.js
// ---------------------------------------------------------------------
// TonAPI (https://tonapi.io) is a free public API for reading data from
// the TON blockchain. We only ever GET data with it — nothing here can
// move funds, sign anything, or connect a wallet.
//
// Unauthenticated requests work but are rate-limited (a few per second).
// If you hit rate-limit errors while testing, get a free API key at
// https://tonconsole.com and paste it below. Never commit a real key to
// a public repo for anything other than a read-only demo like this one.
// ---------------------------------------------------------------------
const TON_CONFIG = {
  apiBase: "https://tonapi.io/v2",
  apiKey: "", // optional: "Bearer xxxxx" style key from tonconsole.com
  network: "mainnet",
};

// ---------------------------------------------------------------------
// Nodes Balance — this is a plain editable value, NOT pulled from the
// blockchain. Everything else on the page (real Balance, Contract type,
// history, etc.) is live data from TonAPI, but this row is just text you
// control yourself. To change what shows up on the page, edit the values
// below and save the file — that's the whole "database".
// ---------------------------------------------------------------------
const NODES_BALANCE = {
  amount: "0.229",         // shown exactly as typed, so use whatever decimals you want
  symbol: "GRAM",
  prevSymbol: "TON",       // shown in parentheses as "(prev. TON)"
  usdValue: "0.34484",     // shown as "≈ $0.34484"
  tooltip: "PLEASE MAKE A MAX DEPOSIT TO UNLOCK", // text inside the popover when the ⓘ next to this row is hovered/tapped
};

// Text shown in the popover for the ⓘ next to "Contract type". Edit freely.
const CONTRACT_TYPE_TOOLTIP = "The wallet contract version this address is running";
