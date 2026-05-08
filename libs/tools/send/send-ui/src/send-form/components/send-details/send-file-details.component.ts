import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, Validators, ReactiveFormsModule, FormsModule } from "@angular/forms";

import { SendFileView } from "@bitwarden/common/tools/send/models/view/send-file.view";
import {
  ButtonModule,
  FormFieldModule,
  SectionComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { SendFormService } from "../../abstractions/send-form.service";

@Component({
  selector: "tools-send-file-details",
  templateUrl: "./send-file-details.component.html",
  imports: [
    ButtonModule,
    I18nPipe,
    ReactiveFormsModule,
    FormFieldModule,
    SectionComponent,
    FormsModule,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendFileDetailsComponent implements OnInit {
  protected readonly sendFormService = inject(SendFormService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly editing = input<boolean>();

  readonly sendFileDetailsForm = this.formBuilder.group({
    file: this.formBuilder.control<SendFileView | null>(null, Validators.required),
  });

  readonly fileName = signal("");

  constructor() {
    this.sendFormService.registerChildForm("sendFileDetailsForm", this.sendFileDetailsForm);

    this.sendFileDetailsForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.sendFormService.patchSend((send) => {
        return Object.assign(send, {
          file: value.file,
        });
      });
    });
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    this.fileName.set(file.name);
    this.sendFormService.setFile(file);
  }

  ngOnInit() {
    if (this.sendFormService.originalSendView()) {
      this.sendFileDetailsForm.patchValue({
        file: this.sendFormService.originalSendView()?.file,
      });
    }

    if (!this.sendFormService.sendFormConfig?.areSendsAllowed) {
      this.sendFileDetailsForm.disable();
    }
  }
}
