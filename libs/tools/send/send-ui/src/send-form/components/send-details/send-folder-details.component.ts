import { NgClass } from "@angular/common";
import { ChangeDetectionStrategy, Component, input, OnInit, signal } from "@angular/core";
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import {
  ButtonModule,
  FormFieldModule,
  SectionComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { SendFormConfig } from "../../abstractions/send-form-config.service";
import { SendFormContainer } from "../../send-form-container";

@Component({
  selector: "tools-send-folder-details",
  templateUrl: "./send-folder-details.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule,
    NgClass,
    I18nPipe,
    ReactiveFormsModule,
    FormFieldModule,
    SectionComponent,
    FormsModule,
    TypographyModule,
  ],
})
export class SendFolderDetailsComponent implements OnInit {
  static readonly MAX_FOLDER_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

  readonly config = input.required<SendFormConfig>();
  readonly originalSendView = input<SendView>();

  readonly sendFolderDetailsForm = this.formBuilder.group({
    folder: this.formBuilder.control<string | null>(null, Validators.required),
  });

  readonly folderPreview = signal("");

  constructor(
    private readonly formBuilder: FormBuilder,
    protected readonly sendFormContainer: SendFormContainer,
    private readonly i18nService: I18nService,
  ) {
    this.sendFormContainer.registerChildForm("sendFolderDetailsForm", this.sendFolderDetailsForm);
  }

  onFolderSelected(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    if (!files || files.length === 0) {
      return;
    }

    const fileArray = Array.from(files);
    const totalSize = fileArray.reduce((sum, f) => sum + f.size, 0);

    this.folderPreview.set(
      this.i18nService.t("folderPreview", fileArray.length.toString(), this.formatBytes(totalSize)),
    );

    if (totalSize > SendFolderDetailsComponent.MAX_FOLDER_SIZE_BYTES) {
      this.sendFolderDetailsForm.controls.folder.setValue(null);
      this.sendFolderDetailsForm.controls.folder.setErrors({
        maxSize: { message: this.i18nService.t("maxFolderSize") },
      });
      this.sendFolderDetailsForm.controls.folder.markAsTouched();
      return;
    }

    this.sendFolderDetailsForm.controls.folder.setValue(this.folderPreview());
    this.sendFormContainer.onFolderSelected(files);
  }

  ngOnInit() {
    if (!this.config().areSendsAllowed) {
      this.sendFolderDetailsForm.disable();
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) {
      return "0 Bytes";
    }
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}
