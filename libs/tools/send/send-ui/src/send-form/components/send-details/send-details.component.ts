// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule, DatePipe } from "@angular/common";
import { Component, OnInit, Input } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import {
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  CheckboxModule,
  SelectModule,
} from "@bitwarden/components";

import { SendFormConfig } from "../../abstractions/send-form-config.service";
import { SendFormContainer } from "../../send-form-container";
import { SendOptionsComponent } from "../options/send-options.component";

import { SendFileDetailsComponent } from "./send-file-details.component";
import { SendTextDetailsComponent } from "./send-text-details.component";

/** A preset duration (in hours) for deletion. */
export const DatePreset = Object.freeze({
  /** One-hour duration. */
  OneHour: 1,
  /** One-day duration (24 hours). */
  OneDay: 24,
  /** Two-day duration (48 hours). */
  TwoDays: 48,
  /** Three-day duration (72 hours). */
  ThreeDays: 72,
  /** Seven-day duration (168 hours). */
  SevenDays: 168,
  /** Fourteen-day duration (336 hours). */
  FourteenDays: 336,
  /** Thirty-day duration (720 hours). */
  ThirtyDays: 720,
} as const);

/** A preset duration (in hours) for deletion. */
export type DatePreset = (typeof DatePreset)[keyof typeof DatePreset];

export interface DatePresetSelectOption {
  name: string;
  value: DatePreset | string;
}

const namesByDatePreset = new Map<DatePreset, keyof typeof DatePreset>(
  Object.entries(DatePreset).map(([k, v]) => [v as DatePreset, k as keyof typeof DatePreset]),
);

/**
 * Runtime type guard to verify a value is a valid DatePreset.
 */
export function isDatePreset(value: unknown): value is DatePreset {
  return namesByDatePreset.has(value as DatePreset);
}

/**
 * Safe converter to DatePreset (numeric preset), returns undefined for invalid inputs.
 */
export function asDatePreset(value: unknown): DatePreset | undefined {
  return isDatePreset(value) ? (value as DatePreset) : undefined;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-send-details",
  templateUrl: "./send-details.component.html",
  imports: [
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
    JslibModule,
    CardComponent,
    FormFieldModule,
    ReactiveFormsModule,
    SendTextDetailsComponent,
    SendFileDetailsComponent,
    SendOptionsComponent,
    IconButtonModule,
    CheckboxModule,
    CommonModule,
    SelectModule,
  ],
})
export class SendDetailsComponent implements OnInit {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() config: SendFormConfig;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() originalSendView?: SendView;

  FileSendType = SendType.File;
  TextSendType = SendType.Text;
  sendLink: string | null = null;
  customDeletionDateOption: DatePresetSelectOption | null = null;
  datePresetOptions: DatePresetSelectOption[] = [];

  sendDetailsForm = this.formBuilder.group({
    name: new FormControl("", Validators.required),
    selectedDeletionDatePreset: new FormControl(DatePreset.SevenDays || "", Validators.required),
  });

  constructor(
    protected sendFormContainer: SendFormContainer,
    protected formBuilder: FormBuilder,
    protected i18nService: I18nService,
    protected datePipe: DatePipe,
    protected environmentService: EnvironmentService,
  ) {
    this.sendDetailsForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.sendFormContainer.patchSend((send) => {
        return Object.assign(send, {
          name: value.name,
          deletionDate: new Date(this.formattedDeletionDate),
          expirationDate: new Date(this.formattedDeletionDate),
        } as SendView);
      });
    });

    this.sendFormContainer.registerChildForm("sendDetailsForm", this.sendDetailsForm);
  }

  async ngOnInit() {
    this.setupDeletionDatePresets();

    if (this.originalSendView) {
      this.sendDetailsForm.patchValue({
        name: this.originalSendView.name,
        selectedDeletionDatePreset: this.originalSendView.deletionDate.toString(),
      });

      if (this.originalSendView.deletionDate) {
        this.customDeletionDateOption = {
          name: this.datePipe.transform(this.originalSendView.deletionDate, "short"),
          value: this.originalSendView.deletionDate.toString(),
        };
        this.datePresetOptions.unshift(this.customDeletionDateOption);
      }

      const env = await firstValueFrom(this.environmentService.environment$);
      this.sendLink =
        env.getSendUrl() + this.originalSendView.accessId + "/" + this.originalSendView.urlB64Key;
    }

    if (!this.config.areSendsAllowed) {
      this.sendDetailsForm.disable();
    }
  }

  setupDeletionDatePresets() {
    const defaultSelections: DatePresetSelectOption[] = [
      { name: this.i18nService.t("oneHour"), value: DatePreset.OneHour },
      { name: this.i18nService.t("oneDay"), value: DatePreset.OneDay },
      { name: this.i18nService.t("days", "2"), value: DatePreset.TwoDays },
      { name: this.i18nService.t("days", "3"), value: DatePreset.ThreeDays },
      { name: this.i18nService.t("days", "7"), value: DatePreset.SevenDays },
      { name: this.i18nService.t("days", "14"), value: DatePreset.FourteenDays },
      { name: this.i18nService.t("days", "30"), value: DatePreset.ThirtyDays },
    ];

    this.datePresetOptions = defaultSelections;
  }

  get formattedDeletionDate(): string {
    const now = new Date();
    const selectedValue = this.sendDetailsForm.controls.selectedDeletionDatePreset.value;

    // The form allows for custom date strings, if such is used, return it without worrying about DatePreset validation
    if (typeof selectedValue === "string") {
      return selectedValue;
    }

    // Otherwise, treat it as a preset and validate at runtime
    const preset = asDatePreset(selectedValue);
    if (!isDatePreset(preset)) {
      return new Date(now).toString();
    }

    const milliseconds = now.setTime(now.getTime() + preset * 60 * 60 * 1000);
    return new Date(milliseconds).toString();
  }
}
