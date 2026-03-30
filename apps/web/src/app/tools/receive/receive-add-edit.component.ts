import { ChangeDetectionStrategy, Component } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ButtonModule, DialogModule, FormFieldModule, SelectModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  templateUrl: "./receive-add-edit.component.html",
  imports: [
    ReactiveFormsModule,
    DialogModule,
    FormFieldModule,
    SelectModule,
    ButtonModule,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiveAddEditComponent {
  protected readonly expirationDayOptions: { label: string; value: number }[];

  protected readonly form = this.formBuilder.group({
    name: ["", Validators.required],
    expirationDays: [7, Validators.required],
  });

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly i18nService: I18nService,
  ) {
    this.expirationDayOptions = [
      { label: this.i18nService.t("oneHour"), value: 1 / 24 },
      { label: this.i18nService.t("oneDay"), value: 1 },
      { label: this.i18nService.t("days", "2"), value: 2 },
      { label: this.i18nService.t("days", "3"), value: 3 },
      { label: this.i18nService.t("days", "7"), value: 7 },
      { label: this.i18nService.t("days", "14"), value: 14 },
      { label: this.i18nService.t("days", "30"), value: 30 },
    ];
  }
}
