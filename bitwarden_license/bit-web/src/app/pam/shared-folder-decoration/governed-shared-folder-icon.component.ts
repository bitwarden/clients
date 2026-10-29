import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { IconModule, TooltipDirective } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Binds `SHARED_FOLDER_DECORATION`: the lock beside a shared folder an access rule governs, read
 * off the collection's server-derived `hasEnabledAccessRule`. Renders nothing for any other folder,
 * or while PAM's flag is off.
 */
@Component({
  selector: "app-pam-governed-shared-folder-icon",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconModule, TooltipDirective, I18nPipe],
  host: { class: "tw-contents" },
  template: `
    @if (governed()) {
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

  private readonly pamEnabled = toSignal(inject(ConfigService).getFeatureFlag$(FeatureFlag.Pam), {
    initialValue: false,
  });

  protected readonly governed = computed(
    () => this.pamEnabled() && this.collection().hasEnabledAccessRule === true,
  );
}
