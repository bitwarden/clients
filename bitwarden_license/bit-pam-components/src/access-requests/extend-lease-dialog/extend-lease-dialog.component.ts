import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { AccessLeaseExtensionRequest, extensionDurationOptions } from "@bitwarden/bit-pam";
import {
  AsyncActionsModule,
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  SelectModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DurationLongPipe } from "../../date/duration-long.pipe";

export type ExtendLeaseDialogParams = {
  /** The governing rule's maximum extension length, in seconds. */
  maxDurationSeconds: number;
};

/** Collects a lease extension. The reason is required because the server rejects an empty one. */
@Component({
  selector: "pam-extend-lease-dialog",
  templateUrl: "./extend-lease-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    DialogModule,
    FormFieldModule,
    ReactiveFormsModule,
    SelectModule,
    I18nPipe,
    DurationLongPipe,
  ],
})
export class ExtendLeaseDialogComponent {
  private readonly dialogRef =
    inject<DialogRef<AccessLeaseExtensionRequest | undefined>>(DialogRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly params = inject<ExtendLeaseDialogParams>(DIALOG_DATA);

  protected readonly durationOptions = extensionDurationOptions(this.params.maxDurationSeconds);

  protected readonly formGroup = this.formBuilder.nonNullable.group({
    durationSeconds: [this.durationOptions[0].seconds, Validators.required],
    reason: ["", Validators.required],
  });

  protected readonly submit = async (): Promise<void> => {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }
    const { durationSeconds, reason } = this.formGroup.getRawValue();
    void this.dialogRef.close({ durationSeconds, reason });
  };

  static open(
    dialogService: DialogService,
    data: ExtendLeaseDialogParams,
  ): DialogRef<AccessLeaseExtensionRequest | undefined> {
    return dialogService.open(ExtendLeaseDialogComponent, { data });
  }
}
