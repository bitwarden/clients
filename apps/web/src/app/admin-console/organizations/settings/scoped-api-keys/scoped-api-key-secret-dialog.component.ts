import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { DIALOG_DATA, DialogConfig, DialogService } from "@bitwarden/components";

import { SharedModule } from "../../../../shared";

export type ScopedApiKeySecretDialogData = {
  name: string;
  clientId: string;
  clientSecret: string;
  scope: string;
};

@Component({
  templateUrl: "scoped-api-key-secret-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SharedModule],
})
export class ScopedApiKeySecretDialogComponent {
  protected readonly data = inject<ScopedApiKeySecretDialogData>(DIALOG_DATA);
  protected readonly grantType = "client_credentials";

  static open(dialogService: DialogService, config: DialogConfig<ScopedApiKeySecretDialogData>) {
    return dialogService.open<unknown, ScopedApiKeySecretDialogData>(
      ScopedApiKeySecretDialogComponent,
      { ...config, disableClose: true },
    );
  }
}
