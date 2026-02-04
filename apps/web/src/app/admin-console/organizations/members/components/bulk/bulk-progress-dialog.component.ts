import { DialogConfig, DialogRef } from "@angular/cdk/dialog";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  Inject,
  Signal,
} from "@angular/core";

import { DIALOG_DATA, DialogService } from "@bitwarden/components";

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
  private readonly progressEffect = effect(() => {
    if (this.progressPercentage() >= 100) {
      this.dialogRef.close();
    }
  });

  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) data: BulkProgressDialogParams,
  ) {
    this.progressCount = data.progress;
    this.allCount = data.allCount;
    this.progressPercentage = computed(() => (this.progressCount() / this.allCount) * 100);
  }

  static open(dialogService: DialogService, config: DialogConfig<BulkProgressDialogParams>) {
    return dialogService.open(BulkProgressDialogComponent, config);
  }
}
