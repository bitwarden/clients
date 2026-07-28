import { inject, Injectable } from "@angular/core";

import { PasskeyDirectoryApiService } from "@bitwarden/common/dirt/services/abstractions/passkey-directory-api.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

export interface PasskeyServiceEntry {
  instructions: string | undefined;
  supportsPasskeyLogin: boolean;
  supportsPasskeyMfa: boolean;
}

export interface PasskeyCipherRow {
  cipher: CipherView;
  instructions: string | undefined;
  supportsPasskeyLogin: boolean;
  supportsPasskeyMfa: boolean;
}

export type PasskeyReportAction = "deleted" | "saved";

@Injectable()
export class PasskeyReportService {
  private readonly passkeyDirectoryApiService = inject(PasskeyDirectoryApiService);

  /**
   * Fetches the passkey directory from the API and returns a map of domain names to service entries.
   */
  async loadPasskeyDirectory(userId: UserId): Promise<Map<string, PasskeyServiceEntry>> {
    return (await this.passkeyDirectoryApiService.getPasskeyDirectory(userId))
      .filter((x) => x.domainName != null)
      .reduce(
        (map, entry) => map.set(entry.domainName, entry),
        new Map<string, PasskeyServiceEntry>(),
      );
  }

  /**
   * Processes a list of ciphers against the passkey directory,
   * returning rows for ciphers that match a known passkey service.
   */
  processCiphers(
    ciphers: CipherView[],
    passkeyServices: Map<string, PasskeyServiceEntry>,
  ): PasskeyCipherRow[] {
    const rows: PasskeyCipherRow[] = [];

    for (const cipher of ciphers) {
      const match = this.getPasskeyServiceMatch(cipher, passkeyServices);
      if (match != null) {
        rows.push(this.buildPasskeyCipherRow(cipher, match));
      }
    }

    return rows;
  }

  /**
   * Matches a cipher against the passkey directory to find a supporting service.
   * Returns the matching entry if the cipher is a login with URIs that match
   * a known passkey service and does not already have FIDO2 credentials configured.
   */
  getPasskeyServiceMatch(
    cipher: CipherView,
    passkeyServices: Map<string, PasskeyServiceEntry>,
  ): PasskeyServiceEntry | null {
    const { type, login, isDeleted, viewPassword } = cipher;

    if (
      type !== CipherType.Login ||
      !login.hasUris ||
      login.hasFido2Credentials ||
      isDeleted ||
      !viewPassword
    ) {
      return null;
    }

    for (const u of login.uris) {
      if (!u.uri) {
        continue;
      }
      const uri = u.uri.replace("www.", "");
      const key = [Utils.getHost(uri), Utils.getDomain(uri)].find(
        (k) => k != null && passkeyServices.has(k),
      );

      if (key != null) {
        return passkeyServices.get(key) ?? null;
      }
    }
    return null;
  }

  /**
   * Evaluates a single cipher against the passkey directory.
   * Returns a row if the cipher matches, or null if it does not.
   */
  evaluateCipher(
    cipher: CipherView,
    passkeyServices: Map<string, PasskeyServiceEntry>,
  ): PasskeyCipherRow | null {
    const match = this.getPasskeyServiceMatch(cipher, passkeyServices);
    if (match != null) {
      return this.buildPasskeyCipherRow(cipher, match);
    }
    return null;
  }

  /**
   * Applies a dialog action to the current set of rows.
   *
   * - "deleted": removes the original cipher from the list.
   * - "saved": re-evaluates the updated cipher; replaces, removes, or keeps accordingly.
   *
   * Returns a new array (never mutates the input).
   */
  applyDialogResult(
    currentRows: PasskeyCipherRow[],
    action: PasskeyReportAction,
    originalCipher: CipherView,
    passkeyServices: Map<string, PasskeyServiceEntry>,
    updatedCipherView?: CipherView,
  ): PasskeyCipherRow[] {
    if (action === "deleted") {
      return currentRows.filter((r) => r.cipher.id !== originalCipher.id);
    }

    if (action === "saved" && updatedCipherView) {
      const updatedRow = this.evaluateCipher(updatedCipherView, passkeyServices);
      const index = currentRows.findIndex((r) => r.cipher.id === updatedCipherView.id);

      const rows = [...currentRows];

      if (updatedRow != null && index > -1) {
        rows[index] = updatedRow;
      } else if (updatedRow == null && index > -1) {
        rows.splice(index, 1);
      }

      return rows;
    }

    return [...currentRows];
  }

  /**
   * Builds a PasskeyCipherRow from a cipher and its matching passkey service entry.
   */
  buildPasskeyCipherRow(cipher: CipherView, match: PasskeyServiceEntry): PasskeyCipherRow {
    return {
      cipher,
      instructions: match.instructions || undefined,
      supportsPasskeyLogin: match.supportsPasskeyLogin,
      supportsPasskeyMfa: match.supportsPasskeyMfa,
    };
  }
}
