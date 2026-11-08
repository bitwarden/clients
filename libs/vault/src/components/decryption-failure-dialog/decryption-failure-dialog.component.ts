import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { ClientType } from "@bitwarden/common/enums";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherId } from "@bitwarden/common/types/guid";
import {
  DIALOG_DATA,
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  CopyClickDirective,
  DialogModule,
  DialogService,
  CenterPositionStrategy,
  IconButtonModule,
  IconModule,
  isAtOrLargerThanBreakpointSignal,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export type DecryptionFailureDialogParams = {
  cipherIds: CipherId[];
};

// Increments for each instance of this component, used to associate the item id list with its label
let nextId = 0;

@Component({
  selector: "vault-decryption-failure-dialog",
  templateUrl: "./decryption-failure-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    DialogModule,
    I18nPipe,
    NgTemplateOutlet,
    ButtonModule,
    CopyClickDirective,
    IconButtonModule,
    IconModule,
  ],
})
export class DecryptionFailureDialogComponent {
  protected readonly dialogRef = inject(DialogRef);
  protected readonly params = inject<DecryptionFailureDialogParams>(DIALOG_DATA);
  private readonly environmentService = inject(EnvironmentService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly router = inject(Router);

  protected readonly labelId = `decryption-failure-item-ids-${nextId++}`;

  /**
   * Narrow viewports get the centered `bit-simple-dialog` treatment; wider ones get a standard
   * `bit-dialog`.
   */
  protected readonly isWideViewport = isAtOrLargerThanBreakpointSignal("md");

  private get isSingleItem() {
    return this.params.cipherIds.length === 1;
  }

  protected get descriptionKey() {
    return this.isSingleItem
      ? "couldNotDecryptVaultItemUseDataRecovery"
      : "couldNotDecryptVaultItemsUseDataRecovery";
  }

  protected get labelKey() {
    return this.isSingleItem ? "itemId" : "itemIds";
  }

  protected get copyButtonKey() {
    return this.isSingleItem ? "copyId" : "copyAllIds";
  }

  protected get valueToCopy() {
    return this.params.cipherIds.join("\n");
  }

  /**
   * Opens the web app's Data Recovery page. Web routes in place, since a new tab wouldn't share the
   * current session; browser and desktop don't have the page, so they hand off to the web vault.
   */
  protected readonly openDataRecovery = async () => {
    if (this.platformUtilsService.getClientType() === ClientType.Web) {
      await this.dialogRef.close(false);
      await this.router.navigate(["/settings/data-recovery"]);
      return;
    }

    const env = await firstValueFrom(this.environmentService.environment$);
    this.platformUtilsService.launchUri(`${env.getWebVaultUrl()}/#/settings/data-recovery`);
    await this.dialogRef.close(false);
  };

  static open(dialogService: DialogService, params: DecryptionFailureDialogParams) {
    return dialogService.open(DecryptionFailureDialogComponent, {
      data: params,
      positionStrategy: new CenterPositionStrategy(),
    });
  }
}
