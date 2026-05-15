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
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { PassportView } from "@bitwarden/common/vault/models/view/passport.view";
import {
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { CipherFormContainer } from "../../cipher-form-container";
import { DateFieldGroupComponent } from "../date-field-group/date-field-group.component";

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
    IconButtonModule,
    JslibModule,
    I18nPipe,
    DateFieldGroupComponent,
  ],
})
export class PassportSectionComponent implements OnInit {
  readonly originalCipherView = input<CipherView | null>(null);
  readonly disabled = input(false);

  readonly passportForm: FormGroup;
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly cipherFormContainer: CipherFormContainer,
    private readonly formBuilder: FormBuilder,
  ) {
    this.passportForm = this.formBuilder.group({
      surname: [""],
      givenName: [""],
      dateOfBirth: [""],
      sex: [""],
      birthPlace: [""],
      nationality: [""],
      issuingCountry: [""],
      passportNumber: [""],
      passportType: [""],
      nationalIdentificationNumber: [""],
      issuingAuthority: [""],
      issueDate: [""],
      expirationDate: [""],
    });

    this.cipherFormContainer.registerChildForm("passportDetails", this.passportForm);

    this.passportForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.updateCipherFromFormValue(value));
  }

  ngOnInit() {
    const prefillCipher = this.cipherFormContainer.getInitialCipherView();
    const passportView = prefillCipher?.passport ?? this.originalCipherView()?.passport;

    if (passportView) {
      this.passportForm.patchValue({
        surname: passportView.surname,
        givenName: passportView.givenName,
        dateOfBirth: passportView.dateOfBirth,
        sex: passportView.sex,
        birthPlace: passportView.birthPlace,
        nationality: passportView.nationality,
        issuingCountry: passportView.issuingCountry,
        passportNumber: passportView.passportNumber,
        passportType: passportView.passportType,
        nationalIdentificationNumber: passportView.nationalIdentificationNumber,
        issuingAuthority: passportView.issuingAuthority,
        issueDate: passportView.issueDate,
        expirationDate: passportView.expirationDate,
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
    data.dateOfBirth = value.dateOfBirth;
    data.sex = value.sex;
    data.birthPlace = value.birthPlace;
    data.nationality = value.nationality;
    data.issuingCountry = value.issuingCountry;
    data.passportNumber = value.passportNumber;
    data.passportType = value.passportType;
    data.nationalIdentificationNumber = value.nationalIdentificationNumber;
    data.issuingAuthority = value.issuingAuthority;
    data.issueDate = value.issueDate;
    data.expirationDate = value.expirationDate;

    this.cipherFormContainer.patchCipher((cipher) => {
      cipher.passport = data;
      return cipher;
    });
  }
}
