import { PlanType } from "@bitwarden/common/billing/enums";

export class PreviewOrganizationInvoiceRequest {
  organizationId?: string;
  passwordManager: PasswordManager;
  secretsManager?: SecretsManager;
  taxInformation: TaxInformation;
}

class PasswordManager {
  plan: PlanType;
  seats: number;
  additionalStorage: number;
}

class SecretsManager {
  seats: number;
  additionalMachineAccounts: number;
}

class TaxInformation {
  postalCode: string;
  country: string;
  taxId: string;
}
