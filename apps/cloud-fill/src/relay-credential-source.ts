import type { LoginFillCredential } from "@bitwarden/browser/autofill/utils/login-fill-script";

import type { CredentialSource } from "./credential-source";
import {
  connectionStorage,
  loadIdentity,
  loadPairing,
  saveIdentity,
  savePairing,
} from "./session-storage";
import { ensureWasm, generateIdentity, WasmRemoteClient } from "./wasm-loader";

const KEEPALIVE_INTERVAL_MS = 20_000;
const PSK_TOKEN = /^[0-9a-f]{64}_[0-9a-f]{64}$/;

export class CredentialRequestError extends Error {
  constructor(readonly kind: "not_paired" | "denied" | "relay_error") {
    super(kind);
  }
}

export function relayUrlAllowed(url: string, allowInsecureLocal: boolean): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "wss:") {
      return true;
    }
    return (
      allowInsecureLocal &&
      parsed.protocol === "ws:" &&
      (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost")
    );
  } catch {
    return false;
  }
}

async function identity(): Promise<Uint8Array> {
  let cose = await loadIdentity();
  if (cose == null) {
    cose = generateIdentity();
    await saveIdentity(cose);
  }
  return cose;
}

async function connect(relayUrl: string): Promise<WasmRemoteClient> {
  await ensureWasm();
  const client = new WasmRemoteClient(relayUrl, await identity(), connectionStorage);
  await client.connect();
  return client;
}

export async function pairWithToken(
  pskToken: string,
  relayUrl: string,
  allowInsecureLocal: boolean,
): Promise<void> {
  if (!PSK_TOKEN.test(pskToken) || !relayUrlAllowed(relayUrl, allowInsecureLocal)) {
    throw new CredentialRequestError("relay_error");
  }

  const client = await connect(relayUrl);
  try {
    await client.pairWithPsk(pskToken);
  } catch {
    throw new CredentialRequestError("relay_error");
  } finally {
    client.close();
  }
  await savePairing({ userFingerprint: pskToken.slice(65), relayUrl });
}

export class RelayCredentialSource implements CredentialSource {
  async request(origin: string): Promise<LoginFillCredential | null> {
    const pairing = await loadPairing();
    if (pairing == null) {
      throw new CredentialRequestError("not_paired");
    }

    let client: WasmRemoteClient | undefined;
    // Frames sent while waiting for the user keep the relay session and the service worker alive.
    let keepalive: ReturnType<typeof setInterval> | undefined;
    try {
      client = await connect(pairing.relayUrl);
      await client.loadCachedConnection(pairing.userFingerprint);
      const active = client;
      keepalive = setInterval(() => active.keepalive(), KEEPALIVE_INTERVAL_MS);

      const credential = await client.requestCredential(new URL(origin).hostname);
      const result: LoginFillCredential = {
        username: credential.username ?? null,
        password: credential.password ?? null,
        totp: null,
      };
      credential.free();
      return result;
    } catch (error) {
      if (error instanceof CredentialRequestError) {
        throw error;
      }
      throw new CredentialRequestError(
        /denied|declin|reject/i.test(String(error)) ? "denied" : "relay_error",
      );
    } finally {
      clearInterval(keepalive);
      client?.close();
    }
  }
}
