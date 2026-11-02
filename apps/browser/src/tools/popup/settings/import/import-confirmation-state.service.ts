import { inject, Injectable, signal } from "@angular/core";

import { ImportedFile } from "@bitwarden/importer-core";
import { ImportSummary } from "@bitwarden/importer-ui";
import { GlobalStateProvider, IMPORT_CONFIRMATION_MEMORY, KeyDefinition } from "@bitwarden/state";

export const IMPORT_CONFIRMATION_ROUTE_PATH = "import-confirmation";

/** Counts and file name only: nothing decrypted outlives the import screens. */
export interface ImportConfirmationState {
  summary: ImportSummary;
  importedFile?: ImportedFile;
}

const PENDING_CONFIRMATION = new KeyDefinition<ImportConfirmationState>(
  IMPORT_CONFIRMATION_MEMORY,
  "pending",
  { deserializer: (state) => state },
);

/** Carries a finished import from the import shell to the confirmation page, which sits outside
 *  the shell, and from the import tab to the popup, which shows the result. */
@Injectable({ providedIn: "root" })
export class ImportConfirmationStateService {
  private readonly state = signal<ImportConfirmationState | undefined>(undefined);
  private readonly pending = inject(GlobalStateProvider).get(PENDING_CONFIRMATION);

  /** What this tab has to show. Lost with the tab. */
  readonly current = this.state.asReadonly();

  /** What the popup has yet to show. Survives the tab, not the browser session. */
  readonly pending$ = this.pending.state$;

  async set(state: ImportConfirmationState): Promise<void> {
    this.state.set(state);
    await this.pending.update(() => state);
  }

  /** Drops what this tab shows. */
  clear(): void {
    this.state.set(undefined);
  }

  async clearPending(): Promise<void> {
    await this.pending.update(() => null);
  }
}
