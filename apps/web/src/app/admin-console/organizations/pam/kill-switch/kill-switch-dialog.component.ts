import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, Inject, signal } from "@angular/core";

import {
  ButtonModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
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
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ButtonModule,
    DialogModule,
    TypographyModule,
    I18nPipe,
  ],
})
export class KillSwitchDialogComponent {
  private readonly dialogRef = inject(DialogRef<KillSwitchDialogResult>);

  readonly organizationName: string;

  protected readonly typedValue = signal("");

  constructor(@Inject(DIALOG_DATA) readonly params: KillSwitchDialogParams) {
    this.organizationName = params.organizationName;
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.typedValue.set(value);
  }

  protected confirmMatches(): boolean {
    return this.typedValue() === this.organizationName;
  }

  protected cancel(): void {
    this.dialogRef.close(KillSwitchDialogResult.Canceled);
  }

  protected confirm(): void {
    if (!this.confirmMatches()) {
      return;
    }
    this.dialogRef.close(KillSwitchDialogResult.Confirmed);
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
