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
  protected allCount: string;
  protected readonly progressCount: Signal<string>;
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
    this.progressCount = computed(() => data.progress().toLocaleString());
    this.allCount = data.allCount.toLocaleString();
    this.progressPercentage = computed(() => (data.progress() / data.allCount) * 100);
  }

  static open(dialogService: DialogService, config: DialogConfig<BulkProgressDialogParams>) {
    return dialogService.open(BulkProgressDialogComponent, config);
  }
}
