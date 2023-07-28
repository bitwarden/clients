import { ProductType } from "../../../enums";
import { BaseResponse } from "../../../models/response/base.response";
import { BitwardenProductType, PlanType } from "../../enums";

export class PlanResponse extends BaseResponse {
  type: PlanType;
  product: ProductType;
  bitwardenProduct: BitwardenProductType;
  name: string;
  isAnnual: boolean;
  nameLocalizationKey: string;
  descriptionLocalizationKey: string;
  canBeUsedByBusiness: boolean;
  baseSeats: number;
  baseStorageGb: number;
  maxCollections: number;
  maxUsers: number;

  hasAdditionalSeatsOption: boolean;
  maxAdditionalSeats: number;
  hasAdditionalStorageOption: boolean;
  maxAdditionalStorage: number;
  hasPremiumAccessOption: boolean;
  trialPeriodDays: number;

  hasSelfHost: boolean;
  hasPolicies: boolean;
  hasGroups: boolean;
  hasDirectory: boolean;
  hasEvents: boolean;
  hasTotp: boolean;
  has2fa: boolean;
  hasApi: boolean;
  hasSso: boolean;
  hasResetPassword: boolean;
  usersGetPremium: boolean;

  upgradeSortOrder: number;
  displaySortOrder: number;
  legacyYear: number;
  disabled: boolean;

  stripePlanId: string;
  stripeSeatPlanId: string;
  stripeStoragePlanId: string;
  stripePremiumAccessPlanId: string;
  basePrice: number;
  seatPrice: number;
  additionalStoragePricePerGb: number;
  premiumAccessOptionPrice: number;

  // SM only
  additionalPricePerServiceAccount: number;
  baseServiceAccount: number;
  maxServiceAccount: number;
  hasAdditionalServiceAccountOption: boolean;
  maxProjects: number;
  maxAdditionalServiceAccounts: number;
  stripeServiceAccountPlanId: string;

  constructor(response: any) {
    super(response);
    this.type = this.getResponseProperty("Type");
    this.product = this.getResponseProperty("Product");
    this.name = this.getResponseProperty("Name");
    this.isAnnual = this.getResponseProperty("IsAnnual");
    this.nameLocalizationKey = this.getResponseProperty("NameLocalizationKey");
    this.descriptionLocalizationKey = this.getResponseProperty("DescriptionLocalizationKey");
    this.canBeUsedByBusiness = this.getResponseProperty("CanBeUsedByBusiness");
    this.baseSeats = this.getResponseProperty("BaseSeats");
    this.baseStorageGb = this.getResponseProperty("BaseStorageGb");
    this.maxCollections = this.getResponseProperty("MaxCollections");
    this.maxUsers = this.getResponseProperty("MaxUsers");
    this.hasAdditionalSeatsOption = this.getResponseProperty("HasAdditionalSeatsOption");
    this.maxAdditionalSeats = this.getResponseProperty("MaxAdditionalSeats");
    this.hasAdditionalStorageOption = this.getResponseProperty("HasAdditionalStorageOption");
    this.maxAdditionalStorage = this.getResponseProperty("MaxAdditionalStorage");
    this.hasPremiumAccessOption = this.getResponseProperty("HasPremiumAccessOption");
    this.trialPeriodDays = this.getResponseProperty("TrialPeriodDays");
    this.hasSelfHost = this.getResponseProperty("HasSelfHost");
    this.hasPolicies = this.getResponseProperty("HasPolicies");
    this.hasGroups = this.getResponseProperty("HasGroups");
    this.hasDirectory = this.getResponseProperty("HasDirectory");
    this.hasEvents = this.getResponseProperty("HasEvents");
    this.hasTotp = this.getResponseProperty("HasTotp");
    this.has2fa = this.getResponseProperty("Has2fa");
    this.hasApi = this.getResponseProperty("HasApi");
    this.hasSso = this.getResponseProperty("HasSso");
    this.hasResetPassword = this.getResponseProperty("HasResetPassword");
    this.usersGetPremium = this.getResponseProperty("UsersGetPremium");
    this.upgradeSortOrder = this.getResponseProperty("UpgradeSortOrder");
    this.displaySortOrder = this.getResponseProperty("SortOrder");
    this.legacyYear = this.getResponseProperty("LegacyYear");
    this.disabled = this.getResponseProperty("Disabled");
    this.stripePlanId = this.getResponseProperty("StripePlanId");
    this.stripeSeatPlanId = this.getResponseProperty("StripeSeatPlanId");
    this.stripeStoragePlanId = this.getResponseProperty("StripeStoragePlanId");
    this.stripePremiumAccessPlanId = this.getResponseProperty("StripePremiumAccessPlanId");
    this.basePrice = this.getResponseProperty("BasePrice");
    this.seatPrice = this.getResponseProperty("SeatPrice");
    this.additionalStoragePricePerGb = this.getResponseProperty("AdditionalStoragePricePerGb");
    this.premiumAccessOptionPrice = this.getResponseProperty("PremiumAccessOptionPrice");

    this.bitwardenProduct = this.getResponseProperty("BitwardenProduct");
    this.additionalPricePerServiceAccount = this.getResponseProperty(
      "AdditionalPricePerServiceAccount"
    );
    this.baseServiceAccount = this.getResponseProperty("BaseServiceAccount");
    this.maxServiceAccount = this.getResponseProperty("MaxServiceAccount");
    this.hasAdditionalServiceAccountOption = this.getResponseProperty(
      "HasAdditionalServiceAccountOption"
    );
    this.maxProjects = this.getResponseProperty("MaxProjects");
    this.maxAdditionalServiceAccounts = this.getResponseProperty("MaxAdditionalServiceAccounts");
    this.stripeServiceAccountPlanId = this.getResponseProperty("StripeServiceAccountPlanId");
  }
}
