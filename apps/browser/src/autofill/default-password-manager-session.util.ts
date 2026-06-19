import { BrowserApi } from "../platform/browser/browser-api";

const DEFAULT_PASSWORD_MANAGER_SESSION_STATE_KEY = "defaultPasswordManagerSessionState";

export type DefaultPasswordManagerSessionState = "pending" | "show-toast";

export async function getDefaultPasswordManagerSessionState(): Promise<DefaultPasswordManagerSessionState | null> {
  if (!chrome.storage?.session) {
    return null;
  }

  const result = await chrome.storage.session.get(DEFAULT_PASSWORD_MANAGER_SESSION_STATE_KEY);
  const state = result?.[DEFAULT_PASSWORD_MANAGER_SESSION_STATE_KEY];

  return state === "pending" || state === "show-toast" ? state : null;
}

export async function setDefaultPasswordManagerSessionState(
  state: DefaultPasswordManagerSessionState | null,
): Promise<void> {
  if (!chrome.storage?.session) {
    return;
  }

  if (state) {
    await chrome.storage.session.set({ [DEFAULT_PASSWORD_MANAGER_SESSION_STATE_KEY]: state });
  } else {
    await chrome.storage.session.remove(DEFAULT_PASSWORD_MANAGER_SESSION_STATE_KEY);
  }
}

export async function applyDefaultPasswordManagerOverride(): Promise<void> {
  await BrowserApi.updateDefaultBrowserAutofillSettings(false);
  await setDefaultPasswordManagerSessionState("show-toast");
}

export async function consumeDefaultPasswordManagerSuccessToast(): Promise<boolean> {
  if ((await getDefaultPasswordManagerSessionState()) !== "show-toast") {
    return false;
  }

  await setDefaultPasswordManagerSessionState(null);
  return true;
}

export async function completePendingDefaultPasswordManagerApply(): Promise<void> {
  if ((await getDefaultPasswordManagerSessionState()) !== "pending") {
    return;
  }

  await applyDefaultPasswordManagerOverride();
}
