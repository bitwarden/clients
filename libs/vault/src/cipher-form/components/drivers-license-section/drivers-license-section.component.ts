import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, DestroyRef, input, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { merge } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DriversLicenseView } from "@bitwarden/common/vault/models/view/drivers-license.view";
import {
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  SectionHeaderComponent,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";

import { CipherFormContainer } from "../../cipher-form-container";

@Component({
  selector: "vault-drivers-license-section",
  templateUrl: "./drivers-license-section.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    TypographyModule,
    FormFieldModule,
    ReactiveFormsModule,
    SectionHeaderComponent,
    SelectModule,
    IconButtonModule,
    JslibModule,
    CommonModule,
  ],
})
export class DriversLicenseSectionComponent implements OnInit {
  readonly originalCipherView = input<CipherView | null>(null);
  readonly disabled = input(false);

  readonly driversLicenseForm: FormGroup;

  readonly months = [
    { name: "-- " + this.i18nService.t("select") + " --", value: "" },
    { name: "01 - " + this.i18nService.t("january"), value: "1" },
    { name: "02 - " + this.i18nService.t("february"), value: "2" },
    { name: "03 - " + this.i18nService.t("march"), value: "3" },
    { name: "04 - " + this.i18nService.t("april"), value: "4" },
    { name: "05 - " + this.i18nService.t("may"), value: "5" },
    { name: "06 - " + this.i18nService.t("june"), value: "6" },
    { name: "07 - " + this.i18nService.t("july"), value: "7" },
    { name: "08 - " + this.i18nService.t("august"), value: "8" },
    { name: "09 - " + this.i18nService.t("september"), value: "9" },
    { name: "10 - " + this.i18nService.t("october"), value: "10" },
    { name: "11 - " + this.i18nService.t("november"), value: "11" },
    { name: "12 - " + this.i18nService.t("december"), value: "12" },
  ];

  constructor(
    private readonly cipherFormContainer: CipherFormContainer,
    private readonly formBuilder: FormBuilder,
    private readonly i18nService: I18nService,
    private readonly destroyRef: DestroyRef,
  ) {
    this.driversLicenseForm = this.formBuilder.group({
      firstName: [""],
      middleName: [""],
      lastName: [""],
      dateOfBirth: this.formBuilder.group({
        month: [""],
        day: [""],
        year: [""],
      }),
      licenseNumber: [""],
      issuingCountry: [""],
      issuingState: [""],
      issueDate: this.formBuilder.group({
        month: [""],
        day: [""],
        year: [""],
      }),
      expirationDate: this.formBuilder.group({
        month: [""],
        day: [""],
        year: [""],
      }),
      issuingAuthority: [""],
      licenseClass: [""],
    });

    this.cipherFormContainer.registerChildForm("driversLicenseDetails", this.driversLicenseForm);

    this.driversLicenseForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.updateCipherFromFormValue(value));

