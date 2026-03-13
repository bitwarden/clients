import { CommonModule } from "@angular/common";
import { Component, effect, input } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, FormControl, Validators, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { CheckboxModule, FormFieldModule, SectionComponent } from "@bitwarden/components";

import { SendFormConfig } from "../../abstractions/send-form-config.service";
import { SendFormContainer } from "../../send-form-container";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
export class SendTextDetailsComponent {
  readonly config = input.required<SendFormConfig>();
  readonly originalSendView = input<SendView>();
  readonly editing = input<boolean>(false);

  sendTextDetailsForm = this.formBuilder.group({
    text: new FormControl(this.originalSendView()?.text?.text || "", Validators.required),
    hidden: new FormControl(this.originalSendView()?.text?.hidden || false),
  });

  constructor(
    private formBuilder: FormBuilder,
    protected sendFormContainer: SendFormContainer,
  ) {
    this.sendFormContainer.registerChildForm("sendTextDetailsForm", this.sendTextDetailsForm);

    effect(() => {
      if (this.editing()) {
        this.sendTextDetailsForm.enable();
      } else {
        this.sendTextDetailsForm.disable();
        if (this.originalSendView()) {
          this.sendTextDetailsForm.patchValue({
            text: this.originalSendView()?.text?.text || "",
            hidden: this.originalSendView()?.text?.hidden || false,
          });
        }
      }
    });

    effect(() => {
      if (!this.config().areSendsAllowed) {
        this.sendTextDetailsForm.disable();
      }
    });

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
}
