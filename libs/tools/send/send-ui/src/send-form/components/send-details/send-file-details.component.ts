import { CommonModule } from "@angular/common";
import { Component, input, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, Validators, ReactiveFormsModule, FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SendFileView } from "@bitwarden/common/tools/send/models/view/send-file.view";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import {
  ButtonModule,
  FormFieldModule,
  SectionComponent,
  TypographyModule,
} from "@bitwarden/components";

import { SendFormConfig } from "../../abstractions/send-form-config.service";
import { SendFormContainer } from "../../send-form-container";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
  readonly config = input.required<SendFormConfig>();
  readonly originalSendView = input<SendView>();

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
    const files = (event.target as HTMLInputElement).files;
    if (!files || files.length === 0) {
      return;
    }

    if (files.length === 1) {
      this.fileName = files[0].name;
      this.sendFormContainer.onFileSelected(files[0]);
    } else {
      const totalSize = Array.from(files).reduce((sum, f) => sum + f.size, 0);
      this.fileName = `${files.length} files, ${this.formatFileSize(totalSize)}`;
      this.sendFormContainer.onMultipleFilesSelected(files);

      // Set a placeholder file view so the form validates
      const placeholderView = new SendFileView();
      placeholderView.fileName = this.fileName;
      placeholderView.size = String(totalSize);
      this.sendFileDetailsForm.patchValue({ file: placeholderView });
    }
  };

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  }

  ngOnInit() {
    if (this.originalSendView()) {
      this.sendFileDetailsForm.patchValue({
        file: this.originalSendView()?.file,
      });
    }

    // Pre-populate from context menu preloaded paths
    const preloadedPaths = this.config().preloadedPaths;
    if (preloadedPaths != null && preloadedPaths.length > 0) {
      const nonDirPaths = preloadedPaths.filter((p) => !p.isDirectory);
      const totalSize = preloadedPaths.reduce((sum, p) => sum + p.size, 0);

      if (nonDirPaths.length === 1 && preloadedPaths.length === 1) {
        // Single file — show its name
        this.fileName = nonDirPaths[0].name;
      } else {
        // Multiple entries — show summary
        this.fileName = `${preloadedPaths.length} files, ${this.formatFileSize(totalSize)}`;
      }

      const preloadedFileView = new SendFileView();
      preloadedFileView.fileName = this.fileName;
      preloadedFileView.size = String(totalSize);
      this.sendFileDetailsForm.patchValue({ file: preloadedFileView });
    }

    if (!this.config().areSendsAllowed) {
      this.sendFileDetailsForm.disable();
    }
  }
}
