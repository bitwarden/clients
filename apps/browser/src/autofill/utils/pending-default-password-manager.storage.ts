/**
 * Session storage for the default password manager permission flow.
 *
 * Used when enabling Bitwarden as default password manager which requires the privacy permission and the popup
 * may close before the user responds. Uses session storage so the flag survives popup close but is cleared once the session ends.
 */
const pendingDefaultPasswordManagerApplyKey = "pendingDefaultPasswordManagerApply";

const isWebExtensionsApi = typeof browser !== "undefined";

async function getSessionStorageValue(storageKey: string): Promise<unknown> {
  if (isWebExtensionsApi) {
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
  if (isWebExtensionsApi) {
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

export async function getPendingDefaultPasswordManagerApply(): Promise<boolean> {
  return Boolean(await getSessionStorageValue(pendingDefaultPasswordManagerApplyKey));
}

export async function setPendingDefaultPasswordManagerApply(isPending: boolean): Promise<void> {
  await setSessionStorageValue(pendingDefaultPasswordManagerApplyKey, isPending ? true : null);
}
