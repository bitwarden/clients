import { DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SimpleDialogOptions, SimpleDialogType, Translation } from "../..";
import { BitSubmitDirective } from "../../../async-actions/bit-submit.directive";
import { BitFormButtonDirective } from "../../../async-actions/form-button.directive";
import { ButtonComponent } from "../../../button/button.component";
import {
  SimpleDialogComponent,
  IconDirective,
  DialogFooterDirective,
} from "../simple-dialog.component";

const DEFAULT_ICON: Record<SimpleDialogType, string> = {
  primary: "bwi-business",
  success: "bwi-star",
  info: "bwi-info-circle",
  warning: "bwi-exclamation-triangle",
  danger: "bwi-error",
};

const DEFAULT_COLOR: Record<SimpleDialogType, string> = {
  primary: "tw-text-primary-600",
  success: "tw-text-success",
  info: "tw-text-info",
  warning: "tw-text-warning",
  danger: "tw-text-danger",
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./simple-configurable-dialog.component.html",
  imports: [
    ReactiveFormsModule,
    BitSubmitDirective,
    SimpleDialogComponent,
    IconDirective,
    DialogFooterDirective,
    ButtonComponent,
    BitFormButtonDirective,
  ],
})
export class SimpleConfigurableDialogComponent {
  readonly dialogRef = inject(DialogRef);
  private readonly i18nService = inject(I18nService);
  readonly simpleDialogOpts = inject<SimpleDialogOptions>(DIALOG_DATA);

  protected readonly iconClasses = [
    this.simpleDialogOpts.icon ?? DEFAULT_ICON[this.simpleDialogOpts.type],
    DEFAULT_COLOR[this.simpleDialogOpts.type],
  ];

  protected readonly formGroup = new FormGroup({});

  protected readonly showCancelButton = this.simpleDialogOpts.cancelButtonText !== null;

  protected readonly title = this.translate(this.simpleDialogOpts.title);
  protected readonly content = this.translate(this.simpleDialogOpts.content);
  protected readonly acceptButtonText = this.translate(
    this.simpleDialogOpts.acceptButtonText ?? { key: "yes" },
  );
  // If accept text is overridden, use cancel, otherwise no
  protected readonly cancelButtonText = this.showCancelButton
    ? this.translate(
        this.simpleDialogOpts.cancelButtonText ??
          (this.simpleDialogOpts.acceptButtonText !== undefined
            ? { key: "cancel" }
            : { key: "no" }),
      )
    : undefined;

  protected readonly accept = async () => {
    if (this.simpleDialogOpts.acceptAction) {
      await this.simpleDialogOpts.acceptAction();
    }

    if (!this.simpleDialogOpts.disableClose) {
      this.dialogRef.close(true);
    }
  };

  private translate(translation: string | Translation): string {
    // Object implies we must localize.
    if (typeof translation === "object") {
      return this.i18nService.t(translation.key, ...(translation.placeholders ?? []));
    }

    return translation;
  }
}
