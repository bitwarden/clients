import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { OrganizationId } from "@bitwarden/common/types/guid";
import { BannerComponent, ButtonModule } from "@bitwarden/components";

import { VaultOrganizationUserNotificationsService } from "../../services/vault-organization-user-notifications.service";

@Component({
  selector: "vault-organization-user-notifications",
  templateUrl: "./vault-organization-user-notifications.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BannerComponent, ButtonModule],
  providers: [VaultOrganizationUserNotificationsService],
})
export class VaultOrganizationUserNotificationsComponent {
  private readonly vaultOrganizationUserNotificationsService = inject(
    VaultOrganizationUserNotificationsService,
  );

  protected readonly notificationData = toSignal(
    this.vaultOrganizationUserNotificationsService.notificationData$,
  );

  protected readonly showBanner = toSignal(
    this.vaultOrganizationUserNotificationsService.showNotificationBanner$,
    { initialValue: false },
  );

  protected async close() {
    await this.vaultOrganizationUserNotificationsService.saveDismissalToState();
  }

  protected async actionButtonClick(organizationId: OrganizationId) {
    await this.vaultOrganizationUserNotificationsService.recordActionButtonClick(organizationId);
  }
}
