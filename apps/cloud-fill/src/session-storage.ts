/**
 * Identity key and session state live in chrome.storage.session: in memory only, cleared when the
 * browser closes, and unreachable from content scripts and pages (the default access level is
 * trusted contexts). It survives service worker restarts, which the Noise transport must.
 */

export const IdentityKey = "cloudFillIdentity";
export const ConnectionsKey = "cloudFillConnections";
export const PairingKey = "cloudFillPairing";

export type Pairing = { userFingerprint: string; relayUrl: string };

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

export async function loadIdentity(): Promise<Uint8Array | null> {
  const stored = (await chrome.storage.session.get(IdentityKey))[IdentityKey];
  return typeof stored === "string" ? fromBase64(stored) : null;
}

export async function saveIdentity(cose: Uint8Array): Promise<void> {
  await chrome.storage.session.set({ [IdentityKey]: toBase64(cose) });
}

export async function loadPairing(): Promise<Pairing | null> {
  return (
    ((await chrome.storage.session.get(PairingKey))[PairingKey] as Pairing | undefined) ?? null
  );
}

export async function savePairing(pairing: Pairing): Promise<void> {
  await chrome.storage.session.set({ [PairingKey]: pairing });
}

/** Persistence callbacks handed to the wasm connection store. */
export const connectionStorage = {
  async load(): Promise<string | null> {
    const stored = (await chrome.storage.session.get(ConnectionsKey))[ConnectionsKey];
    return typeof stored === "string" ? stored : null;
  },
  async save(json: string): Promise<void> {
    await chrome.storage.session.set({ [ConnectionsKey]: json });
  },
};
