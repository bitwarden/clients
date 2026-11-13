import { RotationRowStatus } from "./managed-credentials/rotation-config-row";
import { connectorStateFor, resolveDetailStatus } from "./rotation-detail-status";
import {
  TARGET_SYSTEM_ID,
  accessConnector,
  attemptId,
  rotationAttempt,
  rotationConfig,
  rotationJob,
  sysId,
} from "./testing/rotation-builders";

describe("connectorStateFor", () => {
  const assigned = { assignedTargetSystemIds: [TARGET_SYSTEM_ID] };

  it("is unknown when the connectors could not be read", () => {
    expect(connectorStateFor(null, TARGET_SYSTEM_ID)).toBe("unknown");
  });

  it("is none-assigned when no connector lists the target", () => {
    expect(connectorStateFor([accessConnector()], TARGET_SYSTEM_ID)).toBe("none-assigned");
    expect(connectorStateFor([accessConnector(assigned)], sysId("other"))).toBe("none-assigned");
  });

  it("is connected when any assigned connector is enabled and connected", () => {
    expect(
      connectorStateFor(
        [accessConnector({ ...assigned, isConnected: false }), accessConnector(assigned)],
        TARGET_SYSTEM_ID,
      ),
    ).toBe("connected");
  });

  it("is all-disconnected when every assigned connector is down or disabled", () => {
    expect(
      connectorStateFor(
        [
          accessConnector({ ...assigned, isConnected: false }),
          accessConnector({ ...assigned, status: "disabled" }),
        ],
        TARGET_SYSTEM_ID,
      ),
    ).toBe("all-disconnected");
  });
});

describe("resolveDetailStatus", () => {
  const resolve = (
    overrides: Parameters<typeof rotationConfig>[0] = {},
    jobs = [rotationJob()],
    connectors: Parameters<typeof resolveDetailStatus>[2] = "connected",
  ) => resolveDetailStatus(rotationConfig(overrides), jobs, connectors);

  it("is Active for an idle, connected credential", () => {
    expect(resolve().status).toBe(RotationRowStatus.Active);
    expect(resolve().callout).toBeNull();
  });

  it("is Rotating with no callout until an attempt on the running job fails", () => {
    const clean = resolve({ hasActiveJob: true }, [
      rotationJob({ status: "claimed", attempts: [rotationAttempt({ status: "executing" })] }),
    ]);
    expect(clean.status).toBe(RotationRowStatus.Rotating);
    expect(clean.callout).toBeNull();

    const retrying = resolve({ hasActiveJob: true }, [
      rotationJob({
        status: "claimed",
        attempts: [
          rotationAttempt({ status: "errored" }),
          rotationAttempt({ id: attemptId("2"), status: "executing" }),
        ],
      }),
    ]);
    expect(retrying.callout).toEqual({ kind: "retrying" });
  });

  it("puts Rotating ahead of Paused", () => {
    expect(resolve({ hasActiveJob: true, enabled: false }).status).toBe(RotationRowStatus.Rotating);
  });

  it("puts Paused ahead of Not connected", () => {
    const status = resolve({ enabled: false }, [], "all-disconnected");
    expect(status.status).toBe(RotationRowStatus.Paused);
    expect(status.callout).toEqual({ kind: "paused" });
  });

  it("is Not connected for an automatic target with no usable connector", () => {
    expect(resolve({}, [], "none-assigned").callout).toEqual({ kind: "no-connector" });
    expect(resolve({}, [], "all-disconnected").callout).toEqual({ kind: "disconnected" });
    expect(resolve({}, [], "unknown").status).toBe(RotationRowStatus.Active);
  });

  it("never calls a manual credential Not connected", () => {
    expect(resolve({ targetSystemMethod: "manual" }, [], "none-assigned").status).toBe(
      RotationRowStatus.Active,
    );
  });

  it("is Failed when the most recent job failed, with a callout only for a timeout", () => {
    const old = rotationJob({ status: "succeeded", createdAt: "2026-01-01T00:00:00Z" });
    const timedOut = rotationJob({ status: "timed_out", createdAt: "2026-02-01T00:00:00Z" });
    const failed = rotationJob({ status: "failed", createdAt: "2026-02-01T00:00:00Z" });

    expect(resolve({}, [old, timedOut])).toMatchObject({
      status: RotationRowStatus.Failed,
      callout: { kind: "timed-out" },
    });
    expect(resolve({}, [old, failed])).toMatchObject({
      status: RotationRowStatus.Failed,
      callout: null,
    });
  });

  it("recovers once a later job succeeds", () => {
    const failed = rotationJob({ status: "failed", createdAt: "2026-01-01T00:00:00Z" });
    const later = rotationJob({ status: "succeeded", createdAt: "2026-02-01T00:00:00Z" });
    expect(resolve({}, [failed, later]).status).toBe(RotationRowStatus.Active);
  });

  it("puts Not connected ahead of Failed", () => {
    const failed = rotationJob({ status: "failed" });
    expect(resolve({}, [failed], "none-assigned").status).toBe(RotationRowStatus.NotConnected);
  });

  it("is Rotation due for a manual credential awaiting rotation", () => {
    expect(
      resolve({ targetSystemMethod: "manual", awaitingManualRotation: true }, []),
    ).toMatchObject({ status: RotationRowStatus.RotationDue, callout: { kind: "due" } });
  });
});
