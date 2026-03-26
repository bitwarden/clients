import { Utils } from "@bitwarden/common/platform/misc/utils";
import { Guid } from "@bitwarden/common/types/guid";

import { ReceiveView } from "./receive.view";

export interface ReceiveUrlData {
  receiveId: Guid;
  secretB64: string;
  sharedContentEncryptionKeyB64: string;
}

/**
 * Constructs the shareable URL for a Receive.
 *
 * The URL fragment contains the receive ID, base64 encoded secret, and base64 encoded shared content encryption key
 *
 * @param view The decrypted ReceiveView
 * @param baseUrl The base URL including the fragment prefix, e.g. "https://vault.bitwarden.com/#/receive"
 * @returns The full shareable URL string
 */
export function buildReceiveUrl(view: ReceiveView, baseUrl: string): string {
  const secretB64 = Utils.fromUtf8ToUrlB64(view.secret);
  const scekB64 = Utils.fromArrayToUrlB64(view.sharedContentEncryptionKey.toEncoded());
  return `${baseUrl}/${view.id}/${secretB64}/${scekB64}`;
}

export function parseReceiveUrl(url: string): ReceiveUrlData {
  const parsed = new URL(url);
  // Hash format: "#/receive/{id}/{secretB64}/{scekB64}"
  const parts = parsed.hash.slice(1).split("/");
  const receiveId = parts[parts.length - 3] as Guid;
  const secretB64 = parts[parts.length - 2];
  const sharedContentEncryptionKeyB64 = parts[parts.length - 1];

  return { receiveId, secretB64, sharedContentEncryptionKeyB64 };
}
