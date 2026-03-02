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
  IconModule,
  LinkModule,
  TypographyModule,
  CenterPositionStrategy,
} from "@bitwarden/components";

export interface LeaveConfirmationDialogParams {
  organizationName: string;
}

export const LeaveConfirmationDialogResult = Object.freeze({
  /**
   * User confirmed they want to leave the organization.
   */
  Confirmed: "confirmed",
  /**
   * User chose to go back instead of leaving the organization.
   */
  Back: "back",
} as const);

export type LeaveConfirmationDialogResultType = UnionOfValues<typeof LeaveConfirmationDialogResult>;

@Component({
  templateUrl: "./leave-confirmation-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, DialogModule, IconModule, LinkModule, TypographyModule, JslibModule],
})
export class LeaveConfirmationDialogComponent {
  private readonly params = inject<LeaveConfirmationDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<LeaveConfirmationDialogResultType>);
  private readonly platformUtilsService = inject(PlatformUtilsService);

  protected readonly organizationName = this.params.organizationName;

  protected confirmLeave() {
    this.dialogRef.close(LeaveConfirmationDialogResult.Confirmed);
  }

  protected goBack() {
    this.dialogRef.close(LeaveConfirmationDialogResult.Back);
  }

  protected openLearnMore(e: Event) {
    e.preventDefault();
    this.platformUtilsService.launchUri("https://bitwarden.com/help/transfer-ownership/");
  }

  static open(dialogService: DialogService, config: DialogConfig<LeaveConfirmationDialogParams>) {
    return dialogService.open<LeaveConfirmationDialogResultType>(LeaveConfirmationDialogComponent, {
      positionStrategy: new CenterPositionStrategy(),
      disableClose: true,
      ...config,
    });
  }
}
