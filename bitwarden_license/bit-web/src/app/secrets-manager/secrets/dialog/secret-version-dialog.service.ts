import { inject, Injectable } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";

import { SecretView } from "../../models/view/secret.view";
import { SecretService } from "../secret.service";

import {
  SecretVersionDialogComponent,
  SecretVersionDialogParams,
} from "./secret-version.component";

/** Opens the secret version history drawer on behalf of the secret list views. */
@Injectable({
  providedIn: "root",
})
export class SecretVersionDialogService {
  private readonly dialogService = inject(DialogService);
  private readonly secretService = inject(SecretService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly toastService = inject(ToastService);

  /**
   * Loads the secret and opens its version history in a drawer.
   * Shows an error toast and opens nothing when the secret cannot be loaded.
   */
  async openVersionHistory(organizationId: OrganizationId, secretId: string): Promise<void> {
    let secret: SecretView;

    try {
      secret = await this.secretService.getBySecretId(secretId);
    } catch (e) {
      this.logService.error("Retrieving secret failed", e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
      return;
    }

    await this.dialogService.openDrawer<void, SecretVersionDialogParams>(
      SecretVersionDialogComponent,
      {
        data: {
          organizationId: organizationId,
          secretId: secretId,
          name: secret.name,
          currentValue: secret.value,
          revisionDate: secret.revisionDate,
          canWrite: secret.write,
        },
      },
    );
  }
}
