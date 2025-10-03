// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import {
  ButtonModule,
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  SectionHeaderComponent,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";

import { CipherFormContainer } from "../../cipher-form-container";

@Component({
  selector: "vault-identity-section",
  templateUrl: "./identity.component.html",
  imports: [
    CommonModule,
    ButtonModule,
    JslibModule,
    ReactiveFormsModule,
    SectionHeaderComponent,
    CardComponent,
    FormFieldModule,
    IconButtonModule,
    SelectModule,
    TypographyModule,
  ],
})
export class IdentitySectionComponent implements OnInit {
  @Input() originalCipherView: CipherView;
  @Input() disabled: boolean;
  identityTitleOptions = [
    { name: "-- " + this.i18nService.t("select") + " --", value: null },
    { name: this.i18nService.t("mr"), value: this.i18nService.t("mr") },
    { name: this.i18nService.t("mrs"), value: this.i18nService.t("mrs") },
    { name: this.i18nService.t("ms"), value: this.i18nService.t("ms") },
    { name: this.i18nService.t("mx"), value: this.i18nService.t("mx") },
    { name: this.i18nService.t("dr"), value: this.i18nService.t("dr") },
  ];

  protected identityForm = this.formBuilder.group({
    title: [null],
    firstName: [""],
    middleName: [""],
    lastName: [""],
    username: [""],
    company: [""],
    ssn: [""],
    passportNumber: [""],
    licenseNumber: [""],
    email: [""],
    phone: [""],
    address1: [""],
    address2: [""],
    address3: [""],
    city: [""],
    state: [""],
    postalCode: [""],
    country: [""],
  });

  get initialValues() {
    return this.cipherFormContainer.config.initialValues;
  }

  constructor(
    private cipherFormContainer: CipherFormContainer,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
  ) {
    this.cipherFormContainer.registerChildForm("identityDetails", this.identityForm);
    this.identityForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const data = new IdentityView();
      data.title = value.title;
      data.firstName = value.firstName;
      data.middleName = value.middleName;
      data.lastName = value.lastName;
      data.username = value.username;
      data.company = value.company;
      data.ssn = value.ssn;
      data.passportNumber = value.passportNumber;
      data.licenseNumber = value.licenseNumber;
      data.email = value.email;
      data.phone = value.phone;
      data.address1 = value.address1;
      data.address2 = value.address2;
      data.address3 = value.address3;
      data.city = value.city;
      data.state = value.state;
      data.postalCode = value.postalCode;
      data.country = value.country;

      this.cipherFormContainer.patchCipher((cipher) => {
        cipher.identity = data;
        return cipher;
      });
    });
  }

  ngOnInit() {
    // If true will disable all inputs
    if (this.disabled) {
      this.identityForm.disable();
    }

    const prefillCipher = this.cipherFormContainer.getInitialCipherView();

    if (prefillCipher) {
      this.initFromExistingCipher(prefillCipher.identity);
      this.populateFormData(prefillCipher);
    } else {
      this.initNewCipher();
      this.identityForm.patchValue({
        username: this.cipherFormContainer.config.initialValues?.username || "",
      });
    }
  }

  private initFromExistingCipher(existingIdentity: IdentityView) {
    this.identityForm.patchValue({
      firstName: this.initialValues?.firstName ?? existingIdentity.firstName,
      middleName: this.initialValues?.middleName ?? existingIdentity.middleName,
      lastName: this.initialValues?.lastName ?? existingIdentity.lastName,
      company: this.initialValues?.company ?? existingIdentity.company,
      ssn: this.initialValues?.ssn ?? existingIdentity.ssn,
      passportNumber: this.initialValues?.passportNumber ?? existingIdentity.passportNumber,
      licenseNumber: this.initialValues?.licenseNumber ?? existingIdentity.licenseNumber,
      email: this.initialValues?.email ?? existingIdentity.email,
      phone: this.initialValues?.phone ?? existingIdentity.phone,
      address1: this.initialValues?.address1 ?? existingIdentity.address1,
      address2: this.initialValues?.address2 ?? existingIdentity.address2,
      address3: this.initialValues?.address3 ?? existingIdentity.address3,
      city: this.initialValues?.city ?? existingIdentity.city,
      state: this.initialValues?.state ?? existingIdentity.state,
      postalCode: this.initialValues?.postalCode ?? existingIdentity.postalCode,
      country: this.initialValues?.country ?? existingIdentity.country,
    });
  }

  private initNewCipher() {
    this.identityForm.patchValue({
      firstName: this.initialValues?.firstName || "",
      middleName: this.initialValues?.middleName || "",
      lastName: this.initialValues?.lastName || "",
      company: this.initialValues?.company || "",
      ssn: this.initialValues?.ssn || "",
      passportNumber: this.initialValues?.passportNumber || "",
      licenseNumber: this.initialValues?.licenseNumber || "",
      email: this.initialValues?.email || "",
      phone: this.initialValues?.phone || "",
      address1: this.initialValues?.address1 || "",
      address2: this.initialValues?.address2 || "",
      address3: this.initialValues?.address3 || "",
      city: this.initialValues?.city || "",
      state: this.initialValues?.state || "",
      postalCode: this.initialValues?.postalCode || "",
      country: this.initialValues?.country || "",
    });
  }

  populateFormData(cipherView: CipherView) {
    const { identity } = cipherView;

    this.identityForm.patchValue({
      title: identity.title,
      firstName: identity.firstName,
      middleName: identity.middleName,
      lastName: identity.lastName,
      username: this.cipherFormContainer.config.initialValues?.username ?? identity.username,
      company: identity.company,
      ssn: identity.ssn,
      passportNumber: identity.passportNumber,
      licenseNumber: identity.licenseNumber,
      email: identity.email,
      phone: identity.phone,
      address1: identity.address1,
      address2: identity.address2,
      address3: identity.address3,
      city: identity.city,
      state: identity.state,
      postalCode: identity.postalCode,
      country: identity.country,
    });
  }
}
