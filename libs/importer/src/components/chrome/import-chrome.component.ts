// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import {
  Component,
  effect,
  EventEmitter,
  input,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from "@angular/core";
import {
  AsyncValidatorFn,
  ControlContainer,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import * as papa from "papaparse";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  CalloutModule,
  CheckboxModule,
  FormFieldModule,
  IconButtonModule,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";

import { ImportType } from "../../models";

type ProfileOption = { id: string; name: string };

type Login = {
  url: string;
  username: string;
  password: string;
  note: string;
};
type LoginImportFailure = {
  url: string;
  username: string;
  error: string;
};

type LoginImportResult = {
  login?: Login;
  failure?: LoginImportFailure;
};

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

  constructor(
    private formBuilder: FormBuilder,
    private controlContainer: ControlContainer,
    private logService: LogService,
    private i18nService: I18nService,
  ) {
    effect(async () => {
      // Callback is set via @Input after constructor, so check it exists
      if (this.onLoadProfilesFromBrowser) {
        try {
          this.profileList = await this.onLoadProfilesFromBrowser(
            this.getBrowserName(this.format()),
          );
        } catch (error) {
          this.logService.error("Error loading profiles from browser:", error);
          // FIXME: Add error handling and display when profiles could not be loaded/retrieved
        }
      }
    });
  }

  async ngOnInit(): Promise<void> {
    this._parentFormGroup = this.controlContainer.control as FormGroup;
    this._parentFormGroup.addControl("chromeOptions", this.formGroup);
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

        // If any of the login items has a failure return a generic error message
        // Introduced because we ran into a new type of V3 encryption added on Chrome that we don't yet support
        if (logins.some((l) => l.failure != null)) {
          const error = logins.find((l) => l.failure != null);
          this.logService.error("Chromium importer failure:", error.failure.error);
          return {
            errors: {
              message: this.i18nService.t("errorOccurred"),
            },
          };
        }

        if (logins.length === 0) {
          return {
            errors: {
              message: this.i18nService.t("importNothingError"),
            },
          };
        }
        const chromeLogins: ChromeLogin[] = [];
        for (const l of logins) {
          if (l.login != null) {
            chromeLogins.push(new ChromeLogin(l.login));
          }
        }
        const csvData = papa.unparse(chromeLogins);
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

  private getBrowserName(format: ImportType): string {
    if (format === "edgecsv") {
      return "Microsoft Edge";
    } else if (format === "operacsv") {
      return "Opera";
    } else if (format === "bravecsv") {
      return "Brave";
    } else if (format === "vivaldicsv") {
      return "Vivaldi";
    }
    return "Chrome";
  }
}

class ChromeLogin {
  name: string;
  url: string;
  username: string;
  password: string;
  note: string;

  constructor(login: any) {
    const url = Utils.getUrl(login?.url);
    if (url != null) {
      this.name = new URL(url).hostname;
    }
    if (this.name == null) {
      this.name = login.url;
    }
    this.url = login.url;
    this.username = login.username;
    this.password = login.password;
    this.note = login.note;
  }
}
