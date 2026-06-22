import { BrowserApi } from "../platform/browser/browser-api";

const DEFAULT_PASSWORD_MANAGER_SESSION_STATE_KEY = "defaultPasswordManagerSessionState";

export type DefaultPasswordManagerSessionState = "pending" | "show-toast";

async function getSessionStorageValue(storageKey: string): Promise<unknown> {
  if (BrowserApi.isWebExtensionsApi) {
    const sessionStorage = browser?.storage?.session;
    if (!sessionStorage) {
      return undefined;
    }

    const items = await sessionStorage.get(storageKey);
    return items?.[storageKey];
  }

  const sessionStorage = chrome?.storage?.session;
  if (!sessionStorage) {
    return undefined;
  }

  return new Promise((resolve) =>
    sessionStorage.get(storageKey, (result) => resolve(result?.[storageKey])),
  );
}

async function setSessionStorageValue(
  storageKey: string,
  storageValue: unknown | null,
): Promise<void> {
  if (BrowserApi.isWebExtensionsApi) {
    const sessionStorage = browser?.storage?.session;
    if (!sessionStorage) {
      return;
    }

    if (storageValue == null) {
      await sessionStorage.remove(storageKey);
    } else {
      await sessionStorage.set({ [storageKey]: storageValue });
    }
    return;
  }

  const sessionStorage = chrome?.storage?.session;
  if (!sessionStorage) {
    return;
  }

  await new Promise<void>((resolve) => {
    if (storageValue == null) {
      sessionStorage.remove(storageKey, () => resolve());
    } else {
      sessionStorage.set({ [storageKey]: storageValue }, () => resolve());
    }
  });
}

export async function getDefaultPasswordManagerSessionState(): Promise<DefaultPasswordManagerSessionState | null> {
  const state = await getSessionStorageValue(DEFAULT_PASSWORD_MANAGER_SESSION_STATE_KEY);

  return state === "pending" || state === "show-toast" ? state : null;
}

export async function setDefaultPasswordManagerSessionState(
  state: DefaultPasswordManagerSessionState | null,
): Promise<void> {
  await setSessionStorageValue(DEFAULT_PASSWORD_MANAGER_SESSION_STATE_KEY, state);
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
