import { Jsonify } from "type-fest";

import { ProductType, ProviderType } from "../../../enums";
import { OrganizationUserStatusType, OrganizationUserType } from "../../enums";
import { PermissionsApi } from "../api/permissions.api";
import { OrganizationData } from "../data/organization.data";

export class Organization {
  id: string;
  name: string;
  status: OrganizationUserStatusType;

  /**
   * The member's role in the organization.
   * Avoid using this for permission checks - use the getters instead (e.g. isOwner, isAdmin, canManageX), because they
   * properly handle permission inheritance and relationships.
   */
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
  /**
   * Indicates that a user is a ProviderUser for the organization
   */
  isProviderUser: boolean;
  /**
   * Indicates that a user is a member for the organization (may be `false` if they have access via a Provider only)
   */
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

  constructor(obj?: OrganizationData) {
    if (obj == null) {
      return;
    }

    this.id = obj.id;
    this.name = obj.name;
    this.status = obj.status;
    this.type = obj.type;
    this.enabled = obj.enabled;
    this.usePolicies = obj.usePolicies;
    this.useGroups = obj.useGroups;
    this.useDirectory = obj.useDirectory;
    this.useEvents = obj.useEvents;
    this.useTotp = obj.useTotp;
    this.use2fa = obj.use2fa;
    this.useApi = obj.useApi;
    this.useSso = obj.useSso;
    this.useKeyConnector = obj.useKeyConnector;
    this.useScim = obj.useScim;
    this.useCustomPermissions = obj.useCustomPermissions;
    this.useResetPassword = obj.useResetPassword;
    this.useSecretsManager = obj.useSecretsManager;
    this.usePasswordManager = obj.usePasswordManager;
    this.useActivateAutofillPolicy = obj.useActivateAutofillPolicy;
    this.selfHost = obj.selfHost;
    this.usersGetPremium = obj.usersGetPremium;
    this.seats = obj.seats;
    this.maxCollections = obj.maxCollections;
    this.maxStorageGb = obj.maxStorageGb;
    this.ssoBound = obj.ssoBound;
    this.identifier = obj.identifier;
    this.permissions = obj.permissions;
    this.resetPasswordEnrolled = obj.resetPasswordEnrolled;
    this.userId = obj.userId;
    this.hasPublicAndPrivateKeys = obj.hasPublicAndPrivateKeys;
    this.providerId = obj.providerId;
    this.providerName = obj.providerName;
    this.providerType = obj.providerType;
    this.isProviderUser = obj.isProviderUser;
    this.isMember = obj.isMember;
    this.familySponsorshipFriendlyName = obj.familySponsorshipFriendlyName;
    this.familySponsorshipAvailable = obj.familySponsorshipAvailable;
    this.planProductType = obj.planProductType;
    this.keyConnectorEnabled = obj.keyConnectorEnabled;
    this.keyConnectorUrl = obj.keyConnectorUrl;
    this.familySponsorshipLastSyncDate = obj.familySponsorshipLastSyncDate;
    this.familySponsorshipValidUntil = obj.familySponsorshipValidUntil;
    this.familySponsorshipToDelete = obj.familySponsorshipToDelete;
    this.accessSecretsManager = obj.accessSecretsManager;
  }

  get canAccess() {
    if (this.isOwner) {
      return true;
    }
    return this.enabled && this.status === OrganizationUserStatusType.Confirmed;
  }

  /**
   * Whether a user has Manager permissions or greater
   */
  get isManager() {
    return this.type === OrganizationUserType.Manager || this.isAdmin;
  }

  /**
   * Whether a user has Admin permissions or greater
   */
  get isAdmin() {
    return this.type === OrganizationUserType.Admin || this.isOwner;
  }

  /**
   * Whether a user has Owner permissions (including ProviderUsers)
   */
  get isOwner() {
    return this.type === OrganizationUserType.Owner || this.isProviderUser;
  }

  get canAccessEventLogs() {
    return (this.isAdmin || this.permissions.accessEventLogs) && this.useEvents;
  }

  get canAccessImportExport() {
    return this.isAdmin || this.permissions.accessImportExport;
  }

  get canAccessReports() {
    return this.isAdmin || this.permissions.accessReports;
  }

  get canCreateNewCollections() {
    return this.isManager || this.permissions.createNewCollections;
  }

  get canEditAnyCollection() {
    return this.isAdmin || this.permissions.editAnyCollection;
  }

  get canUseAdminCollections() {
    return this.canEditAnyCollection;
  }

  get canDeleteAnyCollection() {
    return this.isAdmin || this.permissions.deleteAnyCollection;
  }

  get canViewAllCollections() {
    return this.canCreateNewCollections || this.canEditAnyCollection || this.canDeleteAnyCollection;
  }

  get canEditAssignedCollections() {
    return this.isManager || this.permissions.editAssignedCollections;
  }

  get canDeleteAssignedCollections() {
    return this.isManager || this.permissions.deleteAssignedCollections;
  }

  get canViewAssignedCollections() {
    return this.canDeleteAssignedCollections || this.canEditAssignedCollections;
  }

  get canManageGroups() {
    return (this.isAdmin || this.permissions.manageGroups) && this.useGroups;
  }

  get canManageSso() {
    return (this.isAdmin || this.permissions.manageSso) && this.useSso;
  }

  get canManageDomainVerification() {
    return (this.isAdmin || this.permissions.manageSso) && this.useSso;
  }

  get canManageScim() {
    return (this.isAdmin || this.permissions.manageScim) && this.useScim;
  }

  get canManagePolicies() {
    return (this.isAdmin || this.permissions.managePolicies) && this.usePolicies;
  }

  get canManageUsers() {
    return this.isAdmin || this.permissions.manageUsers;
  }

  get canManageUsersPassword() {
    return this.isAdmin || this.permissions.manageResetPassword;
  }

  get isExemptFromPolicies() {
    return this.canManagePolicies;
  }

  get canViewSubscription() {
    if (this.canEditSubscription) {
      return true;
    }

    return this.hasProvider && this.providerType === ProviderType.Msp
      ? this.isProviderUser
      : this.isOwner;
  }

  get canEditSubscription() {
    return this.hasProvider ? this.isProviderUser : this.isOwner;
  }

  get canEditPaymentMethods() {
    return this.canEditSubscription;
  }

  get canViewBillingHistory() {
    return this.canEditSubscription;
  }

  get hasProvider() {
    return this.providerId != null || this.providerName != null;
  }

  get canAccessSecretsManager() {
    return this.useSecretsManager && this.accessSecretsManager;
  }

  get isFreeOrg() {
    // return true if organization needs to be upgraded from a free org
    return !this.useTotp;
  }

  static fromJSON(json: Jsonify<Organization>) {
    if (json == null) {
      return null;
    }

    return Object.assign(new Organization(), json, {
      familySponsorshipLastSyncDate: new Date(json.familySponsorshipLastSyncDate),
      familySponsorshipValidUntil: new Date(json.familySponsorshipValidUntil),
    });
  }
}
