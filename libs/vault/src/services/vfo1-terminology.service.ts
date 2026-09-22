import { inject, Injectable, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { BitwardenIcon } from "@bitwarden/components";

/**
 * Legacy icon class → VFO1 replacement, applied when the terminology flag is on.
 * Icon classes not present here are returned unchanged.
 */
const VFO1_ICON_MAP: Readonly<Partial<Record<BitwardenIcon, BitwardenIcon>>> = Object.freeze({
  "bwi-collection-shared": "bwi-shared-folder",
  "bwi-collection": "bwi-shared-folder",
});

@Injectable({ providedIn: "root" })
export class Vfo1TerminologyService {
  private configService = inject(ConfigService);
  readonly enabled: Signal<boolean> = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  /**
   * Returns the VFO1 replacement for `iconClass` when the terminology flag is on, otherwise
   * `iconClass` unchanged. Icon classes without a mapping are passed through as-is.
   * Text terms are handled separately by the `vfo1I18n` pipe.
   */
  iconClass(iconClass: BitwardenIcon): BitwardenIcon {
    return this.enabled() ? (VFO1_ICON_MAP[iconClass] ?? iconClass) : iconClass;
  }

  /**
   * Builds the `collectionId`/`sharedFolderId` query params for navigating to `collectionId`,
   * writing the terminology-appropriate key and nulling out the other so that a
   * `queryParamsHandling: "merge"` navigation removes any stale param from the URL.
   */
  collectionQueryParams(collectionId: string | null | undefined): {
    collectionId: string | null;
    sharedFolderId: string | null;
  } {
    return this.enabled()
      ? { sharedFolderId: collectionId ?? null, collectionId: null }
      : { collectionId: collectionId ?? null, sharedFolderId: null };
  }
}
