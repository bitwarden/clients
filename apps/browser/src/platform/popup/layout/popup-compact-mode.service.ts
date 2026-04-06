import { inject, Injectable } from "@angular/core";
import { map, Observable } from "rxjs";

import { GlobalStateProvider } from "@bitwarden/common/platform/state";
import { COMPACT_MODE } from "@bitwarden/common/platform/theming/compact-mode.state";
import { CompactModeService } from "@bitwarden/components";

/**
 * Service to persist Compact Mode to state / user settings.
 **/
@Injectable({ providedIn: "root" })
export class PopupCompactModeService implements CompactModeService {
  private state = inject(GlobalStateProvider).get(COMPACT_MODE);

  enabled$: Observable<boolean> = this.state.state$.pipe(map((state) => state ?? false));

  init() {
    this.enabled$.subscribe((enabled) => {
      enabled
        ? document.body.classList.add("tw-bit-compact")
        : document.body.classList.remove("tw-bit-compact");
    });
  }

  async setEnabled(enabled: boolean) {
    await this.state.update(() => enabled);
  }
}
