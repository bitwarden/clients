// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
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

  profileList: { id: string; name: string }[] = [];

  @Input()
  format: ImportType;

  @Input()
  onLoadProfilesFromBrowser: (browser: string) => Promise<any[]>;

  @Input()
  onImportFromBrowser: (browser: string, profile: string) => Promise<any[]>;

  @Output() csvDataLoaded = new EventEmitter<string>();

  constructor(
    private formBuilder: FormBuilder,
    private controlContainer: ControlContainer,
    private logService: LogService,
    private i18nService: I18nService,
  ) {}

  async ngOnInit(): Promise<void> {
    this._parentFormGroup = this.controlContainer.control as FormGroup;
    this._parentFormGroup.addControl("chromeOptions", this.formGroup);
    this.profileList = await this.onLoadProfilesFromBrowser(this.getBrowserName());
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
          this.getBrowserName(),
          this.formGroup.controls.profile.value,
        );
        if (logins.length === 0) {
          throw "nothing to import";
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

  private getBrowserName(): string {
    if (this.format === "edgecsv") {
      return "Microsoft Edge";
    } else if (this.format === "operacsv") {
      return "Opera";
    } else if (this.format === "bravecsv") {
      return "Brave";
    } else if (this.format === "vivaldicsv") {
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
