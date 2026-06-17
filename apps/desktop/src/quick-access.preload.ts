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
  iconUrl?: string;
}

export type QuickAccessAction = "password" | "username" | "totp" | "openfill";

export interface QuickAccessActivation {
  id: string;
  action: QuickAccessAction;
}

export interface QuickAccessActionOption {
  action: QuickAccessAction;
  label: string;
}

export interface QuickAccessActions {
  id: string;
  actions: QuickAccessActionOption[];
}

export interface QuickAccessLockState {
  /** True when there's an active account whose vault is locked. */
  locked: boolean;
  /** True when biometric unlock (e.g. Windows Hello) is available right now. */
  canBiometricUnlock: boolean;
}

export interface QuickAccessSuggestions {
  /** Short label for the matched context (e.g. the app/site name). */
  context: string;
  /** Items matched against the foreground window/page. */
  items: QuickAccessResult[];
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
  /** Register a handler for "what copyable fields does this item have?" requests. */
  onActionsRequest: (cb: (id: string) => void): (() => void) => {
    const handler = (_event: unknown, id: string) => cb(id);
    ipcRenderer.on("kls-qa:actions-request", handler);
    return () => ipcRenderer.removeListener("kls-qa:actions-request", handler);
  },
  /** Send the available actions for an item back to the spotlight. */
  sendActions: (actions: QuickAccessActions): void => {
    ipcRenderer.send("kls-qa:actions", actions);
  },
  /** Push the translated UI label bundle for the spotlight (cached by main). */
  sendLabels: (labels: Record<string, string>): void => {
    ipcRenderer.send("kls-qa:labels", labels);
  },
  /** Register a handler for "activate this item" requests from the spotlight. */
  onActivate: (cb: (activation: QuickAccessActivation) => void): (() => void) => {
    const handler = (_event: unknown, activation: QuickAccessActivation) => cb(activation);
    ipcRenderer.on("kls-qa:activate", handler);
    return () => ipcRenderer.removeListener("kls-qa:activate", handler);
  },
  /** Register a handler for "is the vault locked?" requests from the spotlight. */
  onLockStateRequest: (cb: () => void): (() => void) => {
    const handler = () => cb();
    ipcRenderer.on("kls-qa:lock-state-request", handler);
    return () => ipcRenderer.removeListener("kls-qa:lock-state-request", handler);
  },
  /** Send the current lock state (and biometric availability) to the spotlight. */
  sendLockState: (state: QuickAccessLockState): void => {
    ipcRenderer.send("kls-qa:lock-state", state);
  },
  /** Register a handler for "unlock with biometrics" requests from the spotlight. */
  onUnlockRequest: (cb: () => void): (() => void) => {
    const handler = () => cb();
    ipcRenderer.on("kls-qa:unlock", handler);
    return () => ipcRenderer.removeListener("kls-qa:unlock", handler);
  },
  /**
   * Register a handler for the foreground-window context (the title of the app/page
   * focused when the spotlight was summoned), so the renderer can suggest matches.
   */
  onContext: (cb: (title: string) => void): (() => void) => {
    const handler = (_event: unknown, title: string) => cb(title);
    ipcRenderer.on("kls-qa:context", handler);
    return () => ipcRenderer.removeListener("kls-qa:context", handler);
  },
  /** Send context-derived suggestions to the spotlight (empty-query state). */
  sendSuggestions: (payload: QuickAccessSuggestions): void => {
    ipcRenderer.send("kls-qa:suggestions", payload);
  },
};

export default klsQuickAccess;
