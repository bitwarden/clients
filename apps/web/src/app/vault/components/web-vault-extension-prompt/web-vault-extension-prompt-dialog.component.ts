import { CommonModule } from "@angular/common";
import { Component, ChangeDetectionStrategy, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { getWebStoreUrl } from "@bitwarden/common/vault/utils/get-web-store-url";
import {
  ButtonModule,
  DialogModule,
  DialogRef,
  DialogService,
  IconComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { WebVaultExtensionPromptService } from "../../services/web-vault-extension-prompt.service";

@Component({
  selector: "web-vault-extension-prompt-dialog",
  templateUrl: "./web-vault-extension-prompt-dialog.component.html",
  imports: [CommonModule, ButtonModule, DialogModule, I18nPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebVaultExtensionPromptDialogComponent implements OnInit {
  constructor(
    private platformUtilsService: PlatformUtilsService,
    private accountService: AccountService,
    private dialogRef: DialogRef<void>,
    private webVaultExtensionPromptService: WebVaultExtensionPromptService,
  ) {}

  /** Download Url for the extension based on the browser */
  protected webStoreUrl: string = "";

  ngOnInit(): void {
    this.webStoreUrl = getWebStoreUrl(this.platformUtilsService.getDevice());
  }

  async dismissPrompt() {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.webVaultExtensionPromptService.getDialogDismissedState(userId).update(() => true);
    this.dialogRef.close();
  }

  /** Opens the web extension prompt generator dialog. */
  static open(dialogService: DialogService) {
    return dialogService.open(WebVaultExtensionPromptDialogComponent);
  }
}
