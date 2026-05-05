import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  OnInit,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { merge } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { PassportView } from "@bitwarden/common/vault/models/view/passport.view";
import {
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  SectionHeaderComponent,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { CipherFormContainer } from "../../cipher-form-container";

@Component({
  selector: "vault-passport-section",
  templateUrl: "./passport-section.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    CardComponent,
    TypographyModule,
    FormFieldModule,
    ReactiveFormsModule,
    SectionHeaderComponent,
    SelectModule,
    IconButtonModule,
    JslibModule,
    I18nPipe,
  ],
})
export class PassportSectionComponent implements OnInit {
  readonly originalCipherView = input<CipherView | null>(null);
  readonly disabled = input(false);

  readonly passportForm: FormGroup;
  private readonly destroyRef = inject(DestroyRef);

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
  ) {
    this.passportForm = this.formBuilder.group({
      surname: [""],
      givenName: [""],
      dateOfBirth: this.formBuilder.group({
        month: [""],
        day: [""],
        year: [""],
      }),
      sex: [""],
      birthPlace: [""],
      nationality: [""],
      issuingCountry: [""],
      passportNumber: [""],
      passportType: [""],
      nationalIdentificationNumber: [""],
      issuingAuthority: [""],
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
    });

    this.cipherFormContainer.registerChildForm("passportDetails", this.passportForm);

    this.passportForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.updateCipherFromFormValue(value));

    for (const groupName of ["dateOfBirth", "issueDate", "expirationDate"]) {
      this.setupMonthYearCrossValidation(
        groupName,
        this.i18nService.t("enterMonth"),
        this.i18nService.t("enterYear"),
      );
      const group = this.passportForm.get(groupName) as FormGroup;
      this.setupNumericFilter(group.get("day")!);
      this.setupNumericFilter(group.get("year")!);
    }
  }

  ngOnInit() {
    const prefillCipher = this.cipherFormContainer.getInitialCipherView();
    const passportView = prefillCipher?.passport ?? this.originalCipherView()?.passport;

    if (passportView) {
      const dob = this.parseDateParts(passportView.dateOfBirth);
      const issue = this.parseDateParts(passportView.issueDate);
      const exp = this.parseDateParts(passportView.expirationDate);

      this.passportForm.patchValue({
        surname: passportView.surname,
        givenName: passportView.givenName,
        dateOfBirth: { month: dob.month, day: dob.day, year: dob.year },
        sex: passportView.sex,
        birthPlace: passportView.birthPlace,
        nationality: passportView.nationality,
        issuingCountry: passportView.issuingCountry,
        passportNumber: passportView.passportNumber,
        passportType: passportView.passportType,
        nationalIdentificationNumber: passportView.nationalIdentificationNumber,
        issuingAuthority: passportView.issuingAuthority,
        issueDate: { month: issue.month, day: issue.day, year: issue.year },
        expirationDate: { month: exp.month, day: exp.day, year: exp.year },
      });
    }

    if (this.disabled()) {
      this.passportForm.disable();
    }

    this.cipherFormContainer.formStatusChange$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => {
        if (status === "disabled" || this.disabled()) {
          this.passportForm.disable();
        } else {
          this.passportForm.enable();
        }
      });
  }

  private updateCipherFromFormValue(value: typeof this.passportForm.value): void {
    const data = new PassportView();
    data.surname = value.surname;
    data.givenName = value.givenName;
    data.dateOfBirth = this.combineDate(
      value.dateOfBirth?.month,
      value.dateOfBirth?.day,
      value.dateOfBirth?.year,
    );
    data.sex = value.sex;
    data.birthPlace = value.birthPlace;
    data.nationality = value.nationality;
    data.issuingCountry = value.issuingCountry;
    data.passportNumber = value.passportNumber;
    data.passportType = value.passportType;
    data.nationalIdentificationNumber = value.nationalIdentificationNumber;
    data.issuingAuthority = value.issuingAuthority;
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

    this.cipherFormContainer.patchCipher((cipher) => {
      cipher.passport = data;
      return cipher;
    });
  }

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

  private setupMonthYearCrossValidation(
    groupName: string,
    monthMessage: string,
    yearMessage: string,
  ): void {
    const group = this.passportForm.get(groupName) as FormGroup;
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
