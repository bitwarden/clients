import { ipcRenderer } from "electron";

/**
 * FORK (klappstuhl): main-window preload subspace for the Quick Access spotlight.
 *
 * Lets the renderer (which owns the decrypted vault) answer search requests from
 * the spotlight window and perform copies. Exposed as `ipc.klsQuickAccess`.
 * Carries only display fields out (title/subtitle) and a cipher id + action in —
 * never secrets.
 */
export interface QuickAccessResult {
  id: string;
  title: string;
  subtitle?: string;
  kind: string;
}

export interface QuickAccessActivation {
  id: string;
  action: "password" | "username" | "totp";
}

const klsQuickAccess = {
  /** Register a handler for incoming search queries from the spotlight. */
  onSearch: (cb: (query: string) => void): (() => void) => {
    const handler = (_event: unknown, query: string) => cb(query);
    ipcRenderer.on("kls-qa:search", handler);
    return () => ipcRenderer.removeListener("kls-qa:search", handler);
  },
  /** Send computed results back to the spotlight. */
  sendResults: (results: QuickAccessResult[]): void => {
    ipcRenderer.send("kls-qa:results", results);
  },
  /** Register a handler for "activate this item" requests from the spotlight. */
  onActivate: (cb: (activation: QuickAccessActivation) => void): (() => void) => {
    const handler = (_event: unknown, activation: QuickAccessActivation) => cb(activation);
    ipcRenderer.on("kls-qa:activate", handler);
    return () => ipcRenderer.removeListener("kls-qa:activate", handler);
  },
};

export default klsQuickAccess;
