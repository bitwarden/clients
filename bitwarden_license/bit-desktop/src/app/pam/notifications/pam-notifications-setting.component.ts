import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { combineLatest, distinctUntilChanged, map, of, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CheckboxModule, FormFieldModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { PamNotificationStateService } from "./pam-notification-state.service";

/**
 * The "PAM notifications" row in the desktop settings dialog, shown only where PAM and VFO1 are on and the
 * user belongs to an organization that uses it. Its control stands alone, outside the dialog's
 * form, and saves on change.
 */
@Component({
  selector: "app-pam-notifications-setting",
  imports: [CheckboxModule, FormFieldModule, FormsModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <bit-form-control>
        <input
          type="checkbox"
          bitCheckbox
          [ngModel]="enabled()"
          [ngModelOptions]="{ standalone: true }"
          (ngModelChange)="setEnabled($event)"
          data-testid="pam-notifications-checkbox"
        />
        <bit-label>{{ "pamNotificationsSetting" | i18n }}</bit-label>
        <bit-hint>{{ "pamNotificationsSettingDesc" | i18n }}</bit-hint>
      </bit-form-control>
    }
  `,
})
export class PamNotificationsSettingComponent {
  private readonly stateService = inject(PamNotificationStateService);
  private readonly configService = inject(ConfigService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);

  protected readonly enabled = toSignal(this.stateService.enabled$, { initialValue: true });

  protected readonly visible = toSignal(
    combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.Pam),
      this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
      this.accountService.activeAccount$.pipe(
        getOptionalUserId,
        switchMap((userId) =>
          userId == null ? of([]) : this.organizationService.organizations$(userId),
        ),
        map((organizations) => organizations.some((organization) => organization.usePam)),
      ),
    ]).pipe(
      map(([pam, vfo1, inPamOrg]) => pam && vfo1 && inPamOrg),
      distinctUntilChanged(),
    ),
    { initialValue: false },
  );

  protected async setEnabled(enabled: boolean): Promise<void> {
    await this.stateService.setEnabled(enabled);
  }
}
