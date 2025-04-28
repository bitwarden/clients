import { PlanSponsorshipType, PlanType } from "../../enums";

export class PreviewOrganizationInvoiceRequest {
  organizationId?: string;
  passwordManager: PasswordManager;
  secretsManager?: SecretsManager;
  taxInformation: TaxInformation;

  constructor(
    passwordManager: PasswordManager,
    taxInformation: TaxInformation,
    organizationId?: string,
    secretsManager?: SecretsManager,
  ) {
    this.organizationId = organizationId;
    this.passwordManager = passwordManager;
    this.secretsManager = secretsManager;
    this.taxInformation = taxInformation;
  }
}

class PasswordManager {
  plan: PlanType;
  sponsoredPlan?: PlanSponsorshipType;
  seats: number;
  additionalStorage: number;

  constructor(plan: PlanType, seats: number, additionalStorage: number) {
    this.plan = plan;
    this.seats = seats;
    this.additionalStorage = additionalStorage;
  }
}

class SecretsManager {
  seats: number;
  additionalMachineAccounts: number;

  constructor(seats: number, additionalMachineAccounts: number) {
    this.seats = seats;
    this.additionalMachineAccounts = additionalMachineAccounts;
  }
}

class TaxInformation {
  postalCode: string;
  country: string;
  taxId: string;

  constructor(postalCode: string, country: string, taxId: string) {
    this.postalCode = postalCode;
    this.country = country;
    this.taxId = taxId;
  }
}
