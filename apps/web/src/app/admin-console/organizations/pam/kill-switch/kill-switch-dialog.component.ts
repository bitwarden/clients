import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, Inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";

import {
  ButtonModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export interface KillSwitchDialogParams {
  organizationName: string;
}

export const KillSwitchDialogResult = Object.freeze({
  Confirmed: "confirmed",
  Canceled: "canceled",
} as const);
export type KillSwitchDialogResult =
  (typeof KillSwitchDialogResult)[keyof typeof KillSwitchDialogResult];

@Component({
  selector: "app-pam-kill-switch-dialog",
  templateUrl: "./kill-switch-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    FormFieldModule,
    TypographyModule,
    I18nPipe,
  ],
})
export class KillSwitchDialogComponent {
  private readonly dialogRef = inject(DialogRef<KillSwitchDialogResult>);

  readonly organizationName: string;

  protected readonly confirmControl = new FormControl("", { nonNullable: true });

  private readonly typedValue = toSignal(this.confirmControl.valueChanges, { initialValue: "" });

  protected readonly confirmMatches = computed(() => this.typedValue() === this.organizationName);

  constructor(@Inject(DIALOG_DATA) readonly params: KillSwitchDialogParams) {
    this.organizationName = params.organizationName;
  }

  protected cancel(): void {
    void this.dialogRef.close(KillSwitchDialogResult.Canceled);
  }

  protected confirm(): void {
    if (!this.confirmMatches()) {
      return;
    }
    void this.dialogRef.close(KillSwitchDialogResult.Confirmed);
  }

  static open(
    dialogService: DialogService,
    config: DialogConfig<KillSwitchDialogParams>,
  ): DialogRef<KillSwitchDialogResult> {
    return dialogService.open<KillSwitchDialogResult, KillSwitchDialogParams>(
      KillSwitchDialogComponent,
      config,
    );
  }
}
