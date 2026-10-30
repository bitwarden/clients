import { Injectable, signal } from "@angular/core";

import { ImportSummary } from "@bitwarden/importer-ui";

export const IMPORT_CONFIRMATION_ROUTE_PATH = "import-confirmation";

/** Counts and file name only: nothing decrypted outlives the import screens. */
export interface ImportConfirmationState {
  summary: ImportSummary;
  fileName?: string;
}

/** Carries a finished import from the import shell to the confirmation page, which sits outside
 *  the shell. */
@Injectable({ providedIn: "root" })
export class ImportConfirmationStateService {
  private readonly state = signal<ImportConfirmationState | undefined>(undefined);

  readonly current = this.state.asReadonly();

  set(state: ImportConfirmationState): void {
    this.state.set(state);
  }

  clear(): void {
    this.state.set(undefined);
  }
}
