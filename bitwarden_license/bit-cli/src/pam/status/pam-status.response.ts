import type {
  PamCollectionSummary,
  PamOrganizationStatus,
  PamStatus,
} from "@bitwarden/bit-common/pam/status";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { PamResponse } from "../shared";

/**
 * One organization's PAM readiness. The `can*` fields are client-side hints; the server is
 * authoritative. Only ids and booleans are written, never names.
 */
export class PamStatusOrganizationResponse extends PamResponse {
  id: string;
  usePam: boolean;
  accessPam: boolean;
  providerUser: boolean;
  hasProvider: boolean;
  providerType?: number;
  canManageAccessRules: boolean;
  canManageRotation: boolean;
  canAccessEventLogs: boolean;
  canAccessReports: boolean;

  constructor(o: PamOrganizationStatus) {
    super("pam-status-organization");
    this.id = o.id;
    this.usePam = o.usePam;
    this.accessPam = o.accessPam;
    this.providerUser = o.isProviderUser;
    this.hasProvider = o.hasProvider;
    this.providerType = o.providerType;
    this.canManageAccessRules = o.canManageAccessRules;
    this.canManageRotation = o.canManageRotation;
    this.canAccessEventLogs = o.canAccessEventLogs;
    this.canAccessReports = o.canAccessReports;
  }
}

/** Flags are flattened to `featurePam*` booleans; organizations are the one array. */
export class PamStatusResponse extends PamResponse {
  featurePam: boolean;
  featurePamAccessConnector: boolean;
  loggedIn: boolean;
  organizations: PamStatusOrganizationResponse[];

  constructor(s: PamStatus) {
    super("pam-status");
    this.featurePam = s.flags.pam;
    this.featurePamAccessConnector = s.flags.pamAccessConnector;
    this.loggedIn = s.loggedIn;
    this.organizations = s.organizations.map((o) => new PamStatusOrganizationResponse(o));
  }
}

export class PamCollectionResponse extends PamResponse {
  id: string;
  organizationId: string;
  name: string;
  hasEnabledAccessRule: boolean;

  constructor(c: PamCollectionSummary) {
    super("pam-collection");
    this.id = c.id;
    this.organizationId = c.organizationId;
    this.name = c.name;
    this.hasEnabledAccessRule = c.hasEnabledAccessRule;
  }
}

export function pamCollectionList(collections: PamCollectionSummary[]): ListResponse {
  return new ListResponse(collections.map((c) => new PamCollectionResponse(c)));
}
