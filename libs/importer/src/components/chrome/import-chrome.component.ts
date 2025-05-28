// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, OnInit, Output } from "@angular/core";
import {
  AsyncValidatorFn,
  ControlContainer,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  CalloutModule,
  CheckboxModule,
  FormFieldModule,
  IconButtonModule,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";

@Component({
  selector: "import-chrome",
  templateUrl: "import-chrome.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    CalloutModule,
    TypographyModule,
    FormFieldModule,
    ReactiveFormsModule,
    IconButtonModule,
    CheckboxModule,
    SelectModule,
  ],
})
export class ImportChromeComponent implements OnInit, OnDestroy {
  private _parentFormGroup: FormGroup;
  protected formGroup = this.formBuilder.group({
    profile: [
      "",
      {
        nonNullable: true,
        validators: [Validators.required],
        asyncValidators: [this.validateAndEmitData()],
        updateOn: "submit",
      },
    ],
  });

  profileList = [{ id: "Profile 2", name: "Profile 1" }];

  @Output() csvDataLoaded = new EventEmitter<string>();

  constructor(
    private formBuilder: FormBuilder,
    private controlContainer: ControlContainer,
    private logService: LogService,
    private i18nService: I18nService,
  ) {}

  ngOnInit(): void {
    this._parentFormGroup = this.controlContainer.control as FormGroup;
    this._parentFormGroup.addControl("chromeOptions", this.formGroup);

    // TODO: how to call desktop IPC platform from here?
    /*
    const profiles = await ipc.platform.chromiumImporter.getAvailableProfiles(
      "Microsoft Edge",
    );
    */
  }

  ngOnDestroy(): void {
    this._parentFormGroup.removeControl("chromeOptions");
  }

  /**
   * Attempts to login to the provided Chrome email and retrieve account contents.
   * Will return a validation error if unable to login or fetch.
   * Emits account contents to `csvDataLoaded`
   */
  validateAndEmitData(): AsyncValidatorFn {
    return async () => {
      try {
        // TODO: how to call desktop IPC platform from here?
        /*
        const logins = await ipc.platform.chromiumImporter.importLogins("Microsoft Edge",
          this.formGroup.controls.profile.value);
        */

        const csvData = `name,url,username,password,note
github.com,https://github.com/,testuser6,testpassword8,A note for this login.`;

        this.csvDataLoaded.emit(csvData);
        return null;
      } catch (error) {
        this.logService.error(`Chromium importer error: ${error}`);
        return {
          errors: {
            message: this.i18nService.t(this.getValidationErrorI18nKey(error)),
          },
        };
      }
    };
  }

  private getValidationErrorI18nKey(error: any): string {
    const message = typeof error === "string" ? error : error?.message;
    switch (message) {
      default:
        return "errorOccurred";
    }
  }
}
