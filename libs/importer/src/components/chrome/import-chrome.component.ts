// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, EventEmitter, input, Input, OnDestroy, OnInit, Output } from "@angular/core";
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

import { chromiumBrowserNameFor, ImportType } from "../../models";

import { chromiumLoginsToCsv, ChromiumLoginImportResult } from "./chromium-login-csv";

type ProfileOption = { id: string; name: string };
type LoginImportResult = ChromiumLoginImportResult;

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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

  profileList: ProfileOption[] = [];

  readonly format = input.required<ImportType>();

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  onLoadProfilesFromBrowser: (browser: string) => Promise<ProfileOption[]>;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  onImportFromBrowser: (browser: string, profile: string) => Promise<LoginImportResult[]>;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() csvDataLoaded = new EventEmitter<string>();

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() error = new EventEmitter<string>();

  constructor(
    private formBuilder: FormBuilder,
    private controlContainer: ControlContainer,
    private logService: LogService,
    private i18nService: I18nService,
  ) {}

  async ngOnInit(): Promise<void> {
    this._parentFormGroup = this.controlContainer.control as FormGroup;
    this._parentFormGroup.addControl("chromeOptions", this.formGroup);

    // Load profiles from browser on initialization
    if (this.onLoadProfilesFromBrowser) {
      try {
        this.profileList = await this.onLoadProfilesFromBrowser(this.getBrowserName(this.format()));
      } catch (error) {
        this.logService.error("Error loading profiles from browser:", error);
        const translatedMessage = this.translateValidationError(error);
        this.error.emit(translatedMessage);
      }
    }
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
        const logins = await this.onImportFromBrowser(
          this.getBrowserName(this.format()),
          this.formGroup.controls.profile.value,
        );

        const result = chromiumLoginsToCsv(logins);
        if ("errorKey" in result) {
          if (result.errorKey === "errorOccurred") {
            this.logService.error("Chromium importer failure:", result.failureDetail);
          }
          return {
            errors: {
              message: this.i18nService.t(result.errorKey),
            },
          };
        }

        this.csvDataLoaded.emit(result.csv);
        return null;
      } catch (error) {
        this.logService.error(`Chromium importer error: ${error}`);
        const translatedMessage = this.translateValidationError(error);
        return {
          errors: {
            message: translatedMessage,
          },
        };
      }
    };
  }

  private translateValidationError(error: any): string {
    // Platform wiring (e.g., the desktop callback) is responsible for translating
    // platform-specific errors before they reach this component. Unknown messages
    // — including raw native error strings — fall back to a generic key rather
    // than being surfaced verbatim in the UI.
    const message = typeof error === "string" ? error : error?.message;
    return message ?? this.i18nService.t("errorOccurred");
  }

  private getBrowserName(format: ImportType): string {
    return chromiumBrowserNameFor(format);
  }
}
