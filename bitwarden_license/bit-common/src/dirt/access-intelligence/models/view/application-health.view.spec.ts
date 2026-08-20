import {
  createMemberRegistry,
  createReport,
} from "../../../reports/risk-insights/testing/test-helpers";
import { ApplicationHealthData } from "../data/application-health.data";

import { ApplicationHealthView } from "./application-health.view";

describe("ApplicationHealthView", () => {
  // Test helpers imported from shared testing utilities

  // Local helper with specific signature for this test file
  const createReportWithCounts = (
    memberRefs: Record<string, boolean>,
    cipherRefs: Record<string, boolean>,
    atRiskPasswordCount: number,
  ): ApplicationHealthView => {
    const report = createReport("test-app", memberRefs, cipherRefs);
    report.atRiskPasswordCount = atRiskPasswordCount; // Override if needed
    return report;
  };

  // ==================== Member Methods ====================

  describe("getAllMembers", () => {
    it("should return all members for the application", () => {
      const registry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
        { id: "u2", name: "Bob", email: "bob@example.com" },
        { id: "u3", name: "Charlie", email: "charlie@example.com" },
      ]);

      const report = createReportWithCounts({ u1: true, u2: false }, {}, 0);

      const members = report.getAllMembers(registry);

      expect(members).toHaveLength(2);
      expect(members.map((m) => m.id).sort()).toEqual(["u1", "u2"]);
    });

    it("should filter out members not in registry", () => {
      const registry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);

      const report = createReportWithCounts({ u1: true, u999: false }, {}, 0);

      const members = report.getAllMembers(registry);

      expect(members).toHaveLength(1);
      expect(members[0].id).toBe("u1");
    });

    it("should return empty array when no members", () => {
      const registry = createMemberRegistry([]);
      const report = createReportWithCounts({}, {}, 0);

      const members = report.getAllMembers(registry);

      expect(members).toHaveLength(0);
    });
  });

  describe("getAtRiskMembers", () => {
    it("should return only at-risk members", () => {
      const registry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
        { id: "u2", name: "Bob", email: "bob@example.com" },
        { id: "u3", name: "Charlie", email: "charlie@example.com" },
      ]);

      const report = createReportWithCounts({ u1: true, u2: false, u3: true }, {}, 0);

      const atRiskMembers = report.getAtRiskMembers(registry);

      expect(atRiskMembers).toHaveLength(2);
      expect(atRiskMembers.map((m) => m.id).sort()).toEqual(["u1", "u3"]);
    });

    it("should filter out members not in registry", () => {
      const registry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);

      const report = createReportWithCounts({ u1: true, u999: true }, {}, 0);

      const atRiskMembers = report.getAtRiskMembers(registry);

      expect(atRiskMembers).toHaveLength(1);
      expect(atRiskMembers[0].id).toBe("u1");
    });

    it("should return empty array when no at-risk members", () => {
      const registry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);

      const report = createReportWithCounts({ u1: false }, {}, 0);

      const atRiskMembers = report.getAtRiskMembers(registry);

      expect(atRiskMembers).toHaveLength(0);
    });
  });

  describe("hasMember", () => {
    it("should return true if member has access", () => {
      const report = createReportWithCounts({ u1: true, u2: false }, {}, 0);

      expect(report.hasMember("u1")).toBe(true);
      expect(report.hasMember("u2")).toBe(true);
    });

    it("should return false if member does not have access", () => {
      const report = createReportWithCounts({ u1: true }, {}, 0);

      expect(report.hasMember("u999")).toBe(false);
    });
  });

  describe("isMemberAtRisk", () => {
    it("should return true if member is at-risk", () => {
      const report = createReportWithCounts({ u1: true, u2: false }, {}, 0);

      expect(report.isMemberAtRisk("u1")).toBe(true);
    });

    it("should return false if member is not at-risk", () => {
      const report = createReportWithCounts({ u1: true, u2: false }, {}, 0);

      expect(report.isMemberAtRisk("u2")).toBe(false);
    });

    it("should return false if member does not have access", () => {
      const report = createReportWithCounts({ u1: true }, {}, 0);

      expect(report.isMemberAtRisk("u999")).toBe(false);
    });
  });

  // ==================== Cipher Methods ====================

  describe("getAllCipherIds", () => {
    it("should return all cipher IDs", () => {
      const report = createReportWithCounts({}, { c1: true, c2: false, c3: true }, 2);

      const cipherIds = report.getAllCipherIds();

      expect(cipherIds).toHaveLength(3);
      expect(cipherIds.sort()).toEqual(["c1", "c2", "c3"]);
    });

    it("should return empty array when no ciphers", () => {
      const report = createReportWithCounts({}, {}, 0);

      const cipherIds = report.getAllCipherIds();

      expect(cipherIds).toHaveLength(0);
    });
  });

  describe("getAtRiskCipherIds", () => {
    it("should return only at-risk cipher IDs", () => {
      const report = createReportWithCounts({}, { c1: true, c2: false, c3: true }, 2);

      const atRiskCipherIds = report.getAtRiskCipherIds();

      expect(atRiskCipherIds).toHaveLength(2);
      expect(atRiskCipherIds.sort()).toEqual(["c1", "c3"]);
    });

    it("should return empty array when no at-risk ciphers", () => {
      const report = createReportWithCounts({}, { c1: false, c2: false }, 0);

      const atRiskCipherIds = report.getAtRiskCipherIds();

      expect(atRiskCipherIds).toHaveLength(0);
    });
  });

  // ==================== At-Risk Check ====================

  describe("isAtRisk", () => {
    it("should return true when application has at-risk passwords", () => {
      const report = createReportWithCounts({}, { c1: true }, 1);

      expect(report.isAtRisk()).toBe(true);
    });

    it("should return false when application has no at-risk passwords", () => {
      const report = createReportWithCounts({}, { c1: false }, 0);

      expect(report.isAtRisk()).toBe(false);
    });

    it("should return false when atRiskPasswordCount is 0", () => {
      const report = new ApplicationHealthView();
      report.atRiskPasswordCount = 0;

      expect(report.isAtRisk()).toBe(false);
    });
  });

  // ==================== Factory Methods ====================

  describe("fromData", () => {
    it("should map all standard fields from ApplicationHealthData", () => {
      const data = new ApplicationHealthData();
      data.applicationName = "github.com";
      data.passwordCount = 10;
      data.atRiskPasswordCount = 3;
      data.memberRefs = { u1: true, u2: false };
      data.cipherRefs = { c1: true, c2: false, c3: false };
      data.memberCount = 2;
      data.atRiskMemberCount = 1;

      const view = ApplicationHealthView.fromData(data);

      expect(view).toBeInstanceOf(ApplicationHealthView);
      expect(view.applicationName).toBe("github.com");
      expect(view.passwordCount).toBe(10);
      expect(view.atRiskPasswordCount).toBe(3);
      expect(view.memberRefs).toEqual({ u1: true, u2: false });
      expect(view.cipherRefs).toEqual({ c1: true, c2: false, c3: false });
      expect(view.memberCount).toBe(2);
      expect(view.atRiskMemberCount).toBe(1);
    });

    it("should create independent copies of memberRefs and cipherRefs", () => {
      const data = new ApplicationHealthData();
      data.memberRefs = { u1: true };
      data.cipherRefs = { c1: false };

      const view = ApplicationHealthView.fromData(data);

      // Mutating the view should not affect the source data
      view.memberRefs["u2"] = false;
      view.cipherRefs["c2"] = true;

      expect(data.memberRefs).not.toHaveProperty("u2");
      expect(data.cipherRefs).not.toHaveProperty("c2");
    });

    it("should set optional icon fields when provided", () => {
      const data = new ApplicationHealthData();
      data.applicationName = "app.com";
      data.iconUri = "https://icons.example.com/app.ico";
      data.iconCipherId = "cipher-123";

      const view = ApplicationHealthView.fromData(data);

      expect(view.iconUri).toBe("https://icons.example.com/app.ico");
      expect(view.iconCipherId).toBe("cipher-123");
    });

    it("should leave icon fields undefined when not set on data", () => {
      const data = new ApplicationHealthData();
      data.applicationName = "app.com";

      const view = ApplicationHealthView.fromData(data);

      expect(view.iconUri).toBeUndefined();
      expect(view.iconCipherId).toBeUndefined();
    });
  });

  // ==================== Serialization ====================

  describe("fromJSON", () => {
    it("should initialize from JSON object", () => {
      const json = {
        applicationName: "github.com",
        passwordCount: 10,
        atRiskPasswordCount: 3,
        memberRefs: { u1: true, u2: false },
        cipherRefs: { c1: true, c2: false },
        memberCount: 2,
        atRiskMemberCount: 1,
      };

      const report = ApplicationHealthView.fromJSON(json);

      expect(report).toBeInstanceOf(ApplicationHealthView);
      expect(report.applicationName).toBe("github.com");
      expect(report.passwordCount).toBe(10);
      expect(report.atRiskPasswordCount).toBe(3);
      expect(report.memberRefs).toEqual({ u1: true, u2: false });
      expect(report.cipherRefs).toEqual({ c1: true, c2: false });
      expect(report.memberCount).toBe(2);
      expect(report.atRiskMemberCount).toBe(1);
    });

    it("should handle undefined input", () => {
      const report = ApplicationHealthView.fromJSON(undefined);

      expect(report).toBeInstanceOf(ApplicationHealthView);
      expect(report.applicationName).toBe("");
      expect(report.memberRefs).toEqual({});
      expect(report.cipherRefs).toEqual({});
    });

    it("should ensure memberRefs and cipherRefs are objects when missing", () => {
      const json = {
        applicationName: "github.com",
      };

      const report = ApplicationHealthView.fromJSON(json);

      expect(report.memberRefs).toEqual({});
      expect(report.cipherRefs).toEqual({});
    });
  });

  // ==================== Constructor ====================

  describe("constructor", () => {
    it("should create empty report when no parameter provided", () => {
      const report = new ApplicationHealthView();

      expect(report.applicationName).toBe("");
      expect(report.passwordCount).toBe(0);
      expect(report.atRiskPasswordCount).toBe(0);
      expect(report.memberRefs).toEqual({});
      expect(report.cipherRefs).toEqual({});
      expect(report.memberCount).toBe(0);
      expect(report.atRiskMemberCount).toBe(0);
    });

    it("should create report with domain model parameter", () => {
      const report = new ApplicationHealthView(null as any);

      expect(report).toBeInstanceOf(ApplicationHealthView);
    });
  });
});
