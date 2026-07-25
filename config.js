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
