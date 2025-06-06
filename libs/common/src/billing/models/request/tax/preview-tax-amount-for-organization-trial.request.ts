import { PlanType, ProductType } from "../../../enums";

export type PreviewTaxAmountForOrganizationTrialRequest = {
  planType: PlanType;
  productType: ProductType;
  taxInformation: {
    country: string;
    postalCode: string;
    taxId?: string;
  };
};
