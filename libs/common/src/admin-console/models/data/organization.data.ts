import { ProductType, ProviderType } from "../../../enums";
import { OrganizationUserStatusType, OrganizationUserType } from "../../enums";
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
  useKeyConnector: boolean;
  useScim: boolean;
  useCustomPermissions: boolean;
  useResetPassword: boolean;
  useSecretsManager: boolean;
  usePasswordManager: boolean;
  useActivateAutofillPolicy: boolean;
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
  hasPublicAndPrivateKeys: boolean;
  providerId: string;
  providerName: string;
  providerType?: ProviderType;
  isProviderUser: boolean;
  isMember: boolean;
  familySponsorshipFriendlyName: string;
  familySponsorshipAvailable: boolean;
  planProductType: ProductType;
  keyConnectorEnabled: boolean;
  keyConnectorUrl: string;
  familySponsorshipLastSyncDate?: Date;
  familySponsorshipValidUntil?: Date;
  familySponsorshipToDelete?: boolean;
  accessSecretsManager: boolean;

  constructor(
    response: ProfileOrganizationResponse,
    options: {
      isMember: boolean;
      isProviderUser: boolean;
    }
  ) {
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
    this.useKeyConnector = response.useKeyConnector;
    this.useScim = response.useScim;
    this.useCustomPermissions = response.useCustomPermissions;
    this.useResetPassword = response.useResetPassword;
    this.useSecretsManager = response.useSecretsManager;
    this.usePasswordManager = response.usePasswordManager;
    this.useActivateAutofillPolicy = response.useActivateAutofillPolicy;
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
    this.hasPublicAndPrivateKeys = response.hasPublicAndPrivateKeys;
    this.providerId = response.providerId;
    this.providerName = response.providerName;
    this.providerType = response.providerType;
    this.familySponsorshipFriendlyName = response.familySponsorshipFriendlyName;
    this.familySponsorshipAvailable = response.familySponsorshipAvailable;
    this.planProductType = response.planProductType;
    this.keyConnectorEnabled = response.keyConnectorEnabled;
    this.keyConnectorUrl = response.keyConnectorUrl;
    this.familySponsorshipLastSyncDate = response.familySponsorshipLastSyncDate;
    this.familySponsorshipValidUntil = response.familySponsorshipValidUntil;
    this.familySponsorshipToDelete = response.familySponsorshipToDelete;
    this.accessSecretsManager = response.accessSecretsManager;

    this.isMember = options.isMember;
    this.isProviderUser = options.isProviderUser;
  }
}
