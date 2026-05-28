import { ChangeDetectionStrategy, Component, inject, input, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, Validators, ReactiveFormsModule } from "@angular/forms";

import {
  FileUploadComponent,
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
    FileUploadComponent,
    FormFieldModule,
    I18nPipe,
    ReactiveFormsModule,
    SectionComponent,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendFileDetailsComponent implements OnInit {
  protected readonly sendFormService = inject(SendFormService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly editing = input<boolean>();

  readonly sendFileDetailsForm = this.formBuilder.group({
    file: this.formBuilder.control<File | null>(null, Validators.required),
  });

  constructor() {
    this.sendFormService.registerChildForm("sendFileDetailsForm", this.sendFileDetailsForm);

    this.sendFileDetailsForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (value.file) {
        this.sendFormService.setFile(value.file);
      }
    });
  }

  ngOnInit() {
    // Edit mode hides the file input; disable so the required validator doesn't block save.
    if (this.sendFormService.sendFormConfig?.mode === "edit") {
      this.sendFileDetailsForm.controls.file.disable();
    }

    if (!this.sendFormService.sendFormConfig?.areSendsAllowed) {
      this.sendFileDetailsForm.disable();
    }
  }
}
