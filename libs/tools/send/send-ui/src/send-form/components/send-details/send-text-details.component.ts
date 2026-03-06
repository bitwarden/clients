import { CommonModule } from "@angular/common";
import { Component, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, FormControl, Validators, ReactiveFormsModule } from "@angular/forms";

import { CheckboxModule, FormFieldModule, SectionComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { SendFormService } from "../../abstractions/send-form.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-send-text-details",
  templateUrl: "./send-text-details.component.html",
  imports: [
    CheckboxModule,
    CommonModule,
    I18nPipe,
    ReactiveFormsModule,
    FormFieldModule,
    SectionComponent,
  ],
})
export class SendTextDetailsComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  private sendFormService = inject(SendFormService);

  sendTextDetailsForm = this.formBuilder.group({
    text: new FormControl("", Validators.required),
    hidden: new FormControl(false),
  });

  constructor() {
    this.sendFormService.registerChildForm("sendTextDetailsForm", this.sendTextDetailsForm);

    this.sendTextDetailsForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.sendFormService.patchSend((send) => {
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
      text: this.sendFormService.originalSendView?.text?.text || "",
      hidden: this.sendFormService.originalSendView?.text?.hidden || false,
    });

    if (!this.sendFormService.sendFormConfig?.areSendsAllowed) {
      this.sendTextDetailsForm.disable();
    }
  }
}
