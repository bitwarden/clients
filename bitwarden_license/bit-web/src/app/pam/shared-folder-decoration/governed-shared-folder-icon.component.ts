import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { IconModule, TooltipDirective } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Binds `SHARED_FOLDER_DECORATION`: the lock beside a shared folder an access rule governs, read
 * off the collection's server-derived `hasEnabledAccessRule`. Renders nothing for any other folder.
 */
@Component({
  selector: "app-pam-governed-shared-folder-icon",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconModule, TooltipDirective, I18nPipe],
  host: { class: "tw-contents" },
  template: `
    @if (collection().hasEnabledAccessRule) {
      <bit-icon
        class="tw-shrink-0"
        name="bwi-lock-encrypted"
        [ariaLabel]="'pamSharedFolderPrivilegedControls' | i18n"
        [bitTooltip]="'pamSharedFolderPrivilegedControls' | i18n"
      />
    }
  `,
})
export class GovernedSharedFolderIconComponent {
  readonly collection = input.required<CollectionView>();
}
