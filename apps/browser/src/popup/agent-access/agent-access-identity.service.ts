import { inject, Injectable } from "@angular/core";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { SecureNoteType } from "@bitwarden/common/vault/enums/secure-note-type.enum";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

/**
 * Well-known cipher name for the agent-access identity keypair.
 * Stored as a SecureNote in the vault, synced to all clients sharing the account.
 */
const IDENTITY_CIPHER_NAME = "__AgentAccess:IdentityKey";

/**
 * Manages the agent-access identity keypair as vault-synced, shared-per-account data.
 *
 * The identity is stored as a SecureNote cipher so it syncs automatically
 * to all clients sharing the Bitwarden account. Any client with the account
 * unlocked can serve agent-access requests using the same identity.
 */
@Injectable()
export class AgentAccessIdentityService {
  private cipherService = inject(CipherService);
  private accountService = inject(AccountService);

  /**
   * Get the account's agent-access identity COSE bytes.
   * Generates and stores a new identity if this is the first use.
   */
  async getIdentity(userId: UserId): Promise<Uint8Array> {
    // Try to find existing identity cipher
    const existing = await this.findIdentityCipher(userId);
    if (existing?.notes) {
      return this.base64ToBytes(existing.notes);
    }

    // Generate new identity via WASM
    const sdk = await import("@bitwarden/sdk-internal");
    const generateFn = (sdk as any).generate_agent_identity;
    const identityBytes: Uint8Array = new Uint8Array(generateFn());

    // Store as SecureNote cipher in the vault
    await this.createIdentityCipher(userId, identityBytes);

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
    cipher.notes = this.bytesToBase64(identityBytes);

    await this.cipherService.createWithServer(cipher, userId);
  }

  private base64ToBytes(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }
}
