// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SimpleDialogOptions, SimpleDialogType, Translation } from "../..";
import { BitSubmitDirective } from "../../../async-actions/bit-submit.directive";
import { BitFormButtonDirective } from "../../../async-actions/form-button.directive";
import { ButtonComponent } from "../../../button/button.component";
import { SimpleDialogComponent, IconDirective } from "../simple-dialog.component";

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
  templateUrl: "./simple-configurable-dialog.component.html",
  standalone: true,
  imports: [
    ReactiveFormsModule,
    BitSubmitDirective,
    SimpleDialogComponent,
    IconDirective,
    ButtonComponent,
    BitFormButtonDirective,
  ],
})
export class SimpleConfigurableDialogComponent {
  get iconClasses() {
    return [
      this.simpleDialogOpts.icon ?? DEFAULT_ICON[this.simpleDialogOpts.type],
      DEFAULT_COLOR[this.simpleDialogOpts.type],
    ];
  }

  protected title: string;
  protected content: string;
  protected acceptButtonText: string;
  protected cancelButtonText: string;
  protected formGroup = new FormGroup({});

  protected showCancelButton = this.simpleDialogOpts.cancelButtonText !== null;

  constructor(
    public dialogRef: DialogRef,
    private i18nService: I18nService,
    @Inject(DIALOG_DATA) public simpleDialogOpts?: SimpleDialogOptions,
  ) {
    this.localizeText();
  }

  protected accept = async () => {
    if (this.simpleDialogOpts.acceptAction) {
      await this.simpleDialogOpts.acceptAction();
    }

    this.dialogRef.close(true);
  };

  private localizeText() {
    this.title = this.translate(this.simpleDialogOpts.title);
    this.content = this.translate(this.simpleDialogOpts.content);
    this.acceptButtonText = this.translate(this.simpleDialogOpts.acceptButtonText, "yes");

    if (this.showCancelButton) {
      // If accept text is overridden, use cancel, otherwise no
      this.cancelButtonText = this.translate(
        this.simpleDialogOpts.cancelButtonText,
        this.simpleDialogOpts.acceptButtonText !== undefined ? "cancel" : "no",
      );
    }
  }

  private translate(translation: string | Translation, defaultKey?: string): string {
    // Translation interface use implies we must localize.
    if (typeof translation === "object") {
      return this.i18nService.t(translation.key, ...(translation.placeholders ?? []));
    }

    // Use string that is already translated or use default key post translate
    return translation ?? this.i18nService.t(defaultKey);
  }
}
