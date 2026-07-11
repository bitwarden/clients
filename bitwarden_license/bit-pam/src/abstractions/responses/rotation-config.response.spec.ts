import { TargetSystemMethod } from "../rotation";

import { RotationConfigResponse } from "./rotation-config.response";

describe("RotationConfigResponse", () => {
  describe("with a fully-populated Automatic config", () => {
    const raw = {
      Id: "config-uuid-1234",
      CipherId: "cipher-uuid-abcd",
      TargetSystemId: "ts-uuid-efgh",
      TargetSystemName: "Production Entra",
      TargetSystemMethod: TargetSystemMethod.Automatic,
      AccountIdentity: "svc-account@corp.example.com",
      TerminateSessions: true,
      ScheduleCron: "0 0 0 * * ?",
      RotateOnAccessEnd: true,
      Enabled: true,
      LastRotationAt: "2024-06-01T02:00:00Z",
      NextRotationAt: "2024-06-02T02:00:00Z",
      HasActiveJob: false,
      AwaitingManualRotation: false,
    };

    let response: RotationConfigResponse;

    beforeEach(() => {
      response = new RotationConfigResponse(raw);
    });

    it("parses id", () => {
      expect(response.id).toBe("config-uuid-1234");
    });

    it("parses cipherId", () => {
      expect(response.cipherId).toBe("cipher-uuid-abcd");
    });

    it("parses targetSystemId", () => {
      expect(response.targetSystemId).toBe("ts-uuid-efgh");
    });

    it("parses targetSystemName", () => {
      expect(response.targetSystemName).toBe("Production Entra");
    });

    it("parses targetSystemMethod as Automatic", () => {
      expect(response.targetSystemMethod).toBe(TargetSystemMethod.Automatic);
    });

    it("parses accountIdentity", () => {
      expect(response.accountIdentity).toBe("svc-account@corp.example.com");
    });

    it("parses terminateSessions as true", () => {
      expect(response.terminateSessions).toBe(true);
    });

    it("parses scheduleCron", () => {
      expect(response.scheduleCron).toBe("0 0 0 * * ?");
    });

    it("parses rotateOnAccessEnd as true", () => {
      expect(response.rotateOnAccessEnd).toBe(true);
    });

    it("parses enabled as true", () => {
      expect(response.enabled).toBe(true);
    });

    it("parses lastRotationAt", () => {
      expect(response.lastRotationAt).toBe("2024-06-01T02:00:00Z");
    });

    it("parses nextRotationAt", () => {
      expect(response.nextRotationAt).toBe("2024-06-02T02:00:00Z");
    });

    it("parses hasActiveJob as false", () => {
      expect(response.hasActiveJob).toBe(false);
    });

    it("parses awaitingManualRotation as false", () => {
      expect(response.awaitingManualRotation).toBe(false);
    });
  });

  describe("with a paused Manual config that has never rotated", () => {
    const raw: Record<string, unknown> = {
      Id: "config-uuid-5678",
      CipherId: "cipher-uuid-wxyz",
      TargetSystemId: "ts-uuid-manual",
      TargetSystemName: "Legacy DB",
      TargetSystemMethod: TargetSystemMethod.Manual,
      AccountIdentity: "dbadmin",
      TerminateSessions: false,
      ScheduleCron: null,
      RotateOnAccessEnd: false,
      Enabled: false,
      LastRotationAt: null,
      NextRotationAt: null,
      HasActiveJob: false,
      AwaitingManualRotation: true,
    };

    let response: RotationConfigResponse;

    beforeEach(() => {
      response = new RotationConfigResponse(raw);
    });

    it("parses targetSystemMethod as Manual", () => {
      expect(response.targetSystemMethod).toBe(TargetSystemMethod.Manual);
    });

    it("parses enabled as false (paused)", () => {
      expect(response.enabled).toBe(false);
    });

    it("parses scheduleCron as null", () => {
      expect(response.scheduleCron).toBeNull();
    });

    it("parses lastRotationAt as null", () => {
      expect(response.lastRotationAt).toBeNull();
    });

    it("parses nextRotationAt as null", () => {
      expect(response.nextRotationAt).toBeNull();
    });

    it("parses awaitingManualRotation as true", () => {
      expect(response.awaitingManualRotation).toBe(true);
    });
  });

  describe("with missing optional fields", () => {
    const raw = {
      Id: "config-uuid-minimal",
      CipherId: "cipher-uuid-min",
      TargetSystemId: "ts-uuid-min",
      TargetSystemName: "Minimal System",
      TargetSystemMethod: TargetSystemMethod.Automatic,
      AccountIdentity: "svc",
      RotateOnAccessEnd: false,
      // TerminateSessions, ScheduleCron, Enabled, LastRotationAt, NextRotationAt,
      // HasActiveJob, AwaitingManualRotation all absent
    };

    let response: RotationConfigResponse;

    beforeEach(() => {
      response = new RotationConfigResponse(raw);
    });

    it("defaults terminateSessions to false when absent", () => {
      expect(response.terminateSessions).toBe(false);
    });

    it("defaults scheduleCron to null when absent", () => {
      expect(response.scheduleCron).toBeNull();
    });

    it("defaults enabled to true when absent", () => {
      expect(response.enabled).toBe(true);
    });

    it("defaults lastRotationAt to null when absent", () => {
      expect(response.lastRotationAt).toBeNull();
    });

    it("defaults nextRotationAt to null when absent", () => {
      expect(response.nextRotationAt).toBeNull();
    });

    it("defaults hasActiveJob to false when absent", () => {
      expect(response.hasActiveJob).toBe(false);
    });

    it("defaults awaitingManualRotation to false when absent", () => {
      expect(response.awaitingManualRotation).toBe(false);
    });
  });
});
