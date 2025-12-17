import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ButtonModule,
  DialogModule,
  LinkModule,
  TypographyModule,
  CenterPositionStrategy,
} from "@bitwarden/components";

export interface TransferItemsDialogParams {
  organizationName: string;
}

export const TransferItemsDialogResult = Object.freeze({
  /**
   * User accepted the transfer of items.
   */
  Accepted: "accepted",
  /**
   * User declined the transfer of items.
   */
  Declined: "declined",
} as const);

export type TransferItemsDialogResultType = UnionOfValues<typeof TransferItemsDialogResult>;

@Component({
  templateUrl: "./transfer-items-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, DialogModule, LinkModule, TypographyModule, JslibModule],
})
export class TransferItemsDialogComponent {
  private readonly params = inject<TransferItemsDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<TransferItemsDialogResultType>);
  private readonly platformUtilsService = inject(PlatformUtilsService);

  protected readonly organizationName = this.params.organizationName;

  protected acceptTransfer() {
    this.dialogRef.close(TransferItemsDialogResult.Accepted);
  }

  protected decline() {
    this.dialogRef.close(TransferItemsDialogResult.Declined);
  }

  protected openLearnMore(e: Event) {
    e.preventDefault();
    this.platformUtilsService.launchUri("https://bitwarden.com/help/transfer-ownership/");
  }

  static open(dialogService: DialogService, config: DialogConfig<TransferItemsDialogParams>) {
    return dialogService.open<TransferItemsDialogResultType>(TransferItemsDialogComponent, {
      positionStrategy: new CenterPositionStrategy(),
      disableClose: true,
      ...config,
    });
  }
}
