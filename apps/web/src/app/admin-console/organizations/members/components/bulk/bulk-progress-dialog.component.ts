import { DialogRef } from "@angular/cdk/dialog";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  Inject,
  Signal,
} from "@angular/core";

import {
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogService,
  ProgressBarComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export interface BulkProgressDialogParams {
  progress: Signal<number>;
  allCount: number;
}

@Component({
  templateUrl: "bulk-progress-dialog.component.html",
  selector: "member-bulk-progress-dialog",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule, I18nPipe, ProgressBarComponent],
})
export class BulkProgressDialogComponent {
  protected readonly allCount: string;
  protected readonly progressCount: Signal<string>;
  protected readonly progressPercentage: Signal<number>;
  private readonly progressEffect = effect(() => {
    if (this.progressPercentage() >= 100) {
      void this.dialogRef.close();
    }
  });

  constructor(
    readonly dialogRef: DialogRef,
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
