import { UserId } from "@bitwarden/common/types/guid";
import type {
  AccessConnector,
  AccessConnectorDetail,
  AccessConnectorId,
  OrganizationId,
  RotationJob,
  TargetSystemId,
} from "@bitwarden/sdk-internal";

import { parseGuid, sdkIdToString, toSdkId } from "../shared/pam-ids";
import { PamSdkService } from "../shared/pam-sdk.service";
import { sanitizeUntrusted } from "../shared/sanitize-untrusted";

import {
  ConnectorDetailView,
  ConnectorJobView,
  ConnectorRegistration,
  ConnectorView,
} from "./connector.models";

/** The longest connector name or failure reason printed. */
const MAX_TEXT_LENGTH = 200;

/**
 * Access connector operations over `rotation().connectors()`. Ids are validated as GUIDs before
 * any call. This class takes no logger on purpose: the registration result holds a one-time
 * token, and nothing here may write it anywhere. The SDK service logs only an error's name and
 * message when a call fails.
 */
export class ConnectorService {
  constructor(private pamSdk: PamSdkService) {}

  async list(userId: string, organizationId: string): Promise<ConnectorView[]> {
    const org = toOrg(organizationId);
    const connectors = await this.pamSdk.run(
      toUser(userId),
      async (pam) => await pam.rotation().connectors().list(org),
    );
    return connectors.map(toView);
  }

  async get(userId: string, organizationId: string, id: string): Promise<ConnectorDetailView> {
    const org = toOrg(organizationId);
    const connectorId = toConnector(id);
    const detail = await this.pamSdk.run(
      toUser(userId),
      async (pam) => await pam.rotation().connectors().get(org, connectorId),
    );
    return toDetailView(detail);
  }

  /** @returns the registration, whose `token` can never be read again from the server. */
  async register(
    userId: string,
    organizationId: string,
    name: string,
  ): Promise<ConnectorRegistration> {
    const org = toOrg(organizationId);
    const response = await this.pamSdk.run(
      toUser(userId),
      async (pam) => await pam.rotation().connectors().register(org, name),
    );
    return {
      id: sdkIdToString(response.id),
      organizationId: sdkIdToString(response.organizationId),
      name: sanitizeUntrusted(response.name, MAX_TEXT_LENGTH),
      status: response.status,
      creationDate: response.creationDate,
      token: response.token,
    };
  }

  async enable(userId: string, organizationId: string, id: string): Promise<void> {
    const org = toOrg(organizationId);
    const connectorId = toConnector(id);
    await this.pamSdk.run(
      toUser(userId),
      async (pam) => await pam.rotation().connectors().enable(org, connectorId),
    );
  }

  /** Reversible. The server releases the jobs the connector was running. */
  async disable(userId: string, organizationId: string, id: string): Promise<void> {
    const org = toOrg(organizationId);
    const connectorId = toConnector(id);
    await this.pamSdk.run(
      toUser(userId),
      async (pam) => await pam.rotation().connectors().disable(org, connectorId),
    );
  }

  /** Permanent. The connector held the plaintext organization key. */
  async delete(userId: string, organizationId: string, id: string): Promise<void> {
    const org = toOrg(organizationId);
    const connectorId = toConnector(id);
    await this.pamSdk.run(
      toUser(userId),
      async (pam) => await pam.rotation().connectors().delete(org, connectorId),
    );
  }

  /** Only the id's shape is checked. The target system is not looked up. */
  async assign(
    userId: string,
    organizationId: string,
    id: string,
    targetSystemId: string,
  ): Promise<void> {
    const org = toOrg(organizationId);
    const connectorId = toConnector(id);
    const target = toTarget(targetSystemId);
    await this.pamSdk.run(
      toUser(userId),
      async (pam) => await pam.rotation().connectors().assign_target(org, connectorId, target),
    );
  }

  async unassign(
    userId: string,
    organizationId: string,
    id: string,
    targetSystemId: string,
  ): Promise<void> {
    const org = toOrg(organizationId);
    const connectorId = toConnector(id);
    const target = toTarget(targetSystemId);
    await this.pamSdk.run(
      toUser(userId),
      async (pam) => await pam.rotation().connectors().unassign_target(org, connectorId, target),
    );
  }
}

function toUser(userId: string): UserId {
  return parseGuid(userId, "user id") as UserId;
}
function toOrg(value: string) {
  return toSdkId<OrganizationId>(value, "organization id");
}
function toConnector(value: string) {
  return toSdkId<AccessConnectorId>(value, "connector id");
}
function toTarget(value: string) {
  return toSdkId<TargetSystemId>(value, "target system id");
}

function toView(c: AccessConnector): ConnectorView {
  return {
    id: sdkIdToString(c.id),
    organizationId: sdkIdToString(c.organizationId),
    name: sanitizeUntrusted(c.name, MAX_TEXT_LENGTH),
    status: c.status,
    isConnected: c.isConnected,
    lastHeartbeatAt: c.lastHeartbeatAt ?? undefined,
    assignedTargetSystemIds: (c.assignedTargetSystemIds ?? []).map((t) => sdkIdToString(t)),
    creationDate: c.creationDate,
    revisionDate: c.revisionDate,
  };
}

function toDetailView(detail: AccessConnectorDetail): ConnectorDetailView {
  return { ...toView(detail.connector), jobs: (detail.jobs ?? []).map(toJobView) };
}

function toJobView(job: RotationJob): ConnectorJobView {
  const attempts = job.attempts ?? [];
  const latest = attempts.length > 0 ? attempts[attempts.length - 1] : undefined;
  return {
    id: sdkIdToString(job.id),
    rotationConfigId: sdkIdToString(job.rotationConfigId),
    source: job.source,
    status: job.status,
    claimedAt: job.claimedAt ?? undefined,
    createdAt: job.createdAt,
    nextClaimableAt: job.nextClaimableAt ?? undefined,
    expiresAt: job.expiresAt ?? undefined,
    attemptCount: attempts.length,
    latestAttemptStatus: latest?.status,
    latestFailureCode: latest?.failureCode ?? undefined,
    latestFailureReason:
      latest?.failureReason == null
        ? undefined
        : sanitizeUntrusted(latest.failureReason, MAX_TEXT_LENGTH),
  };
}
