// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { MemberDecryptionType } from "../../../auth/enums/sso";
import { ProductTierType } from "../../../billing/enums";
import { OrganizationUserStatusType, OrganizationUserType, ProviderType } from "../../enums";
import { PermissionsApi } from "../api/permissions.api";
import { ProfileOrganizationResponse } from "../response/profile-organization.response";

export class OrganizationData {
  id: string;
  name: string;
  status: OrganizationUserStatusType;
  type: OrganizationUserType;
  enabled: boolean;
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
  ssoBound: boolean;
  identifier: string;
  permissions: PermissionsApi;
  resetPasswordEnrolled: boolean;
  userId: string;
  organizationUserId: string;
  hasPublicAndPrivateKeys: boolean;
  providerId: string;
  providerName: string;
  providerType?: ProviderType;
  isProviderUser: boolean;
  isMember: boolean;
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
  useAccessIntelligence: boolean;
  useAdminSponsoredFamilies: boolean;
  isAdminInitiated: boolean;
  ssoEnabled: boolean;
  ssoMemberDecryptionType?: MemberDecryptionType;

  constructor(
    response?: ProfileOrganizationResponse,
    options?: {
      isMember: boolean;
      isProviderUser: boolean;
    },
  ) {
    if (response == null) {
      return;
    }

    this.id = response.id;
    this.name = response.name;
    this.status = response.status;
    this.type = response.type;
    this.enabled = response.enabled;
    this.usePolicies = response.usePolicies;
    this.useGroups = response.useGroups;
    this.useDirectory = response.useDirectory;
    this.useEvents = response.useEvents;
    this.useTotp = response.useTotp;
    this.use2fa = response.use2fa;
    this.useApi = response.useApi;
    this.useSso = response.useSso;
    this.useOrganizationDomains = response.useOrganizationDomains;
    this.useKeyConnector = response.useKeyConnector;
    this.useScim = response.useScim;
    this.useCustomPermissions = response.useCustomPermissions;
    this.useResetPassword = response.useResetPassword;
    this.useSecretsManager = response.useSecretsManager;
    this.usePasswordManager = response.usePasswordManager;
    this.useActivateAutofillPolicy = response.useActivateAutofillPolicy;
    this.useAutomaticUserConfirmation = response.useAutomaticUserConfirmation;
    this.selfHost = response.selfHost;
    this.usersGetPremium = response.usersGetPremium;
    this.seats = response.seats;
    this.maxCollections = response.maxCollections;
    this.maxStorageGb = response.maxStorageGb;
    this.ssoBound = response.ssoBound;
    this.identifier = response.identifier;
    this.permissions = response.permissions;
    this.resetPasswordEnrolled = response.resetPasswordEnrolled;
    this.userId = response.userId;
    this.organizationUserId = response.organizationUserId;
    this.hasPublicAndPrivateKeys = response.hasPublicAndPrivateKeys;
    this.providerId = response.providerId;
    this.providerName = response.providerName;
    this.providerType = response.providerType;
    this.familySponsorshipFriendlyName = response.familySponsorshipFriendlyName;
    this.familySponsorshipAvailable = response.familySponsorshipAvailable;
    this.productTierType = response.productTierType;
    this.keyConnectorEnabled = response.keyConnectorEnabled;
    this.keyConnectorUrl = response.keyConnectorUrl;
    this.familySponsorshipLastSyncDate = response.familySponsorshipLastSyncDate;
    this.familySponsorshipValidUntil = response.familySponsorshipValidUntil;
    this.familySponsorshipToDelete = response.familySponsorshipToDelete;
    this.accessSecretsManager = response.accessSecretsManager;
    this.limitCollectionCreation = response.limitCollectionCreation;
    this.limitCollectionDeletion = response.limitCollectionDeletion;
    this.limitItemDeletion = response.limitItemDeletion;
    this.allowAdminAccessToAllCollectionItems = response.allowAdminAccessToAllCollectionItems;
    this.userIsManagedByOrganization = response.userIsManagedByOrganization;
    this.useAccessIntelligence = response.useAccessIntelligence;
    this.useAdminSponsoredFamilies = response.useAdminSponsoredFamilies;
    this.isAdminInitiated = response.isAdminInitiated;
    this.ssoEnabled = response.ssoEnabled;
    this.ssoMemberDecryptionType = response.ssoMemberDecryptionType;

    this.isMember = options.isMember;
    this.isProviderUser = options.isProviderUser;
  }

  static fromJSON(obj: Jsonify<OrganizationData>) {
    return Object.assign(new OrganizationData(), obj, {
      familySponsorshipLastSyncDate:
        obj.familySponsorshipLastSyncDate != null
          ? new Date(obj.familySponsorshipLastSyncDate)
          : obj.familySponsorshipLastSyncDate,
      familySponsorshipValidUntil:
        obj.familySponsorshipValidUntil != null
          ? new Date(obj.familySponsorshipValidUntil)
          : obj.familySponsorshipValidUntil,
    });
  }
}
