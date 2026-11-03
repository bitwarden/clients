import { inject, Injectable, signal } from "@angular/core";
import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { ImportedFile } from "@bitwarden/importer-core";
import { ImportSummary } from "@bitwarden/importer-ui";
import { IMPORT_CONFIRMATION_MEMORY, StateProvider, UserKeyDefinition } from "@bitwarden/state";

import { resetPopupRouteHistory } from "../../../../platform/popup/view-cache/popup-router-cache.service";

export const IMPORT_CONFIRMATION_ROUTE_PATH = "import-confirmation";

/** Counts and file name only: nothing decrypted outlives the import screens. */
export interface ImportConfirmationState {
  summary: ImportSummary;
  importedFile?: ImportedFile;
}

// The file name can identify a person, so a result is only ever shown to the user who imported.
export const PENDING_CONFIRMATION = new UserKeyDefinition<ImportConfirmationState>(
  IMPORT_CONFIRMATION_MEMORY,
  "pending",
  { deserializer: (state) => state, clearOn: ["lock", "logout"] },
);

/** Carries a finished import from the import shell to the confirmation page, which sits outside
 *  the shell, and from the import tab to the popup, which shows the result. */
@Injectable({ providedIn: "root" })
export class ImportConfirmationStateService {
  private readonly state = signal<ImportConfirmationState | undefined>(undefined);
  private readonly stateProvider = inject(StateProvider);

  /** What this tab has to show. Lost with the tab. */
  readonly current = this.state.asReadonly();

  /** What the popup has yet to show that user. It waits, even through an account switch, until the
   *  popup shows it or they lock or log out. */
  pending$(userId: UserId): Observable<ImportConfirmationState | null> {
    return this.stateProvider.getUser(userId, PENDING_CONFIRMATION).state$;
  }

  /** `userId` is who imported, not whoever is active when the popup opens. */
  async set(state: ImportConfirmationState, userId: UserId): Promise<void> {
    this.state.set(state);
    await this.stateProvider.getUser(userId, PENDING_CONFIRMATION).update(() => state);
  }

  /** Drops what this tab shows. */
  clear(): void {
    this.state.set(undefined);
  }

  async clearPending(userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, PENDING_CONFIRMATION).update(() => null);
  }

  // The popup reopens on its last page for 2 minutes after closing, which can skip the Vault page
  // that shows the result.
  async resetPopupHistory(): Promise<void> {
    await resetPopupRouteHistory(this.stateProvider);
  }
}
