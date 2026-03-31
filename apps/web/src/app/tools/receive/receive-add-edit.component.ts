import { ChangeDetectionStrategy, Component, Inject, Optional, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  FormFieldModule,
  IconButtonModule,
  SelectModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ReceiveView } from "./receive-view";

@Component({
  templateUrl: "./receive-add-edit.component.html",
  imports: [
    ReactiveFormsModule,
    DialogModule,
    FormFieldModule,
    SelectModule,
    ButtonModule,
    IconButtonModule,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiveAddEditComponent {
  protected readonly expirationDayOptions: { label: string; value: number }[];
  protected readonly isEditMode: boolean;
  protected readonly receiveLink = signal("https://receive.bitwarden.com/receive/dummy-link-id");

  protected readonly form = this.formBuilder.group({
    name: ["", Validators.required],
    expirationDays: [7, Validators.required],
  });

  constructor(
    @Optional() @Inject(DIALOG_DATA) private readonly receive: ReceiveView | null,
    private readonly formBuilder: FormBuilder,
    private readonly i18nService: I18nService,
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly toastService: ToastService,
  ) {
    this.isEditMode = receive != null;

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

  protected copyLink(): void {
    this.platformUtilsService.copyToClipboard(this.receiveLink());
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("valueCopied", this.i18nService.t("sendLink")),
    });
  }
}
