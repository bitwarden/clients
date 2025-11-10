// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { PlanType } from "../../../billing/enums";
import { PlanResponse } from "../../../billing/models/response/plan.response";
import { BaseResponse } from "../../../models/response/base.response";

export class OrganizationResponse extends BaseResponse {
  id: string;
  name: string;
  businessName: string;
  businessAddress1: string;
  businessAddress2: string;
  businessAddress3: string;
  businessCountry: string;
  businessTaxNumber: string;
  billingEmail: string;
  plan: PlanResponse;
  planType: PlanType;
  seats: number;
  maxAutoscaleSeats: number;
  maxCollections: number;
  maxStorageGb: number;
  useGroups: boolean;
  useDirectory: boolean;
  useEvents: boolean;
  useTotp: boolean;
  use2fa: boolean;
  useApi: boolean;
  useResetPassword: boolean;
  useSecretsManager: boolean;
  hasPublicAndPrivateKeys: boolean;
  usePasswordManager: boolean;
  smSeats?: number;
  smServiceAccounts?: number;
  maxAutoscaleSmSeats?: number;
  maxAutoscaleSmServiceAccounts?: number;
  limitCollectionCreation: boolean;
  limitCollectionDeletion: boolean;
  limitItemDeletion: boolean;
  allowAdminAccessToAllCollectionItems: boolean;
  useAccessIntelligence: boolean;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.name = this.getResponseProperty("Name");
    this.businessName = this.getResponseProperty("BusinessName");
    this.businessAddress1 = this.getResponseProperty("BusinessAddress1");
    this.businessAddress2 = this.getResponseProperty("BusinessAddress2");
    this.businessAddress3 = this.getResponseProperty("BusinessAddress3");
    this.businessCountry = this.getResponseProperty("BusinessCountry");
    this.businessTaxNumber = this.getResponseProperty("BusinessTaxNumber");
    this.billingEmail = this.getResponseProperty("BillingEmail");

    const plan = this.getResponseProperty("Plan");
    this.plan = plan == null ? null : new PlanResponse(plan);

    this.planType = this.getResponseProperty("PlanType");
    this.seats = this.getResponseProperty("Seats");
    this.maxAutoscaleSeats = this.getResponseProperty("MaxAutoscaleSeats");
    this.maxCollections = this.getResponseProperty("MaxCollections");
    this.maxStorageGb = this.getResponseProperty("MaxStorageGb");
    this.useGroups = this.getResponseProperty("UseGroups");
    this.useDirectory = this.getResponseProperty("UseDirectory");
    this.useEvents = this.getResponseProperty("UseEvents");
    this.useTotp = this.getResponseProperty("UseTotp");
    this.use2fa = this.getResponseProperty("Use2fa");
    this.useApi = this.getResponseProperty("UseApi");
    this.useResetPassword = this.getResponseProperty("UseResetPassword");
    this.useSecretsManager = this.getResponseProperty("UseSecretsManager");
    this.hasPublicAndPrivateKeys = this.getResponseProperty("HasPublicAndPrivateKeys");
    this.usePasswordManager = this.getResponseProperty("UsePasswordManager");
    this.smSeats = this.getResponseProperty("SmSeats");
    this.smServiceAccounts = this.getResponseProperty("SmServiceAccounts");
    this.maxAutoscaleSmSeats = this.getResponseProperty("MaxAutoscaleSmSeats");
    this.maxAutoscaleSmServiceAccounts = this.getResponseProperty("MaxAutoscaleSmServiceAccounts");
    this.limitCollectionCreation = this.getResponseProperty("LimitCollectionCreation");
    this.limitCollectionDeletion = this.getResponseProperty("LimitCollectionDeletion");
    this.limitItemDeletion = this.getResponseProperty("LimitItemDeletion");
    this.allowAdminAccessToAllCollectionItems = this.getResponseProperty(
      "AllowAdminAccessToAllCollectionItems",
    );
    // Map from backend API property (UseRiskInsights) to domain model property (useAccessIntelligence)
    this.useAccessIntelligence = this.getResponseProperty("UseRiskInsights");
  }
}
