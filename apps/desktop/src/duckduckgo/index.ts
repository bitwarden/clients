/**
 * The DuckDuckGo browser integration.
 *
 * This module implements the messaging to DuckDuckGo over native messaging IPC, including the
 * custom encryption protocol it uses. DuckDuckGo's side of it lives in their browser repository:
 * https://github.com/duckduckgo/apple-browsers/tree/04d678b447869c3a640714718a466b36407db8b6/macOS/DuckDuckGo/PasswordManager/Bitwarden
 *
 * The two service layers are not exported here. `main/` imports Electron's `ipcMain` and
 * `services/` is Angular, so re-exporting either would pull one process's dependencies into the
 * other's bundle. Import those from their own paths.
 */
export * from "./protocol";
export {
  DANGEROUS_aesDecryptDuckDuckGoNoPaddingAes256CbcHmac,
  DuckDuckGoEncstring,
} from "./duckduckgo-crypto";
