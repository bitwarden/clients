import { inject, Injectable } from "@angular/core";
import { map, Observable } from "rxjs";

import {
  CollectionTypes,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  SharedFolderFieldDecoration,
  SharedFolderOptionDecoration,
  SharedFolderOptionDecorator,
  Vfo1TerminologyService,
} from "@bitwarden/vault";

import { ControlledAccessSharedFolderHintComponent } from "./controlled-access-shared-folder-hint.component";
import { controlledSharedFolder } from "./controlled-shared-folder";

/**
 * Binds `SHARED_FOLDER_FIELD_DECORATION`: marks each shared folder under controlled access in the
 * cipher form's Shared folders field with a lock, on its option (lock tile) and on its selected chip
 * (lock icon), and names those folders in a hint under the field. Every folder keeps its plain name;
 * the hint is where the status is said in words, and is announced to screen readers as the
 * selection changes. Every other folder gets the plain shared folder tile so the two read apart.
 *
 * The lock itself carries no text name: the stock `bit-multi-select` passes neither a tile label
 * nor a chip `accessibleName` through `SelectItemView`, so naming the option and chip waits on a
 * component library change.
 *
 * Leaves the field untouched while PAM's flag is off, or for an organization without PAM, whose
 * folders can never be controlled. The vault renders the hint only while this decorates the field,
 * so this is the one place that gating is decided.
 */
@Injectable()
export class ControlledAccessSharedFolderField implements SharedFolderFieldDecoration {
  readonly hint = ControlledAccessSharedFolderHintComponent;

  private readonly configService = inject(ConfigService);
  private readonly vfo1TerminologyService = inject(Vfo1TerminologyService);

  decorator$(organization: Organization): Observable<SharedFolderOptionDecorator | null> {
    return this.configService
      .getFeatureFlag$(FeatureFlag.Pam)
      .pipe(map((enabled) => (enabled && organization.usePam ? this.decorate : null)));
  }

  private readonly decorate = (collection: CollectionView): SharedFolderOptionDecoration => {
    if (controlledSharedFolder(collection)) {
      return {
        icon: "bwi-lock-encrypted",
        iconTile: { icon: "bwi-lock-encrypted", variant: "brand" },
      };
    }
    const icon =
      collection.type === CollectionTypes.DefaultUserCollection
        ? "bwi-user"
        : this.vfo1TerminologyService.iconClass("bwi-collection-shared");
    return { icon, iconTile: { icon, variant: "gray" } };
  };
}
