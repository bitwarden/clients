import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { InputVerbatimDirective } from "@bitwarden/angular/directives/input-verbatim.directive";
import {
  DialogRef,
  AsyncActionsModule,
  AutofocusDirective,
  ButtonModule,
  DialogModule,
  FormFieldModule,
  IconButtonModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Collects a required master password and an optional key file (the `passwordWithKeyFile` credential
 * kind, e.g. KeePass KDBX). Closes with `{ password, keyFile }`, or `undefined` when dismissed.
 */
@Component({
  templateUrl: "credentials-with-key-file-prompt.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DialogModule,
    FormFieldModule,
    AsyncActionsModule,
    ButtonModule,
    IconButtonModule,
    AutofocusDirective,
    InputVerbatimDirective,
    I18nPipe,
  ],
})
export class CredentialsWithKeyFilePromptComponent {
  private readonly dialogRef = inject(DialogRef);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly keyFileName = signal<string | null>(null);
  private readonly keyFile = signal<Uint8Array | null>(null);

  protected readonly formGroup = this.formBuilder.nonNullable.group({
    password: ["", Validators.required],
  });

  protected readonly setKeyFile = async (event: Event): Promise<void> => {
    const input = event.target as HTMLInputElement;
    const file = input.files != null && input.files.length > 0 ? input.files[0] : null;
    if (file == null) {
      this.keyFile.set(null);
      this.keyFileName.set(null);
      return;
    }
    this.keyFile.set(new Uint8Array(await file.arrayBuffer()));
    this.keyFileName.set(file.name);
  };

  protected readonly submit = () => {
    this.formGroup.markAllAsTouched();
    if (!this.formGroup.valid) {
      return;
    }

    const credentials: { password: string; keyFile: Uint8Array | null } = {
      password: this.formGroup.getRawValue().password,
      keyFile: this.keyFile(),
    };
    void this.dialogRef.close(credentials);
  };
}
