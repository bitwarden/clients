import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { DialogRef, DialogService } from "@bitwarden/components";

import { KeeperDirectImportUIService } from "../keeper-direct-import-ui.service";

import { KeeperAuthStageViewComponent } from "./keeper-auth-stage-view.component";

@Component({
  templateUrl: "keeper-auth-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KeeperAuthStageViewComponent],
})
export class KeeperAuthDialogComponent {
  private readonly keeperUi = inject(KeeperDirectImportUIService);

  protected readonly stage = this.keeperUi.stage;
  protected readonly email = this.keeperUi.email;

  protected onSubmitted(value: unknown): void {
    this.keeperUi.submit(value);
  }

  protected onCancelled(): void {
    this.keeperUi.cancel();
  }

  protected onTriedAnother(): void {
    this.keeperUi.tryAnother();
  }

  protected onResent(): void {
    this.keeperUi.resend();
  }

  protected onErrorDismissed(): void {
    this.keeperUi.dismissError();
  }

  static open(dialogService: DialogService): DialogRef {
    return dialogService.open(KeeperAuthDialogComponent, {
      disableClose: true,
    });
  }
}
