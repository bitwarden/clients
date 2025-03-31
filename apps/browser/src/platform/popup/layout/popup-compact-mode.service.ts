import { inject, Injectable } from "@angular/core";
import { map, Observable } from "rxjs";

import { GlobalStateProvider, KeyDefinition, THEMING_DISK } from "@bitwarden/common/platform/state";
import { CompactModeService } from "@bitwarden/components";

const COMPACT_MODE = new KeyDefinition<boolean>(THEMING_DISK, "compactMode", {
  deserializer: (s) => s,
});

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
