import { CdpSession, Target } from "./cdp";

/** Session storage key of the decrypted cipher cache, after the `session_<user>_` prefix. */
const DECRYPTED_CIPHERS_KEY = "ciphersMemory_decryptedCiphers";

export type VaultCacheState = {
  /** Size of the encrypted value in `chrome.storage.local`, 0 when absent. */
  sessionStorageBytes: number;
  /** Ciphers in the service worker's in-memory copy, 0 when absent or empty. */
  inMemoryCiphers: number;
};

/**
 * Whether the service worker holds the decrypted cipher cache: the session storage value
 * (encrypted with the session key) and the in-memory copy `LocalBackedSessionStorageService`
 * keeps of it.
 */
export async function vaultCacheState(target: Target): Promise<VaultCacheState> {
  const session = await CdpSession.connect(target);

  try {
    const { result } = await session.send("Runtime.evaluate", {
      expression: `(async () => {
        const key = ${JSON.stringify(DECRYPTED_CIPHERS_KEY)};
        const local = await chrome.storage.local.get(null);
        const stored = Object.entries(local).find(([k]) => k.endsWith(key));
        const cache = self.bitwardenMain.largeObjectMemoryStorageForStateProviders.cache ?? {};
        const inMemory = Object.entries(cache).find(([k]) => k.endsWith(key))?.[1];
        return {
          sessionStorageBytes: stored ? JSON.stringify(stored[1]).length : 0,
          inMemoryCiphers: inMemory ? Object.keys(inMemory).length : 0,
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });

    return result.value;
  } finally {
    session.close();
  }
}
