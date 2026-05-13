import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, DestroyRef, input, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DriversLicenseView } from "@bitwarden/common/vault/models/view/drivers-license.view";
import {
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

import { CipherFormContainer } from "../../cipher-form-container";
import { DateFieldGroupComponent } from "../date-field-group/date-field-group.component";

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
    IconButtonModule,
    JslibModule,
    CommonModule,
    DateFieldGroupComponent,
  ],
})
export class DriversLicenseSectionComponent implements OnInit {
  readonly originalCipherView = input<CipherView | null>(null);
  readonly disabled = input(false);

  readonly driversLicenseForm: FormGroup;

  constructor(
    private readonly cipherFormContainer: CipherFormContainer,
    private readonly formBuilder: FormBuilder,
    private readonly destroyRef: DestroyRef,
  ) {
    this.driversLicenseForm = this.formBuilder.group({
      firstName: [""],
      middleName: [""],
      lastName: [""],
      dateOfBirth: [""],
      licenseNumber: [""],
      issuingCountry: [""],
      issuingState: [""],
      issueDate: [""],
      expirationDate: [""],
      issuingAuthority: [""],
      licenseClass: [""],
    });

    this.cipherFormContainer.registerChildForm("driversLicenseDetails", this.driversLicenseForm);

    this.driversLicenseForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.updateCipherFromFormValue(value));
  }

  ngOnInit() {
    const prefillCipher = this.cipherFormContainer.getInitialCipherView();
    const dl = prefillCipher?.driversLicense ?? this.originalCipherView()?.driversLicense;

    if (dl) {
      this.driversLicenseForm.patchValue({
        firstName: dl.firstName,
        middleName: dl.middleName,
        lastName: dl.lastName,
        dateOfBirth: dl.dateOfBirth,
        licenseNumber: dl.licenseNumber,
        issuingCountry: dl.issuingCountry,
        issuingState: dl.issuingState,
        issueDate: dl.issueDate,
        expirationDate: dl.expirationDate,
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
    data.dateOfBirth = value.dateOfBirth;
    data.licenseNumber = value.licenseNumber;
    data.issuingCountry = value.issuingCountry;
    data.issuingState = value.issuingState;
    data.issueDate = value.issueDate;
    data.expirationDate = value.expirationDate;
    data.issuingAuthority = value.issuingAuthority;
    data.licenseClass = value.licenseClass;

    this.cipherFormContainer.patchCipher((cipher) => {
      cipher.driversLicense = data;
      return cipher;
    });
  }
}
