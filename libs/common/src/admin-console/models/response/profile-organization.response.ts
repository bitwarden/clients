import { MemberDecryptionType } from "../../../auth/enums/sso";
import { ProductTierType } from "../../../billing/enums";
import { BaseResponse } from "../../../models/response/base.response";
import { OrganizationUserStatusType, OrganizationUserType, ProviderType } from "../../enums";
import { PermissionsApi } from "../api/permissions.api";

export class ProfileOrganizationResponse extends BaseResponse {
  id: string;
  name: string;
  usePolicies: boolean;
  useGroups: boolean;
  useDirectory: boolean;
  useEvents: boolean;
  useTotp: boolean;
  use2fa: boolean;
  useApi: boolean;
  useSso: boolean;
  useOrganizationDomains: boolean;
  useKeyConnector: boolean;
  useScim: boolean;
  useCustomPermissions: boolean;
  useResetPassword: boolean;
  useSecretsManager: boolean;
  usePasswordManager: boolean;
  useActivateAutofillPolicy: boolean;
  useAutomaticUserConfirmation: boolean;
  selfHost: boolean;
  usersGetPremium: boolean;
  seats: number;
  maxCollections: number;
  maxStorageGb?: number;
  key: string;
  hasPublicAndPrivateKeys: boolean;
  status: OrganizationUserStatusType;
  type: OrganizationUserType;
  enabled: boolean;
  ssoBound: boolean;
  identifier: string;
  permissions: PermissionsApi;
  resetPasswordEnrolled: boolean;
  userId: string;
  organizationUserId: string;
  providerId: string;
  providerName: string;
  providerType?: ProviderType;
  familySponsorshipFriendlyName: string;
  familySponsorshipAvailable: boolean;
  productTierType: ProductTierType;
  keyConnectorEnabled: boolean;
  keyConnectorUrl: string;
  familySponsorshipLastSyncDate?: Date;
  familySponsorshipValidUntil?: Date;
  familySponsorshipToDelete?: boolean;
  accessSecretsManager: boolean;
  limitCollectionCreation: boolean;
  limitCollectionDeletion: boolean;
  limitItemDeletion: boolean;
  allowAdminAccessToAllCollectionItems: boolean;
  userIsManagedByOrganization: boolean;
  useRiskInsights: boolean;
  useAdminSponsoredFamilies: boolean;
  isAdminInitiated: boolean;
  ssoEnabled: boolean;
  ssoMemberDecryptionType?: MemberDecryptionType;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.name = this.getResponseProperty("Name");
    this.usePolicies = this.getResponseProperty("UsePolicies");
    this.useGroups = this.getResponseProperty("UseGroups");
    this.useDirectory = this.getResponseProperty("UseDirectory");
    this.useEvents = this.getResponseProperty("UseEvents");
    this.useTotp = this.getResponseProperty("UseTotp");
    this.use2fa = this.getResponseProperty("Use2fa");
    this.useApi = this.getResponseProperty("UseApi");
    this.useSso = this.getResponseProperty("UseSso");
    this.useOrganizationDomains = this.getResponseProperty("UseOrganizationDomains");
    this.useKeyConnector = this.getResponseProperty("UseKeyConnector") ?? false;
    this.useScim = this.getResponseProperty("UseScim") ?? false;
    this.useCustomPermissions = this.getResponseProperty("UseCustomPermissions") ?? false;
    this.useResetPassword = this.getResponseProperty("UseResetPassword");
    this.useSecretsManager = this.getResponseProperty("UseSecretsManager");
    this.usePasswordManager = this.getResponseProperty("UsePasswordManager");
    this.useActivateAutofillPolicy = this.getResponseProperty("UseActivateAutofillPolicy");
    this.useAutomaticUserConfirmation = this.getResponseProperty("UseAutomaticUserConfirmation");
    this.selfHost = this.getResponseProperty("SelfHost");
    this.usersGetPremium = this.getResponseProperty("UsersGetPremium");
    this.seats = this.getResponseProperty("Seats");
    this.maxCollections = this.getResponseProperty("MaxCollections");
    this.maxStorageGb = this.getResponseProperty("MaxStorageGb");
    this.key = this.getResponseProperty("Key");
    this.hasPublicAndPrivateKeys = this.getResponseProperty("HasPublicAndPrivateKeys");
    this.status = this.getResponseProperty("Status");
    this.type = this.getResponseProperty("Type");
    this.enabled = this.getResponseProperty("Enabled");
    this.ssoBound = this.getResponseProperty("SsoBound");
    this.identifier = this.getResponseProperty("Identifier");
    this.permissions = new PermissionsApi(this.getResponseProperty("permissions"));
    this.resetPasswordEnrolled = this.getResponseProperty("ResetPasswordEnrolled");
    this.userId = this.getResponseProperty("UserId");
    this.organizationUserId = this.getResponseProperty("OrganizationUserId");
    this.providerId = this.getResponseProperty("ProviderId");
    this.providerName = this.getResponseProperty("ProviderName");
    this.providerType = this.getResponseProperty("ProviderType");
    this.familySponsorshipFriendlyName = this.getResponseProperty("FamilySponsorshipFriendlyName");
    this.familySponsorshipAvailable = this.getResponseProperty("FamilySponsorshipAvailable");
    this.productTierType = this.getResponseProperty("ProductTierType");
    this.keyConnectorEnabled = this.getResponseProperty("KeyConnectorEnabled") ?? false;
    this.keyConnectorUrl = this.getResponseProperty("KeyConnectorUrl");
    const familySponsorshipLastSyncDateString = this.getResponseProperty(
      "FamilySponsorshipLastSyncDate",
    );
    if (familySponsorshipLastSyncDateString) {
      this.familySponsorshipLastSyncDate = new Date(familySponsorshipLastSyncDateString);
    }
    const familySponsorshipValidUntilString = this.getResponseProperty(
      "FamilySponsorshipValidUntil",
    );
    if (familySponsorshipValidUntilString) {
      this.familySponsorshipValidUntil = new Date(familySponsorshipValidUntilString);
    }
    this.familySponsorshipToDelete = this.getResponseProperty("FamilySponsorshipToDelete");
    this.accessSecretsManager = this.getResponseProperty("AccessSecretsManager");
    this.limitCollectionCreation = this.getResponseProperty("LimitCollectionCreation");
    this.limitCollectionDeletion = this.getResponseProperty("LimitCollectionDeletion");
    this.limitItemDeletion = this.getResponseProperty("LimitItemDeletion");
    this.allowAdminAccessToAllCollectionItems = this.getResponseProperty(
      "AllowAdminAccessToAllCollectionItems",
    );
    this.userIsManagedByOrganization = this.getResponseProperty("UserIsManagedByOrganization");
    this.useRiskInsights = this.getResponseProperty("UseRiskInsights");
    this.useAdminSponsoredFamilies = this.getResponseProperty("UseAdminSponsoredFamilies");
    this.isAdminInitiated = this.getResponseProperty("IsAdminInitiated");
    this.ssoEnabled = this.getResponseProperty("SsoEnabled") ?? false;
    this.ssoMemberDecryptionType = this.getResponseProperty("SsoMemberDecryptionType");
  }
}
