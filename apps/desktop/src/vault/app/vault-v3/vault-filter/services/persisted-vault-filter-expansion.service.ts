import { Injectable, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { VaultFilterServiceAbstraction as VaultFilterService } from "@bitwarden/vault";

/**
 * Tracks and persists the expand/collapse state of every collapsible vault-filter nav group on
 * Desktop (organizations, collections, folders, cipher types, and any other section with a
 * stable node id), so it survives an app restart. Centralized here so each filter component only
 * needs to supply its own node id, rather than duplicating the read/write glue.
 */
@Injectable({ providedIn: "root" })
export class PersistedVaultFilterExpansionService {
  private vaultFilterService = inject(VaultFilterService);
  private accountService = inject(AccountService);
  private logService = inject(LogService);

  private readonly collapsedNodes = toSignal(
    this.vaultFilterService.persistedCollapsedVaultFilterNodes$,
    { initialValue: new Set<string>() },
  );

  /**
   * Absence from the persisted set means expanded, so nodes default to expanded — including a
   * node with no id, since collapse state can't be tracked (or restored) for one. Intended to be
   * called from within a caller's own `computed()`, so reads of the underlying signal are
   * tracked on the caller's reactive graph.
   */
  isOpen(nodeId: string | undefined): boolean {
    return !nodeId || !this.collapsedNodes().has(nodeId);
  }

  async setOpen(nodeId: string | undefined, open: boolean): Promise<void> {
    if (!nodeId) {
      return;
    }

    try {
      const userId = await firstValueFrom(getOptionalUserId(this.accountService.activeAccount$));
      if (!userId) {
        return;
      }

      // Delegates to an atomic state update (read-modify-write against the state provider's
      // own current value at write time) rather than reading a snapshot here and writing it
      // back, which would race with a concurrent toggle of a different node.
      await this.vaultFilterService.setPersistedVaultFilterNodeOpen(nodeId, open, userId);
    } catch (error) {
      this.logService.error("Failed to persist vault filter collapse state", error);
    }
  }
}