    for (const groupName of ["dateOfBirth", "issueDate", "expirationDate"]) {
      this.setupMonthYearCrossValidation(
        groupName,
        this.i18nService.t("enterMonth"),
        this.i18nService.t("enterYear"),
      );
      const group = this.driversLicenseForm.get(groupName) as FormGroup;
      this.setupNumericFilter(group.get("day")!);
      this.setupNumericFilter(group.get("year")!);
    }
  }

  ngOnInit() {
    const prefillCipher = this.cipherFormContainer.getInitialCipherView();
    const dl = prefillCipher?.driversLicense ?? this.originalCipherView()?.driversLicense;

    if (dl) {
      const dob = this.parseDateParts(dl.dateOfBirth);
      const issue = this.parseDateParts(dl.issueDate);
      const exp = this.parseDateParts(dl.expirationDate);

      this.driversLicenseForm.patchValue({
        firstName: dl.firstName,
        middleName: dl.middleName,
        lastName: dl.lastName,
        dateOfBirth: { month: dob.month, day: dob.day, year: dob.year },
        licenseNumber: dl.licenseNumber,
        issuingCountry: dl.issuingCountry,
        issuingState: dl.issuingState,
        issueDate: { month: issue.month, day: issue.day, year: issue.year },
        expirationDate: { month: exp.month, day: exp.day, year: exp.year },
        issuingAuthority: dl.issuingAuthority,
        licenseClass: dl.licenseClass,
      });
    }

    if (this.disabled()) {
      this.driversLicenseForm.disable();
    }
  }

  /** Runs on every form value change to keep the shared cipher model in sync with the form state. */
  private updateCipherFromFormValue(value: typeof this.driversLicenseForm.value): void {
    const data = new DriversLicenseView();
    data.firstName = value.firstName;
    data.middleName = value.middleName;
    data.lastName = value.lastName;
    data.dateOfBirth = this.combineDate(
      value.dateOfBirth?.month,
      value.dateOfBirth?.day,
      value.dateOfBirth?.year,
    );
    data.licenseNumber = value.licenseNumber;
    data.issuingCountry = value.issuingCountry;
    data.issuingState = value.issuingState;
    data.issueDate = this.combineDate(
      value.issueDate?.month,
      value.issueDate?.day,
      value.issueDate?.year,
    );
    data.expirationDate = this.combineDate(
      value.expirationDate?.month,
      value.expirationDate?.day,
      value.expirationDate?.year,
    );
    data.issuingAuthority = value.issuingAuthority;
    data.licenseClass = value.licenseClass;

    this.cipherFormContainer.patchCipher((cipher) => {
      cipher.driversLicense = data;
      return cipher;
    });
  }

  /**
   * Strips non-digit characters after each keystroke.
   */
  private setupNumericFilter(ctrl: AbstractControl): void {
    ctrl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value: string) => {
      if (!value) {
        return;
      }
      const filtered = value.replace(/\D/g, "");
      if (filtered !== value) {
        ctrl.setValue(filtered, { emitEvent: false });
      }
    });
  }

  /**
   * Enforces that month and year are either both filled or both empty,
   * a partial date (year without month or vice versa) is invalid.
   */
  private setupMonthYearCrossValidation(
    groupName: string,
    monthMessage: string,
    yearMessage: string,
  ): void {
    const group = this.driversLicenseForm.get(groupName) as FormGroup;
    const monthCtrl = group.get("month")!;
    const yearCtrl = group.get("year")!;

    merge(monthCtrl.valueChanges, yearCtrl.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const monthFilled = !!monthCtrl.value;
        const yearFilled = !!(yearCtrl.value as string)?.trim();

        this.setCrossFieldRequired(yearCtrl, monthFilled && !yearFilled, yearMessage);
        this.setCrossFieldRequired(monthCtrl, !monthFilled && yearFilled, monthMessage);
      });
  }

  /**
   * Merges the crossFieldRequired error into existing errors rather than replacing them to avoid clobbering other validators.
   */
  private setCrossFieldRequired(
    ctrl: AbstractControl,
    makeRequired: boolean,
    message: string,
  ): void {
    if (makeRequired) {
      ctrl.setErrors({ ...(ctrl.errors ?? {}), crossFieldRequired: { message } });
    } else if (ctrl.errors?.["crossFieldRequired"]) {
      const errors = { ...ctrl.errors };
      delete errors["crossFieldRequired"];
      ctrl.setErrors(Object.keys(errors).length ? errors : null);
    }
  }

  /**
   * Produces a "year-month-day" string.
   * returns "" when all parts are empty so the stored value is never a bare separator.
   */
  private combineDate(
    month: string | null | undefined,
    day: string | null | undefined,
    year: string | null | undefined,
  ): string {
    if (!month && !day && !year) {
      return "";
    }
    return [year, month, day]
      .map((p) => p ?? "")
      .filter(Boolean)
      .join("-");
  }

  /**
   * Splits the stored "year-month-day" string back into discrete form fields; mirrors combineDate's format exactly.
   * Strips leading zeros from month and day to match the form's expected format.
   */
  private parseDateParts(dateStr: string | undefined): {
    month: string;
    day: string;
    year: string;
  } {
    if (!dateStr) {
      return { month: "", day: "", year: "" };
    }
    const [year = "", month = "", day = ""] = dateStr.split("-");
    return {
      month: month ? String(parseInt(month, 10)) : "",
      day: day ? String(parseInt(day, 10)) : "",
      year,
    };
  }
}
