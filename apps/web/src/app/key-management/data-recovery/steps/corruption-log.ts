import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";

import { LogRecorder } from "../log-recorder";

/**
 * Records diagnostic details about a corrupt cipher: its id and whether it carries a per-item
 * vault item key (cipher key). No decrypted data is logged.
 */
export function logCipherCorruption(cipher: Cipher, logger: LogRecorder, note?: string): void {
  const cipherKeyPresent = cipher.key != null;
  const revisionDate = cipher.revisionDate ? cipher.revisionDate.toISOString() : "unknown";
  const creationDate = cipher.creationDate ? cipher.creationDate.toISOString() : "unknown";
  logger.record(
    `Corrupt cipher ${cipher.id}${note ? ` (${note})` : ""}: cipherKeyPresent=${cipherKeyPresent}, revisionDate=${revisionDate}, creationDate=${creationDate}`,
  );
}
