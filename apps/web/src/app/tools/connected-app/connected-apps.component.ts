import { Component } from "@angular/core";
import { Observable } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ConnectedAppView } from "@bitwarden/common/tools/connected-app/models/view/connected-app.view";
import { ConnectedAppApiService } from "@bitwarden/common/tools/connected-app/services/connected-app-api.service.abstraction";
import { InternalConnectedAppService } from "@bitwarden/common/tools/connected-app/services/connected-app.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";

import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

/**
 * Settings page listing the user's "Login with Bitwarden" agent connections with a revoke action.
 * Revoking deletes the connection server-side (which pushes to the user's other clients) and from
 * local state; the bot's short-lived token then expires on its own (no refresh).
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  imports: [SharedModule, HeaderModule],
  templateUrl: "connected-apps.component.html",
})
export class ConnectedAppsComponent {
  protected connections$: Observable<ConnectedAppView[]> =
    this.connectedAppService.connectedAppViews$;

  constructor(
    private connectedAppService: InternalConnectedAppService,
    private connectedAppApiService: ConnectedAppApiService,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {}

  async revoke(connection: ConnectedAppView): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "loginWithBitwardenRevokeTitle" },
      content: { key: "loginWithBitwardenRevokeConfirm", placeholders: [connection.name] },
      type: "warning",
      acceptButtonText: { key: "revoke" },
    });
    if (!confirmed) {
      return;
    }

    await this.connectedAppApiService.delete(connection.id);
    await this.connectedAppService.delete(connection.id);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("loginWithBitwardenRevoked"),
    });
  }
}
