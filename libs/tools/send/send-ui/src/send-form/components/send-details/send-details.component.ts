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

// Value = hours
export enum DatePreset {
  OneHour = 1,
  OneDay = 24,
  TwoDays = 48,
  ThreeDays = 72,
  SevenDays = 168,
  FourteenDays = 336,
  ThirtyDays = 720,
}

export interface DatePresetSelectOption {
  name: string;
  value: DatePreset | string;
}

@Component({
  selector: "tools-send-details",
  templateUrl: "./send-details.component.html",
  standalone: true,
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
  @Input() config: SendFormConfig;
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

    if (typeof selectedValue === "string") {
      return selectedValue;
    }

    const milliseconds = now.setTime(now.getTime() + (selectedValue as number) * 60 * 60 * 1000);
    return new Date(milliseconds).toString();
  }
}
