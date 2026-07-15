import { computed, inject, Injectable, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

/** Collection icon shown when the VFO1 terminology flag is off. */
const LEGACY_COLLECTION_ICON = "bwi-collection-shared";
/** Collection ("shared folder") icon shown when the VFO1 terminology flag is on. */
const SHARED_FOLDER_ICON = "bwi-shared-folder";

@Injectable({ providedIn: "root" })
export class Vfo1TerminologyService {
  private configService = inject(ConfigService);
  readonly enabled: Signal<boolean> = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  /**
   * The icon class to use for collections. Switches to the "shared folder" icon when the
   * terminology flag is on. Text terms are handled separately by the `vfo1I18n` pipe.
   */
  readonly collectionIconClass: Signal<string> = computed(() =>
    this.enabled() ? SHARED_FOLDER_ICON : LEGACY_COLLECTION_ICON,
  );
}
