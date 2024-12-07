export class PreviewIndividualInvoiceRequest {
  passwordManager: PasswordManager;
  taxInformation: TaxInformation;
}

class PasswordManager {
  additionalStorage: number;
}

class TaxInformation {
  postalCode: string;
  country: string;
  taxId: string;
}
