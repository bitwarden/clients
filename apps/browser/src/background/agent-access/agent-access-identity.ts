import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { SecureNoteType } from "@bitwarden/common/vault/enums/secure-note-type.enum";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";
import * as sdkInternal from "@bitwarden/sdk-internal";

/**
 * Well-known cipher name for the agent-access identity keypair.
 * Stored as a SecureNote in the vault, synced to all clients sharing the account.
 */
const IDENTITY_CIPHER_NAME = "__AgentAccess:IdentityKey";

/**
 * Manages the agent-access identity keypair as vault-synced, shared-per-account data.
 *
 * De-Angular version: takes constructor params instead of inject().
 */
export class AgentAccessIdentity {
  /** Cached identity bytes — immutable once created, safe to cache for service lifetime. */
  private cachedIdentity: Uint8Array | null = null;

  constructor(private cipherService: CipherService) {}

  /**
   * Get the account's agent-access identity COSE bytes.
   * Generates and stores a new identity if this is the first use.
   */
  async getIdentity(userId: UserId): Promise<Uint8Array> {
    if (this.cachedIdentity) {
      return this.cachedIdentity;
    }

    // Try to find existing identity cipher
    const existing = await this.findIdentityCipher(userId);
    if (existing?.notes) {
      this.cachedIdentity = Utils.fromB64ToArray(existing.notes);
      return this.cachedIdentity;
    }

    // Generate new identity via WASM
    const generateFn = (sdkInternal as any).generate_agent_identity;
    const identityBytes: Uint8Array = new Uint8Array(generateFn());

    // Store as SecureNote cipher in the vault
    await this.createIdentityCipher(userId, identityBytes);

    this.cachedIdentity = identityBytes;
    return identityBytes;
  }

  private async findIdentityCipher(userId: UserId): Promise<CipherView | undefined> {
    const allCiphers = await this.cipherService.getAllDecrypted(userId);
    return allCiphers.find(
      (c) => c.type === CipherType.SecureNote && c.name === IDENTITY_CIPHER_NAME,
    );
  }

  private async createIdentityCipher(userId: UserId, identityBytes: Uint8Array): Promise<void> {
    const cipher = new CipherView();
    cipher.name = IDENTITY_CIPHER_NAME;
    cipher.type = CipherType.SecureNote;
    cipher.favorite = false;
    cipher.fields = [];

    cipher.secureNote = new SecureNoteView();
    cipher.secureNote.type = SecureNoteType.Generic;
    cipher.notes = Utils.fromBufferToB64(identityBytes);

    await this.cipherService.createWithServer(cipher, userId);
  }
}
