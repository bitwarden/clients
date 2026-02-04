import { DialogConfig, DialogRef } from "@angular/cdk/dialog";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  Inject,
  Signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { timer } from "rxjs";

import { DIALOG_DATA, DialogService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";

export interface BulkProgressDialogParams {
  progress: Signal<number>;
  allCount: number;
}

@Component({
  templateUrl: "bulk-progress-dialog.component.html",
  selector: "member-bulk-progress-dialog",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class BulkProgressDialogComponent {
  protected allCount: number;
  protected readonly progressCount: Signal<number>;
  protected readonly progressPercentage: Signal<number>;

  constructor(
    public dialogRef: DialogRef,
    private logService: LogService,
    @Inject(DIALOG_DATA) data: BulkProgressDialogParams,
  ) {
    this.progressCount = data.progress;
    this.allCount = data.allCount;
    this.progressPercentage = computed(() => (this.progressCount() / this.allCount) * 100);

    effect(() => {
      if (this.progressPercentage() >= 100) {
        this.dialogRef.close();
      }
    });

    timer(180000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.logService.error(
          "An unexpected timeout occurred while processing a batched bulk action",
        );
        this.dialogRef.close();
      });
  }

  static open(dialogService: DialogService, config: DialogConfig<BulkProgressDialogParams>) {
    return dialogService.open(BulkProgressDialogComponent, config);
  }
}
