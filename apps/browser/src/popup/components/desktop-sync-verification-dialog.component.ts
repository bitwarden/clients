import { Component, DestroyRef, inject, Inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { filter } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { MessageListener } from "@bitwarden/common/platform/messaging";
import {
  DIALOG_DATA,
  DialogRef,
  ButtonModule,
  DialogModule,
  DialogService,
  CenterPositionStrategy,
} from "@bitwarden/components";

export type DesktopSyncVerificationDialogParams = {
  fingerprint: string[];
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "desktop-sync-verification-dialog.component.html",
  imports: [JslibModule, ButtonModule, DialogModule],
})
export class DesktopSyncVerificationDialogComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    @Inject(DIALOG_DATA) protected params: DesktopSyncVerificationDialogParams,
    private dialogRef: DialogRef<DesktopSyncVerificationDialogComponent>,
    private messageListener: MessageListener,
  ) {}

  ngOnInit(): void {
    this.messageListener.allMessages$
      .pipe(
        filter((m) => m.command === "hideNativeMessagingFingerprintDialog"),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.dialogRef.close();
      });
  }

  static open(dialogService: DialogService, data: DesktopSyncVerificationDialogParams) {
    return dialogService.open(DesktopSyncVerificationDialogComponent, {
      data,
      positionStrategy: new CenterPositionStrategy(),
    });
  }
}
