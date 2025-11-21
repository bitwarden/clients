import { CommonModule } from "@angular/common";
import { Component, effect, inject, input, signal, ChangeDetectionStrategy } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { CenterPositionStrategy, DialogService } from "@bitwarden/components";
import { SendFormConfig } from "@bitwarden/send-ui";

import { FilePopoutUtilsService } from "../../services/file-popout-utils.service";

import { SendFilePopoutDialogComponent } from "./send-file-popout-dialog.component";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "send-file-popout-dialog-container",
  templateUrl: "./send-file-popout-dialog-container.component.html",
  imports: [JslibModule, CommonModule],
})
export class SendFilePopoutDialogContainerComponent {
  private readonly dialogService = inject(DialogService);
  private readonly filePopoutUtilsService = inject(FilePopoutUtilsService);

  readonly config = input.required<SendFormConfig>();

  /**
   * Tracks if the dialog has already been opened. This prevents multiple dialogs from opening if config is updated.
   */
  private readonly dialogOpened = signal(false);

  constructor() {
    effect(() => {
      if (this.dialogOpened()) {
        return;
      }

      if (
        this.config().sendType === SendType.File &&
        this.config().mode === "add" &&
        this.filePopoutUtilsService.showFilePopoutMessage(window)
      ) {
        this.dialogService.open(SendFilePopoutDialogComponent, {
          positionStrategy: new CenterPositionStrategy(),
        });
        this.dialogOpened.set(true);
      }
    });
  }
}
