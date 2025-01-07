// @ts-strict-ignore
export class PreviewIndividualInvoiceRequest {
  passwordManager: PasswordManager;
  taxInformation: TaxInformation;

  constructor(passwordManager: PasswordManager, taxInformation: TaxInformation) {
    this.passwordManager = passwordManager;
    this.taxInformation = taxInformation;
  }
}

class PasswordManager {
  additionalStorage: number;

  constructor(additionalStorage: number) {
    this.additionalStorage = additionalStorage;
  }
}

class TaxInformation {
  postalCode: string;
  country: string;

  constructor(postalCode: string, country: string) {
    this.postalCode = postalCode;
    this.country = country;
  }
}
