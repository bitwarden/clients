import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, FormControl, Validators, ReactiveFormsModule } from "@angular/forms";

import { CheckboxModule, FormFieldModule, SectionComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { SendFormService } from "../../abstractions/send-form.service";

@Component({
  selector: "tools-send-text-details",
  templateUrl: "./send-text-details.component.html",
  imports: [CheckboxModule, I18nPipe, ReactiveFormsModule, FormFieldModule, SectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendTextDetailsComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly sendFormService = inject(SendFormService);
  readonly editing = input<boolean>(false);

  readonly sendTextDetailsForm = this.formBuilder.group({
    text: new FormControl("", Validators.required),
    hidden: new FormControl(false),
  });

  readonly formDisabled = computed(
    () => !this.editing() || !this.sendFormService.sendFormConfig?.areSendsAllowed,
  );
  readonly showHiddenCheckbox = computed(
    () => this.editing() || this.sendFormService.sendFormConfig?.originalSend?.text?.hidden,
  );

  constructor() {
    this.sendFormService.registerChildForm("sendTextDetailsForm", this.sendTextDetailsForm);

    effect(() => {
      // We don't emit events here to avoid triggering the subscription on 62 unnecessarily
      if (this.formDisabled()) {
        this.sendTextDetailsForm.controls.hidden.disable({ emitEvent: false });
      } else {
        this.sendTextDetailsForm.controls.hidden.enable({ emitEvent: false });
      }
    });

    effect(() => {
      if (!this.editing()) {
        this.sendTextDetailsForm.patchValue({
          text: this.sendFormService.originalSendView()?.text?.text || "",
          hidden: this.sendFormService.originalSendView()?.text?.hidden || false,
        });
      }
    });

    this.sendTextDetailsForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const value = this.sendTextDetailsForm.getRawValue();
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
      text: this.sendFormService.originalSendView()?.text?.text || "",
      hidden: this.sendFormService.originalSendView()?.text?.hidden || false,
    });

    if (!this.sendFormService.sendFormConfig?.areSendsAllowed) {
      this.sendTextDetailsForm.disable();
    }
  }
}
