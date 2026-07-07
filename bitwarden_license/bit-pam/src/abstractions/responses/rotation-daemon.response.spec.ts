import { DaemonStatus } from "../rotation";

import { RotationDaemonResponse } from "./rotation-daemon.response";

describe("RotationDaemonResponse", () => {
  describe("with a fully-populated enrolled daemon payload", () => {
    const raw = {
      Id: "daemon-uuid-1234",
      Name: "On-Prem Daemon 1",
      Status: DaemonStatus.Enrolled,
      IsConnected: true,
      AssignedTargetSystemIds: ["ts-uuid-aaaa", "ts-uuid-bbbb"],
    };

    let response: RotationDaemonResponse;

    beforeEach(() => {
      response = new RotationDaemonResponse(raw);
    });

    it("parses id", () => {
      expect(response.id).toBe("daemon-uuid-1234");
    });

    it("parses name", () => {
      expect(response.name).toBe("On-Prem Daemon 1");
    });

    it("parses status as DaemonStatus.Enrolled", () => {
      expect(response.status).toBe(DaemonStatus.Enrolled);
    });

    it("parses isConnected as true", () => {
      expect(response.isConnected).toBe(true);
    });

    it("parses assignments as an array of strings", () => {
      expect(response.assignments).toEqual(["ts-uuid-aaaa", "ts-uuid-bbbb"]);
    });
  });

  describe("with a revoked daemon with no assignments", () => {
    const raw: Record<string, unknown> = {
      Id: "daemon-uuid-5678",
      Name: "Revoked Daemon",
      Status: DaemonStatus.Revoked,
      IsConnected: false,
      AssignedTargetSystemIds: [],
    };

    let response: RotationDaemonResponse;

    beforeEach(() => {
      response = new RotationDaemonResponse(raw);
    });

    it("parses status as DaemonStatus.Revoked", () => {
      expect(response.status).toBe(DaemonStatus.Revoked);
    });

    it("parses isConnected as false", () => {
      expect(response.isConnected).toBe(false);
    });

    it("parses empty assignments array", () => {
      expect(response.assignments).toEqual([]);
    });
  });

  describe("with missing optional fields", () => {
    const raw = {
      Id: "daemon-uuid-9999",
      Name: "Minimal Daemon",
      Status: DaemonStatus.Enrolled,
      // IsConnected and AssignedTargetSystemIds absent
    };

    let response: RotationDaemonResponse;

    beforeEach(() => {
      response = new RotationDaemonResponse(raw);
    });

    it("defaults isConnected to false when absent", () => {
      expect(response.isConnected).toBe(false);
    });

    it("defaults assignments to empty array when absent", () => {
      expect(response.assignments).toEqual([]);
    });
  });

  describe("with non-string assignment ids (coercion)", () => {
    const raw = {
      Id: "daemon-uuid-coerce",
      Name: "Daemon With Numeric Ids",
      Status: DaemonStatus.Enrolled,
      IsConnected: false,
      AssignedTargetSystemIds: [123, 456],
    };

    it("coerces assignment ids to strings", () => {
      const response = new RotationDaemonResponse(raw);
      expect(response.assignments).toEqual(["123", "456"]);
    });
  });
});
