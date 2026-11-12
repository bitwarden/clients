import { mock } from "jest-mock-extended";

import type {
  AccessConnector,
  AccessConnectorDetail,
  AccessConnectorRegistrationResponse,
  AccessConnectorsClient,
  RotationClient,
} from "@bitwarden/sdk-internal";

import {
  createPamSdkTestKit,
  PAM_TEST_ORGANIZATION_ID,
  PAM_TEST_USER_ID,
} from "../shared/testing/pam-test-helpers";

import { ConnectorService } from "./connector.service";

const CONNECTOR_ID = "33333333-3333-4333-8333-333333333333";
const TARGET_ID = "44444444-4444-4444-8444-444444444444";
const TOKEN = "one-time-token-value-9f8e7d";

describe("ConnectorService", () => {
  const kit = createPamSdkTestKit();
  const connectors = mock<AccessConnectorsClient>();
  const rotation = mock<RotationClient>();
  let service: ConnectorService;

  const sdkConnector = (overrides: Partial<AccessConnector> = {}) =>
    ({
      id: CONNECTOR_ID,
      organizationId: PAM_TEST_ORGANIZATION_ID,
      name: "edge\u001b[31m-1",
      status: "enabled",
      isConnected: true,
      lastHeartbeatAt: "2026-01-01T00:00:00Z",
      assignedTargetSystemIds: [TARGET_ID],
      creationDate: "2026-01-01T00:00:00Z",
      revisionDate: "2026-01-02T00:00:00Z",
      ...overrides,
    }) as unknown as AccessConnector;

  beforeEach(() => {
    jest.clearAllMocks();
    rotation.connectors.mockReturnValue(connectors);
    kit.pam.rotation.mockReturnValue(rotation);
    service = new ConnectorService(kit.pamSdkService);
  });

  it("lists connectors with sanitized names", async () => {
    connectors.list.mockResolvedValue([sdkConnector()]);

    const result = await service.list(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID);

    expect(connectors.list).toHaveBeenCalledWith(PAM_TEST_ORGANIZATION_ID);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("edge[31m-1");
    expect(result[0].assignedTargetSystemIds).toEqual([TARGET_ID]);
  });

  it("gets a connector and sanitizes the failure reason of the newest attempt", async () => {
    const detail = {
      connector: sdkConnector(),
      jobs: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          rotationConfigId: "66666666-6666-4666-8666-666666666666",
          source: "scheduled",
          status: "failed",
          createdAt: "2026-01-01T00:00:00Z",
          attempts: [
            { status: "abandoned" },
            {
              status: "errored",
              failureCode: "unknown",
              failureReason: "bad\u001b]0;x\u0007\nthing",
            },
          ],
        },
      ],
    } as unknown as AccessConnectorDetail;
    connectors.get.mockResolvedValue(detail);

    const result = await service.get(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, CONNECTOR_ID);

    expect(result.jobs[0].attemptCount).toBe(2);
    expect(result.jobs[0].latestAttemptStatus).toBe("errored");
    expect(result.jobs[0].latestFailureReason).toBe("bad]0;x thing");
  });

  it("refuses ids that are not GUIDs before calling the SDK", async () => {
    await expect(service.get(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, "nope")).rejects.toThrow(
      /connector id/,
    );
    await expect(
      service.assign(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, CONNECTOR_ID, "x"),
    ).rejects.toThrow(/target system id/);
    expect(connectors.get).not.toHaveBeenCalled();
    expect(connectors.assign_target).not.toHaveBeenCalled();
  });

  it("enables, disables, deletes, assigns and unassigns through the matching SDK calls", async () => {
    await service.enable(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, CONNECTOR_ID);
    await service.disable(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, CONNECTOR_ID);
    await service.delete(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, CONNECTOR_ID);
    await service.assign(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, CONNECTOR_ID, TARGET_ID);
    await service.unassign(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, CONNECTOR_ID, TARGET_ID);

    expect(connectors.enable).toHaveBeenCalledWith(PAM_TEST_ORGANIZATION_ID, CONNECTOR_ID);
    expect(connectors.disable).toHaveBeenCalledWith(PAM_TEST_ORGANIZATION_ID, CONNECTOR_ID);
    expect(connectors.delete).toHaveBeenCalledWith(PAM_TEST_ORGANIZATION_ID, CONNECTOR_ID);
    expect(connectors.assign_target).toHaveBeenCalledWith(
      PAM_TEST_ORGANIZATION_ID,
      CONNECTOR_ID,
      TARGET_ID,
    );
    expect(connectors.unassign_target).toHaveBeenCalledWith(
      PAM_TEST_ORGANIZATION_ID,
      CONNECTOR_ID,
      TARGET_ID,
    );
  });

  describe("register", () => {
    const registration = {
      id: CONNECTOR_ID,
      organizationId: PAM_TEST_ORGANIZATION_ID,
      name: "edge-1",
      status: "enabled",
      creationDate: "2026-01-01T00:00:00Z",
      token: TOKEN,
    } as unknown as AccessConnectorRegistrationResponse;

    it("returns the token to the caller and writes it to no log", async () => {
      connectors.register.mockResolvedValue(registration);

      const result = await service.register(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, "edge-1");

      expect(result.token).toBe(TOKEN);
      expect(connectors.register).toHaveBeenCalledWith(PAM_TEST_ORGANIZATION_ID, "edge-1");
      for (const level of ["error", "warning", "info", "debug", "write", "measure"] as const) {
        expect(JSON.stringify((kit.logService[level] as jest.Mock).mock.calls)).not.toContain(
          TOKEN,
        );
      }
      expect(kit.logService.error).not.toHaveBeenCalled();
      expect(kit.logService.info).not.toHaveBeenCalled();
      expect(kit.logService.debug).not.toHaveBeenCalled();
    });

    it("logs only the error kind, never the error text, when the call fails", async () => {
      connectors.register.mockRejectedValue(new Error("boom"));

      await expect(
        service.register(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, "edge-1"),
      ).rejects.toThrow("boom");

      expect(kit.logService.error).toHaveBeenCalledWith(
        "Privileged Controls SDK call failed: Error kind=unexpected",
      );
    });
  });
});
