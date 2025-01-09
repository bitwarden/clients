import { inject, Injectable } from "@angular/core";
import { map, Observable } from "rxjs";

import {
  GlobalStateProvider,
  KeyDefinition,
  VAULT_APPEARANCE,
} from "@bitwarden/common/platform/state";

export type CopyButtonDisplayMode = "combined" | "quick";

const COPY_BUTTON = new KeyDefinition<CopyButtonDisplayMode>(VAULT_APPEARANCE, "copyButtons", {
  deserializer: (s) => s,
});

/**
 * Settings service for vault copy button settings
 **/
@Injectable({ providedIn: "root" })
export class VaultPopupCopyButtonsService {
  private readonly DEFAULT_DISPLAY_MODE = "combined";
  private state = inject(GlobalStateProvider).get(COPY_BUTTON);

  displayMode$: Observable<CopyButtonDisplayMode> = this.state.state$.pipe(
    map((state) => state ?? this.DEFAULT_DISPLAY_MODE),
  );

  async setDisplayMode(displayMode: CopyButtonDisplayMode) {
    await this.state.update(() => displayMode);
  }

  showQuickCopyActions$: Observable<boolean> = this.displayMode$.pipe(
    map((displayMode) => displayMode === "quick"),
  );

  async setShowQuickCopyActions(value: boolean) {
    await this.setDisplayMode(value ? "quick" : "combined");
  }
}
