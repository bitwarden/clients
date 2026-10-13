import { ChangeDetectionStrategy, Component, inject, input, OnInit } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, Validators, ReactiveFormsModule } from "@angular/forms";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MAX_SDK_FILE_SEND_SIZE_BYTES } from "@bitwarden/common/tools/send/services/send-sdk-api.service";
import {
  FileUploadComponent,
  FormFieldModule,
  SectionComponent,
  ToastService,
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
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly configService = inject(ConfigService);

  protected readonly editing = input<boolean>();

  readonly sendFileDetailsForm = this.formBuilder.group({
    file: this.formBuilder.control<File | null>(null, Validators.required),
  });

  // The size limit only applies to the SDK's create_file_send path (see MAX_SDK_FILE_SEND_SIZE_BYTES's
  // doc comment); the legacy path has no equivalent memory concern, so this guard must not apply
  // when the flag is off.
  private readonly useSdkSendsApi = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.Pm30110SdkSendsApi),
    { initialValue: false },
  );

  constructor() {
    this.sendFormService.registerChildForm("sendFileDetailsForm", this.sendFileDetailsForm);

    this.sendFileDetailsForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const file = value.file;
      if (!file) {
        return;
      }
      // Reject oversized files here instead of only in SendSdkApiService.createFileSend: that
      // service-level guard is the backstop (and unreachable for legacy-routed sends, which have
      // no equivalent memory concern), but without this check the user only finds out after
      // waiting through a file read and a submit, and would see the guard's raw, unlocalized
      // error message (see PR #22321 review discussion).
      if (this.useSdkSendsApi() && file.size > MAX_SDK_FILE_SEND_SIZE_BYTES) {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("maxFileSize"),
        });
        this.sendFileDetailsForm.controls.file.setValue(null, { emitEvent: false });
        return;
      }
      this.sendFormService.setFile(file);
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
