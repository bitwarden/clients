import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import {
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  SelectModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessLeaseExtensionRequest, EXTENSION_DURATION_OPTIONS } from "../..";

/**
 * Small confirm-style dialog for extending an active lease: a duration picker seeded from
 * {@link EXTENSION_DURATION_OPTIONS} and a required justification (the server rejects an
 * {@link AccessLeaseExtensionRequest} with an empty `reason`). Resolves with the request to
 * submit, or `undefined` when cancelled.
 */
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
  ],
})
export class ExtendLeaseDialogComponent {
  private readonly dialogRef =
    inject<DialogRef<AccessLeaseExtensionRequest | undefined>>(DialogRef);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly durationOptions = EXTENSION_DURATION_OPTIONS;

  protected readonly formGroup = this.formBuilder.group({
    durationSeconds: [EXTENSION_DURATION_OPTIONS[0].seconds, Validators.required],
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

  static open(dialogService: DialogService): DialogRef<AccessLeaseExtensionRequest | undefined> {
    return dialogService.open(ExtendLeaseDialogComponent);
  }
}
