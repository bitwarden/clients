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
import { map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  CalloutModule,
  CheckboxModule,
  FormFieldModule,
  IconButtonModule,
  TypographyModule,
} from "@bitwarden/components";

import { LastPassDirectImportService } from "./lastpass-direct-import.service";

@Component({
  selector: "import-lastpass",
  templateUrl: "import-lastpass.component.html",
  imports: [
    CommonModule,
    JslibModule,
    CalloutModule,
    TypographyModule,
    FormFieldModule,
    ReactiveFormsModule,
    IconButtonModule,
    CheckboxModule,
  ],
})
export class ImportLastPassComponent implements OnInit, OnDestroy {
  private _parentFormGroup: FormGroup;
  protected formGroup = this.formBuilder.group({
    email: [
      "",
      {
        validators: [Validators.required, Validators.email],
        asyncValidators: [this.validateAndEmitData()],
        updateOn: "submit",
      },
    ],
    includeSharedFolders: [false],
  });
  protected emailHint$ = this.formGroup.controls.email.statusChanges.pipe(
    map((status) => {
      if (status === "PENDING") {
        return this.i18nService.t("importingYourAccount");
      }
    }),
  );

  @Output() csvDataLoaded = new EventEmitter<string>();

  constructor(
    private formBuilder: FormBuilder,
    private controlContainer: ControlContainer,
    private logService: LogService,
    private lastPassDirectImportService: LastPassDirectImportService,
    private i18nService: I18nService,
  ) {}

  ngOnInit(): void {
    this._parentFormGroup = this.controlContainer.control as FormGroup;
    this._parentFormGroup.addControl("lastpassOptions", this.formGroup);
  }

  ngOnDestroy(): void {
    this._parentFormGroup.removeControl("lastpassOptions");
  }

  /**
   * Attempts to login to the provided LastPass email and retrieve account contents.
   * Will return a validation error if unable to login or fetch.
   * Emits account contents to `csvDataLoaded`
   */
  validateAndEmitData(): AsyncValidatorFn {
    return async () => {
      try {
        const csvData = await this.lastPassDirectImportService.handleImport(
          this.formGroup.controls.email.value,
          this.formGroup.controls.includeSharedFolders.value,
        );
        this.csvDataLoaded.emit(csvData);
        return null;
      } catch (error) {
        this.logService.error(`LP importer error: ${error}`);
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
      case "SSO auth cancelled":
      case "Second factor step is canceled by the user":
      case "Out of band step is canceled by the user":
        return "multifactorAuthenticationCancelled";
      case "No accounts to transform":
      case "Vault has not opened any accounts.":
        return "noLastPassDataFound";
      case "Invalid username":
      case "Invalid password":
        return "incorrectUsernameOrPassword";
      case "Second factor code is incorrect":
      case "Out of band authentication failed":
        return "multifactorAuthenticationFailed";
      case "unifiedloginresult":
        return "lastPassTryAgainCheckEmail";
      default:
        return "errorOccurred";
    }
  }
}
