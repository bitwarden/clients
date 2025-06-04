// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, Validators, ReactiveFormsModule, FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendFileView } from "@bitwarden/common/tools/send/models/view/send-file.view";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import {
  ButtonModule,
  FormFieldModule,
  SectionComponent,
  TypographyModule,
} from "@bitwarden/components";

import { SendFormConfig } from "../../abstractions/send-form-config.service";
import { SendFormContainer } from "../../send-form-container";

@Component({
  selector: "tools-send-file-details",
  templateUrl: "./send-file-details.component.html",
  imports: [
    ButtonModule,
    CommonModule,
    JslibModule,
    ReactiveFormsModule,
    FormFieldModule,
    SectionComponent,
    FormsModule,
    TypographyModule,
  ],
})
export class SendFileDetailsComponent implements OnInit {
  @Input() config: SendFormConfig;
  @Input() originalSendView?: SendView;

  sendFileDetailsForm = this.formBuilder.group({
    file: this.formBuilder.control<SendFileView | null>(null, Validators.required),
  });

  FileSendType = SendType.File;
  fileName = "";

  constructor(
    private formBuilder: FormBuilder,
    protected sendFormContainer: SendFormContainer,
  ) {
    this.sendFormContainer.registerChildForm("sendFileDetailsForm", this.sendFileDetailsForm);

    this.sendFileDetailsForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.sendFormContainer.patchSend((send) => {
        return Object.assign(send, {
          file: value.file,
        });
      });
    });
  }

  onFileSelected = (event: Event): void => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    this.fileName = file.name;
    this.sendFormContainer.onFileSelected(file);
  };

  ngOnInit() {
    if (this.originalSendView) {
      this.sendFileDetailsForm.patchValue({
        file: this.originalSendView.file,
      });
    }

    if (!this.config.areSendsAllowed) {
      this.sendFileDetailsForm.disable();
    }
  }
}
