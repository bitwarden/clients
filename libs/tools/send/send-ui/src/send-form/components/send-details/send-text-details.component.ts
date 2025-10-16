import { CommonModule } from "@angular/common";
import { Component, input, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, FormControl, Validators, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { CheckboxModule, FormFieldModule, SectionComponent } from "@bitwarden/components";

import { SendFormConfig } from "../../abstractions/send-form-config.service";
import { SendFormContainer } from "../../send-form-container";

@Component({
  selector: "tools-send-text-details",
  templateUrl: "./send-text-details.component.html",
  imports: [
    CheckboxModule,
    CommonModule,
    JslibModule,
    ReactiveFormsModule,
    FormFieldModule,
    SectionComponent,
  ],
})
export class SendTextDetailsComponent implements OnInit {
  config = input.required<SendFormConfig>();
  originalSendView = input<SendView>();

  sendTextDetailsForm = this.formBuilder.group({
    text: new FormControl("", Validators.required),
    hidden: new FormControl(false),
  });

  constructor(
    private formBuilder: FormBuilder,
    protected sendFormContainer: SendFormContainer,
  ) {
    this.sendFormContainer.registerChildForm("sendTextDetailsForm", this.sendTextDetailsForm);

    this.sendTextDetailsForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.sendFormContainer.patchSend((send) => {
        return Object.assign(send, {
          text: {
            text: value.text,
            hidden: value.hidden,
          },
        });
      });
    });
  }

  async ngOnInit(): Promise<void> {
    this.sendTextDetailsForm.patchValue({
      text: this.originalSendView()?.text?.text || "",
      hidden: this.originalSendView()?.text?.hidden || false,
    });

    if (!this.config().areSendsAllowed) {
      this.sendTextDetailsForm.disable();
    }
  }
}
