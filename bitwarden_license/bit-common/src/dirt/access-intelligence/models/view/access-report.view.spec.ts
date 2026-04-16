import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";

import {
  createApplication,
  createMemberRegistry,
  createReport,
  createRiskInsights,
  createRiskInsightsSummary,
} from "../../../reports/risk-insights/testing/test-helpers";

import { AccessReportSettingsView } from "./access-report-settings.view";
import { AccessReportView } from "./access-report.view";
import { ApplicationHealthView } from "./application-health.view";
import { MemberRegistryEntryView } from "./member-registry-entry.view";

describe("AccessReportView", () => {
  // ==================== Constructor Tests ====================

  describe("constructor", () => {
    it("should create empty view when no parameter provided", () => {
      const view = new AccessReportView();

      expect(view.id).toBe("");
      expect(view.organizationId).toBe("");
      expect(view.reports).toEqual([]);
      expect(view.applications).toEqual([]);
      expect(view.memberRegistry).toEqual({});
      expect(view.creationDate).toBeInstanceOf(Date);
    });

    it("should initialize from domain model", () => {
      const mockDomain = {
        id: "report-123" as OrganizationReportId,
        organizationId: "org-456" as OrganizationId,
        creationDate: new Date("2024-01-15"),
        contentEncryptionKey: undefined,
      } as any;

      const view = new AccessReportView(mockDomain);

      expect(view.id).toBe("report-123");
      expect(view.organizationId).toBe("org-456");
      expect(view.creationDate).toEqual(new Date("2024-01-15"));
    });
  });

  // ==================== Query Methods ====================

  describe("getAtRiskMembers", () => {
    it("should return all unique at-risk members across applications", () => {
      const view = new AccessReportView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
        { id: "u2", name: "Bob", email: "bob@example.com" },
        { id: "u3", name: "Charlie", email: "charlie@example.com" },
      ]);

      view.reports = [
        createReport("github.com", { u1: true, u2: false }, {}),
        createReport("gitlab.com", { u1: true, u3: true }, {}),
      ];

      const atRiskMembers = view.getAtRiskMembers();

      expect(atRiskMembers).toHaveLength(2);
      expect(atRiskMembers.map((m) => m.id).sort()).toEqual(["u1", "u3"]);
    });

    it("should deduplicate members appearing in multiple applications", () => {
      const view = new AccessReportView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);

      view.reports = [
        createReport("github.com", { u1: true }, {}),
        createReport("gitlab.com", { u1: true }, {}),
        createReport("bitbucket.com", { u1: true }, {}),
      ];

      const atRiskMembers = view.getAtRiskMembers();

      expect(atRiskMembers).toHaveLength(1);
      expect(atRiskMembers[0].id).toBe("u1");
    });

    it("should return empty array when no at-risk members exist", () => {
      const view = new AccessReportView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);

      view.reports = [createReport("github.com", { u1: false }, {})];

      const atRiskMembers = view.getAtRiskMembers();

      expect(atRiskMembers).toHaveLength(0);
    });

    it("should filter out members not in registry", () => {
      const view = new AccessReportView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);

      view.reports = [createReport("github.com", { u1: true, u999: true }, {})];

      const atRiskMembers = view.getAtRiskMembers();

      expect(atRiskMembers).toHaveLength(1);
      expect(atRiskMembers[0].id).toBe("u1");
    });
  });

  describe("getCriticalApplications", () => {
    it("should return only critical application reports", () => {
      const view = new AccessReportView();
      view.applications = [
        createApplication("github.com", true),
        createApplication("gitlab.com", false),
        createApplication("bitbucket.com", true),
      ];

      view.reports = [
        createReport("github.com", {}, {}),
        createReport("gitlab.com", {}, {}),
        createReport("bitbucket.com", {}, {}),
      ];

      const criticalApps = view.getCriticalApplications();

      expect(criticalApps).toHaveLength(2);
      expect(criticalApps.map((r) => r.applicationName).sort()).toEqual([
        "bitbucket.com",
        "github.com",
      ]);
    });

    it("should return empty array when no critical applications exist", () => {
      const view = new AccessReportView();
      view.applications = [createApplication("github.com", false)];
      view.reports = [createReport("github.com", {}, {})];

      const criticalApps = view.getCriticalApplications();

      expect(criticalApps).toHaveLength(0);
    });
  });

  describe("getNewApplications", () => {
    it("should return only unreviewed applications", () => {
      const view = new AccessReportView();
      view.applications = [
        createApplication("github.com", false, new Date("2024-01-15")),
        createApplication("gitlab.com", false, undefined),
        createApplication("bitbucket.com", false, undefined),
      ];

      view.reports = [
        createReport("github.com", {}, {}),
        createReport("gitlab.com", {}, {}),
        createReport("bitbucket.com", {}, {}),
      ];

      const newApps = view.getNewApplications();

      expect(newApps).toHaveLength(2);
      expect(newApps.map((r) => r.applicationName).sort()).toEqual(["bitbucket.com", "gitlab.com"]);
    });

    it("should return empty array when all applications are reviewed", () => {
      const view = new AccessReportView();
      view.applications = [createApplication("github.com", false, new Date())];
      view.reports = [createReport("github.com", {}, {})];

      const newApps = view.getNewApplications();

      expect(newApps).toHaveLength(0);
    });
  });

  describe("getApplicationByName", () => {
    it("should find application by exact name match", () => {
      const view = new AccessReportView();
      view.reports = [createReport("github.com", {}, {}), createReport("gitlab.com", {}, {})];

      const app = view.getApplicationByName("github.com");

      expect(app).toBeDefined();
      expect(app?.applicationName).toBe("github.com");
    });

    it("should return undefined when application not found", () => {
      const view = new AccessReportView();
      view.reports = [createReport("github.com", {}, {})];

      const app = view.getApplicationByName("gitlab.com");

      expect(app).toBeUndefined();
    });
  });

  describe("getTotalMemberCount", () => {
    it("should return count of members in registry", () => {
      const view = new AccessReportView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
        { id: "u2", name: "Bob", email: "bob@example.com" },
        { id: "u3", name: "Charlie", email: "charlie@example.com" },
      ]);

      expect(view.getTotalMemberCount()).toBe(3);
    });

    it("should return 0 when registry is empty", () => {
      const view = new AccessReportView();
      view.memberRegistry = {};

      expect(view.getTotalMemberCount()).toBe(0);
    });
  });

  describe("getAtRiskPasswordCountForMember", () => {
    it("should count at-risk passwords for member across all applications", () => {
      const view = new AccessReportView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);

      view.reports = [
        createReport("github.com", { u1: true }, { c1: true, c2: true }), // 2 at-risk
        createReport("gitlab.com", { u1: true }, { c3: true, c4: false }), // 1 at-risk
        createReport("bitbucket.com", { u1: false }, { c5: true }), // Not at-risk, should not count
      ];

      const count = view.getAtRiskPasswordCountForMember("u1");

      expect(count).toBe(3); // 2 from github + 1 from gitlab
    });

    it("should return 0 when member is not at-risk in any application", () => {
      const view = new AccessReportView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);

      view.reports = [
        createReport("github.com", { u1: false }, { c1: true }), // Not at-risk
        createReport("gitlab.com", { u1: false }, { c2: true }), // Not at-risk
      ];

      const count = view.getAtRiskPasswordCountForMember("u1");

      expect(count).toBe(0);
    });

    it("should count passwords for specific application when applicationName provided", () => {
      const view = new AccessReportView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);

      view.reports = [
        createReport("github.com", { u1: true }, { c1: true, c2: true, c3: true }), // 3 at-risk
        createReport("gitlab.com", { u1: true }, { c4: true }), // 1 at-risk
      ];

      const count = view.getAtRiskPasswordCountForMember("u1", "github.com");

      expect(count).toBe(3); // Only github.com
    });

    it("should return 0 when member not at-risk in specific application", () => {
      const view = new AccessReportView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);

      view.reports = [
        createReport("github.com", { u1: false }, { c1: true, c2: true }), // Not at-risk
        createReport("gitlab.com", { u1: true }, { c3: true }), // At-risk
      ];

      const count = view.getAtRiskPasswordCountForMember("u1", "github.com");

      expect(count).toBe(0); // Not at-risk in github
    });

    it("should return 0 when application not found", () => {
      const view = new AccessReportView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);

      view.reports = [createReport("github.com", { u1: true }, { c1: true })];

      const count = view.getAtRiskPasswordCountForMember("u1", "nonexistent.com");

      expect(count).toBe(0);
    });

    it("should return 0 when member not in any application", () => {
      const view = new AccessReportView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);

      view.reports = [createReport("github.com", { u2: true }, { c1: true })];

      const count = view.getAtRiskPasswordCountForMember("u1");

      expect(count).toBe(0);
    });
  });

  // ==================== Update Methods ====================

  describe("markApplicationsAsCritical", () => {
    it("should mark existing application as critical", () => {
      const view = new AccessReportView();
      view.applications = [createApplication("github.com", false)];
      view.reports = [createReport("github.com", {}, {})];

      view.markApplicationsAsCritical(["github.com"]);

      const app = view.applications.find((a) => a.applicationName === "github.com");
      expect(app?.isCritical).toBe(true);
    });

    it("should add new application if not in list", () => {
      const view = new AccessReportView();
      view.applications = [];

      view.markApplicationsAsCritical(["github.com"]);

      expect(view.applications).toHaveLength(1);
      expect(view.applications[0].applicationName).toBe("github.com");
      expect(view.applications[0].isCritical).toBe(true);
    });

    it("should trigger summary recomputation once for multiple apps", () => {
      const view = new AccessReportView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);
      view.reports = [
        createReport("github.com", { u1: true }, { c1: true }),
        createReport("gitlab.com", { u1: true }, { c2: true }),
      ];
      view.applications = [
        createApplication("github.com", false),
        createApplication("gitlab.com", false),
      ];

      view.markApplicationsAsCritical(["github.com", "gitlab.com"]);

      expect(view.summary.totalCriticalApplicationCount).toBe(2);
    });
  });

  describe("unmarkApplicationsAsCritical", () => {
    it("should unmark existing application as critical", () => {
      const view = new AccessReportView();
      view.applications = [createApplication("github.com", true)];
      view.reports = [createReport("github.com", {}, {})];

      view.unmarkApplicationsAsCritical(["github.com"]);

      const app = view.applications.find((a) => a.applicationName === "github.com");
      expect(app?.isCritical).toBe(false);
    });

    it("should unmark multiple applications in a single operation", () => {
      const view = new AccessReportView();
      view.applications = [
        createApplication("github.com", true),
        createApplication("gitlab.com", true),
      ];
      view.reports = [createReport("github.com", {}, {}), createReport("gitlab.com", {}, {})];

      view.unmarkApplicationsAsCritical(["github.com", "gitlab.com"]);

      expect(view.applications.find((a) => a.applicationName === "github.com")?.isCritical).toBe(
        false,
      );
      expect(view.applications.find((a) => a.applicationName === "gitlab.com")?.isCritical).toBe(
        false,
      );
    });

    it("should trigger summary recomputation when application exists", () => {
      const view = new AccessReportView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);
      view.reports = [createReport("github.com", { u1: true }, { c1: true })];
      view.applications = [createApplication("github.com", true)];

      view.unmarkApplicationsAsCritical(["github.com"]);

      expect(view.summary.totalCriticalApplicationCount).toBe(0);
    });

    it("should do nothing if application not found", () => {
      const view = new AccessReportView();
      view.applications = [];

      view.unmarkApplicationsAsCritical(["github.com"]);

      expect(view.applications).toHaveLength(0);
    });
  });

  describe("markApplicationAsReviewed", () => {
    it("should mark existing application as reviewed with current date", () => {
      const view = new AccessReportView();
      view.applications = [createApplication("github.com", false)];

      const beforeDate = new Date();
      view.markApplicationAsReviewed("github.com");
      const afterDate = new Date();

      const app = view.applications.find((a) => a.applicationName === "github.com");
      expect(app?.reviewedDate).toBeDefined();
      expect(app!.reviewedDate!.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
      expect(app!.reviewedDate!.getTime()).toBeLessThanOrEqual(afterDate.getTime());
    });

    it("should mark application with specific date", () => {
      const view = new AccessReportView();
      view.applications = [createApplication("github.com", false)];

      const specificDate = new Date("2024-01-15");
      view.markApplicationAsReviewed("github.com", specificDate);

      const app = view.applications.find((a) => a.applicationName === "github.com");
      expect(app?.reviewedDate).toEqual(specificDate);
    });

    it("should add new application if not in list", () => {
      const view = new AccessReportView();
      view.applications = [];

      view.markApplicationAsReviewed("github.com");

      expect(view.applications).toHaveLength(1);
      expect(view.applications[0].applicationName).toBe("github.com");
      expect(view.applications[0].reviewedDate).toBeDefined();
    });

    it("should not trigger summary recomputation", () => {
      const view = new AccessReportView();
      view.applications = [createApplication("github.com", false)];

      // Manually set summary to verify it doesn't change
      view.summary.totalApplicationCount = 99;

      view.markApplicationAsReviewed("github.com");

      // Summary should remain unchanged
      expect(view.summary.totalApplicationCount).toBe(99);
    });
  });

  // ==================== Computation Methods ====================

  describe("recomputeSummary", () => {
    it("should compute total counts correctly", () => {
      const view = new AccessReportView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
        { id: "u2", name: "Bob", email: "bob@example.com" },
      ]);

      view.reports = [
        createReport("github.com", { u1: true, u2: false }, { c1: true, c2: false }),
        createReport("gitlab.com", { u2: false }, { c3: false }),
      ];

      view.applications = [];

      view.recomputeSummary();

      expect(view.summary.totalMemberCount).toBe(2);
      expect(view.summary.totalApplicationCount).toBe(2);
      expect(view.summary.totalAtRiskApplicationCount).toBe(1); // github.com has at-risk cipher
      expect(view.summary.totalAtRiskMemberCount).toBe(1); // u1
    });

    it("should deduplicate at-risk members across applications", () => {
      const view = new AccessReportView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);

      view.reports = [
        createReport("github.com", { u1: true }, { c1: true }),
        createReport("gitlab.com", { u1: true }, { c2: true }),
      ];

      view.applications = [];

      view.recomputeSummary();

      expect(view.summary.totalAtRiskMemberCount).toBe(1); // u1 counted once
    });

    it("should compute critical application counts", () => {
      const view = new AccessReportView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
        { id: "u2", name: "Bob", email: "bob@example.com" },
      ]);

      view.reports = [
        createReport("github.com", { u1: true }, { c1: true }),
        createReport("gitlab.com", { u2: false }, { c2: false }),
      ];

      view.applications = [
        createApplication("github.com", true),
        createApplication("gitlab.com", true),
      ];

      view.recomputeSummary();

      expect(view.summary.totalCriticalApplicationCount).toBe(2);
      expect(view.summary.totalCriticalAtRiskApplicationCount).toBe(1); // github.com
      expect(view.summary.totalCriticalMemberCount).toBe(2); // u1 and u2
      expect(view.summary.totalCriticalAtRiskMemberCount).toBe(1); // u1
    });

    it("should handle empty reports and applications", () => {
      const view = new AccessReportView();
      view.memberRegistry = {};
      view.reports = [];
      view.applications = [];

      view.recomputeSummary();

      expect(view.summary.totalMemberCount).toBe(0);
      expect(view.summary.totalApplicationCount).toBe(0);
      expect(view.summary.totalAtRiskApplicationCount).toBe(0);
      expect(view.summary.totalAtRiskMemberCount).toBe(0);
      expect(view.summary.totalCriticalApplicationCount).toBe(0);
      expect(view.summary.totalCriticalAtRiskApplicationCount).toBe(0);
      expect(view.summary.totalCriticalMemberCount).toBe(0);
      expect(view.summary.totalCriticalAtRiskMemberCount).toBe(0);
    });
  });

  describe("toMetrics", () => {
    it("should compute complete metrics including password counts", () => {
      const view = new AccessReportView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
        { id: "u2", name: "Bob", email: "bob@example.com" },
      ]);

      view.reports = [
        createReport("github.com", { u1: true }, { c1: true, c2: false, c3: true }), // 3 passwords, 2 at-risk
        createReport("gitlab.com", { u2: false }, { c4: false, c5: false }), // 2 passwords, 0 at-risk
      ];

      view.applications = [
        createApplication("github.com", true), // Critical
        createApplication("gitlab.com", false), // Not critical
      ];

      view.recomputeSummary(); // Compute summary first

      const metrics = view.toMetrics();

      // Summary counts (copied from summary)
      expect(metrics.totalMemberCount).toBe(2);
      expect(metrics.totalAtRiskMemberCount).toBe(1); // u1
      expect(metrics.totalApplicationCount).toBe(2);
      expect(metrics.totalAtRiskApplicationCount).toBe(1); // github.com
      expect(metrics.totalCriticalApplicationCount).toBe(1); // github.com
      expect(metrics.totalCriticalAtRiskApplicationCount).toBe(1); // github.com
      expect(metrics.totalCriticalMemberCount).toBe(1); // u1
      expect(metrics.totalCriticalAtRiskMemberCount).toBe(1); // u1

      // Password counts (computed from reports)
      expect(metrics.totalPasswordCount).toBe(5); // 3 + 2
      expect(metrics.totalAtRiskPasswordCount).toBe(2); // 2 + 0
      expect(metrics.totalCriticalPasswordCount).toBe(3); // github.com only
      expect(metrics.totalCriticalAtRiskPasswordCount).toBe(2); // github.com at-risk only
    });

    it("should compute metrics with no critical applications", () => {
      const view = new AccessReportView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);

      view.reports = [
        createReport("github.com", { u1: true }, { c1: true, c2: true }), // 2 passwords, 2 at-risk
      ];

      view.applications = [
        createApplication("github.com", false), // Not critical
      ];

      view.recomputeSummary();

      const metrics = view.toMetrics();

      expect(metrics.totalPasswordCount).toBe(2);
      expect(metrics.totalAtRiskPasswordCount).toBe(2);
      expect(metrics.totalCriticalPasswordCount).toBe(0); // No critical apps
      expect(metrics.totalCriticalAtRiskPasswordCount).toBe(0); // No critical apps
    });

    it("should compute metrics with all critical applications", () => {
      const view = new AccessReportView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
        { id: "u2", name: "Bob", email: "bob@example.com" },
      ]);

      view.reports = [
        createReport("github.com", { u1: true }, { c1: true, c2: false }), // 2 passwords, 1 at-risk
        createReport("gitlab.com", { u2: true }, { c3: true }), // 1 password, 1 at-risk
      ];

      view.applications = [
        createApplication("github.com", true),
        createApplication("gitlab.com", true),
      ];

      view.recomputeSummary();

      const metrics = view.toMetrics();

      expect(metrics.totalPasswordCount).toBe(3); // 2 + 1
      expect(metrics.totalAtRiskPasswordCount).toBe(2); // 1 + 1
      expect(metrics.totalCriticalPasswordCount).toBe(3); // All apps are critical
      expect(metrics.totalCriticalAtRiskPasswordCount).toBe(2); // All apps are critical
    });

    it("should handle empty reports and applications", () => {
      const view = new AccessReportView();
      view.memberRegistry = {};
      view.reports = [];
      view.applications = [];

      view.recomputeSummary();

      const metrics = view.toMetrics();

      expect(metrics.totalPasswordCount).toBe(0);
      expect(metrics.totalAtRiskPasswordCount).toBe(0);
      expect(metrics.totalCriticalPasswordCount).toBe(0);
      expect(metrics.totalCriticalAtRiskPasswordCount).toBe(0);
      expect(metrics.totalMemberCount).toBe(0);
      expect(metrics.totalAtRiskMemberCount).toBe(0);
      expect(metrics.totalApplicationCount).toBe(0);
      expect(metrics.totalAtRiskApplicationCount).toBe(0);
    });

    it("should compute metrics with applications not in report", () => {
      const view = new AccessReportView();
      view.memberRegistry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);

      view.reports = [
        createReport("github.com", { u1: true }, { c1: true }), // 1 password, 1 at-risk
      ];

      view.applications = [
        createApplication("github.com", true),
        createApplication("gitlab.com", true), // Marked critical but not in reports
      ];

      view.recomputeSummary();

      const metrics = view.toMetrics();

      expect(metrics.totalPasswordCount).toBe(1);
      expect(metrics.totalAtRiskPasswordCount).toBe(1);
      expect(metrics.totalCriticalPasswordCount).toBe(1); // Only github.com has passwords
      expect(metrics.totalCriticalAtRiskPasswordCount).toBe(1);
    });
  });

  // ==================== Serialization ====================

  describe("fromJSON", () => {
    it("should initialize nested objects", () => {
      const input = createRiskInsights({
        id: "report-123" as OrganizationReportId,
        organizationId: "org-456" as OrganizationId,
        reports: [createReport("github.com", { u1: true }, { c1: true })],
        applications: [createApplication("github.com", true)],
        memberRegistry: createMemberRegistry([
          { id: "u1", name: "Alice", email: "alice@example.com" },
        ]),
        summary: createRiskInsightsSummary({
          totalMemberCount: 1,
          totalApplicationCount: 1,
          totalAtRiskMemberCount: 1,
          totalAtRiskApplicationCount: 1,
          totalCriticalApplicationCount: 1,
          totalCriticalMemberCount: 1,
          totalCriticalAtRiskMemberCount: 1,
          totalCriticalAtRiskApplicationCount: 1,
        }),
      });

      const view = AccessReportView.fromJSON(JSON.parse(JSON.stringify(input)));

      expect(view.id).toBe("report-123");
      expect(view.organizationId).toBe("org-456");
      expect(view.reports).toHaveLength(1);
      expect(view.reports[0]).toBeInstanceOf(ApplicationHealthView);
      expect(view.applications).toHaveLength(1);
      expect(view.applications[0]).toBeInstanceOf(AccessReportSettingsView);
      expect(view.memberRegistry["u1"]).toBeInstanceOf(MemberRegistryEntryView);
      expect(view.memberRegistry["u1"].id).toBe("u1");
      expect(view.memberRegistry["u1"].userName).toBe("Alice");
      expect(view.memberRegistry["u1"].email).toBe("alice@example.com");
    });

    it("should handle null input", () => {
      const view = AccessReportView.fromJSON(null as any);

      expect(view).toBeInstanceOf(AccessReportView);
      expect(view.reports).toEqual([]);
      expect(view.applications).toEqual([]);
      expect(view.memberRegistry).toEqual({});
    });

    it("should handle undefined input", () => {
      const view = AccessReportView.fromJSON(undefined as any);

      expect(view).toBeInstanceOf(AccessReportView);
      expect(view.reports).toEqual([]);
      expect(view.applications).toEqual([]);
      expect(view.memberRegistry).toEqual({});
    });
  });
});
