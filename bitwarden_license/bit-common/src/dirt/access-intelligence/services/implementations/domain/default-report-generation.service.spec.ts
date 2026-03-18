import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LogService } from "@bitwarden/logging";

import {
  createCipher,
  createMember,
  createCollectionAccess,
  createCipherHealth,
  createApplication,
  createMemberRegistry,
} from "../../../../reports/risk-insights/testing/test-helpers";
import { CipherHealthService } from "../../abstractions/cipher-health.service";
import {
  CollectionAccessDetails,
  GroupMembershipDetails,
  MemberCipherMappingService,
  OrganizationUserView,
} from "../../abstractions/member-cipher-mapping.service";

import { DefaultReportGenerationService } from "./default-report-generation.service";

describe("DefaultReportGenerationService", () => {
  let service: DefaultReportGenerationService;
  let cipherHealthService: MockProxy<CipherHealthService>;
  let memberCipherMappingService: MockProxy<MemberCipherMappingService>;
  let logService: MockProxy<LogService>;

  beforeEach(() => {
    cipherHealthService = mock<CipherHealthService>();
    memberCipherMappingService = mock<MemberCipherMappingService>();
    logService = mock<LogService>();

    service = new DefaultReportGenerationService(
      cipherHealthService,
      memberCipherMappingService,
      logService,
    );
  });

  // Test helpers imported from shared testing utilities
  // Using: createCipher, createMember, createCollectionAccess, createCipherHealth, createApplication

  // ==================== Integration Tests ====================

  describe("generateReport - Integration", () => {
    it("should generate complete report with valid data", async () => {
      // Arrange
      const ciphers = [
        createCipher("c1", ["https://github.com/login"], ["coll-1"]),
        createCipher("c2", ["https://github.com/signup"], ["coll-1"]),
        createCipher("c3", ["https://gitlab.com"], ["coll-2"]),
      ];

      const members = [
        createMember("u1", "Alice", "alice@example.com"),
        createMember("u2", "Bob", "bob@example.com"),
      ];

      const collectionAccess = [
        createCollectionAccess("coll-1", ["u1"], []),
        createCollectionAccess("coll-2", ["u2"], []),
      ];

      const groupMemberships: GroupMembershipDetails[] = [];

      // Mock health checks: c1 at-risk, others safe
      const healthMap = new Map([
        ["c1", createCipherHealth(true)],
        ["c2", createCipherHealth(false)],
        ["c3", createCipherHealth(false)],
      ]);
      cipherHealthService.checkCipherHealth.mockReturnValue(of(healthMap));

      // Mock member mapping
      const mapping = new Map([
        ["c1", ["u1"]],
        ["c2", ["u1"]],
        ["c3", ["u2"]],
      ]);
      const registry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
        { id: "u2", name: "Bob", email: "bob@example.com" },
      ]);
      memberCipherMappingService.mapCiphersToMembers.mockReturnValue(of({ mapping, registry }));

      // Act
      const result = await firstValueFrom(
        service.generateReport(ciphers, members, collectionAccess, groupMemberships),
      );

      // Assert
      expect(result.reports.length).toBe(2); // github.com and gitlab.com
      expect(result.applications.length).toBe(2);
      expect(result.memberRegistry).toEqual(registry);
      expect(result.summary.totalApplicationCount).toBe(2);
      expect(result.summary.totalMemberCount).toBe(2);
      expect(result.summary.totalAtRiskApplicationCount).toBe(1); // github.com has c1 at-risk
    });

    it("should handle empty cipher array", async () => {
      const ciphers: CipherView[] = [];
      const members = [createMember("u1", "Alice", "alice@example.com")];
      const collectionAccess: CollectionAccessDetails[] = [];
      const groupMemberships: GroupMembershipDetails[] = [];

      cipherHealthService.checkCipherHealth.mockReturnValue(of(new Map()));
      memberCipherMappingService.mapCiphersToMembers.mockReturnValue(
        of({ mapping: new Map(), registry: {} }),
      );

      const result = await firstValueFrom(
        service.generateReport(ciphers, members, collectionAccess, groupMemberships),
      );

      expect(result.reports.length).toBe(0);
      expect(result.applications.length).toBe(0);
      expect(result.summary.totalApplicationCount).toBe(0);
      expect(result.summary.totalAtRiskApplicationCount).toBe(0);
    });

    it("should handle empty member array", async () => {
      const ciphers = [createCipher("c1", ["https://github.com"], ["coll-1"])];
      const members: OrganizationUserView[] = [];
      const collectionAccess: CollectionAccessDetails[] = [];
      const groupMemberships: GroupMembershipDetails[] = [];

      const healthMap = new Map([["c1", createCipherHealth(false)]]);
      cipherHealthService.checkCipherHealth.mockReturnValue(of(healthMap));
      memberCipherMappingService.mapCiphersToMembers.mockReturnValue(
        of({ mapping: new Map([["c1", []]]), registry: {} }),
      );

      const result = await firstValueFrom(
        service.generateReport(ciphers, members, collectionAccess, groupMemberships),
      );

      expect(result.reports.length).toBe(1);
      expect(result.reports[0].memberCount).toBe(0);
      expect(result.memberRegistry).toEqual({});
      expect(result.summary.totalMemberCount).toBe(0);
    });
  });

  // ==================== Aggregation Tests ====================

  describe("aggregateIntoReports", () => {
    it("should group ciphers by trimmed URI", async () => {
      const ciphers = [
        createCipher("c1", ["https://github.com/login"], ["coll-1"]),
        createCipher("c2", ["https://github.com/signup"], ["coll-1"]),
        createCipher("c3", ["https://gitlab.com"], ["coll-1"]),
      ];

      const members = [createMember("u1", "Alice", "alice@example.com")];
      const collectionAccess = [createCollectionAccess("coll-1", ["u1"], [])];
      const groupMemberships: GroupMembershipDetails[] = [];

      const healthMap = new Map([
        ["c1", createCipherHealth(false)],
        ["c2", createCipherHealth(false)],
        ["c3", createCipherHealth(false)],
      ]);
      cipherHealthService.checkCipherHealth.mockReturnValue(of(healthMap));

      const mapping = new Map([
        ["c1", ["u1"]],
        ["c2", ["u1"]],
        ["c3", ["u1"]],
      ]);
      const registry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);
      memberCipherMappingService.mapCiphersToMembers.mockReturnValue(of({ mapping, registry }));

      const result = await firstValueFrom(
        service.generateReport(ciphers, members, collectionAccess, groupMemberships),
      );

      // Both c1 and c2 should be grouped under github.com
      const githubReport = result.reports.find((r) => r.applicationName === "github.com");
      expect(githubReport).toBeDefined();
      expect(githubReport?.passwordCount).toBe(2);
      expect(Object.keys(githubReport?.cipherRefs ?? {}).length).toBe(2);

      const gitlabReport = result.reports.find((r) => r.applicationName === "gitlab.com");
      expect(gitlabReport).toBeDefined();
      expect(gitlabReport?.passwordCount).toBe(1);
    });

    it("should build cipherRefs Record with at-risk flags", async () => {
      const ciphers = [
        createCipher("c1", ["https://github.com"], ["coll-1"]),
        createCipher("c2", ["https://github.com"], ["coll-1"]),
      ];

      const members = [createMember("u1", "Alice", "alice@example.com")];
      const collectionAccess = [createCollectionAccess("coll-1", ["u1"], [])];
      const groupMemberships: GroupMembershipDetails[] = [];

      const healthMap = new Map([
        ["c1", createCipherHealth(true)], // At-risk
        ["c2", createCipherHealth(false)], // Safe
      ]);
      cipherHealthService.checkCipherHealth.mockReturnValue(of(healthMap));

      const mapping = new Map([
        ["c1", ["u1"]],
        ["c2", ["u1"]],
      ]);
      const registry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);
      memberCipherMappingService.mapCiphersToMembers.mockReturnValue(of({ mapping, registry }));

      const result = await firstValueFrom(
        service.generateReport(ciphers, members, collectionAccess, groupMemberships),
      );

      const report = result.reports[0];
      expect(report.cipherRefs["c1"]).toBe(true); // At-risk
      expect(report.cipherRefs["c2"]).toBe(false); // Safe
      expect(report.passwordCount).toBe(2);
      expect(report.atRiskPasswordCount).toBe(1);
    });

    it("should build memberRefs Record with at-risk flags", async () => {
      const ciphers = [
        createCipher("c1", ["https://github.com"], ["coll-1"]), // u1 has access
        createCipher("c2", ["https://github.com"], ["coll-2"]), // u2 has access
      ];

      const members = [
        createMember("u1", "Alice", "alice@example.com"),
        createMember("u2", "Bob", "bob@example.com"),
      ];

      const collectionAccess = [
        createCollectionAccess("coll-1", ["u1"], []),
        createCollectionAccess("coll-2", ["u2"], []),
      ];
      const groupMemberships: GroupMembershipDetails[] = [];

      const healthMap = new Map([
        ["c1", createCipherHealth(true)], // At-risk
        ["c2", createCipherHealth(false)], // Safe
      ]);
      cipherHealthService.checkCipherHealth.mockReturnValue(of(healthMap));

      const mapping = new Map([
        ["c1", ["u1"]],
        ["c2", ["u2"]],
      ]);
      const registry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
        { id: "u2", name: "Bob", email: "bob@example.com" },
      ]);
      memberCipherMappingService.mapCiphersToMembers.mockReturnValue(of({ mapping, registry }));

      const result = await firstValueFrom(
        service.generateReport(ciphers, members, collectionAccess, groupMemberships),
      );

      const report = result.reports[0];
      expect(report.memberRefs["u1"]).toBe(true); // u1 has access to at-risk c1
      expect(report.memberRefs["u2"]).toBe(false); // u2 has access to safe c2
      expect(report.memberCount).toBe(2);
      expect(report.atRiskMemberCount).toBe(1);
    });

    it("should handle cipher with multiple URIs appearing in multiple applications", async () => {
      const ciphers = [
        createCipher("c1", ["https://github.com", "https://gitlab.com"], ["coll-1"]),
      ];

      const members = [createMember("u1", "Alice", "alice@example.com")];
      const collectionAccess = [createCollectionAccess("coll-1", ["u1"], [])];
      const groupMemberships: GroupMembershipDetails[] = [];

      const healthMap = new Map([["c1", createCipherHealth(true)]]);
      cipherHealthService.checkCipherHealth.mockReturnValue(of(healthMap));

      const mapping = new Map([["c1", ["u1"]]]);
      const registry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);
      memberCipherMappingService.mapCiphersToMembers.mockReturnValue(of({ mapping, registry }));

      const result = await firstValueFrom(
        service.generateReport(ciphers, members, collectionAccess, groupMemberships),
      );

      // Cipher should appear in both github.com and gitlab.com
      expect(result.reports.length).toBe(2);

      const githubReport = result.reports.find((r) => r.applicationName === "github.com");
      expect(githubReport?.cipherRefs["c1"]).toBe(true);
      expect(githubReport?.passwordCount).toBe(1);
      expect(githubReport?.atRiskPasswordCount).toBe(1);

      const gitlabReport = result.reports.find((r) => r.applicationName === "gitlab.com");
      expect(gitlabReport?.cipherRefs["c1"]).toBe(true);
      expect(gitlabReport?.passwordCount).toBe(1);
      expect(gitlabReport?.atRiskPasswordCount).toBe(1);
    });

    it("should deduplicate members within application", async () => {
      const ciphers = [
        createCipher("c1", ["https://github.com"], ["coll-1"]), // u1 has access
        createCipher("c2", ["https://github.com"], ["coll-2"]), // u1 also has access
      ];

      const members = [createMember("u1", "Alice", "alice@example.com")];
      const collectionAccess = [
        createCollectionAccess("coll-1", ["u1"], []),
        createCollectionAccess("coll-2", ["u1"], []),
      ];
      const groupMemberships: GroupMembershipDetails[] = [];

      const healthMap = new Map([
        ["c1", createCipherHealth(true)],
        ["c2", createCipherHealth(false)],
      ]);
      cipherHealthService.checkCipherHealth.mockReturnValue(of(healthMap));

      const mapping = new Map([
        ["c1", ["u1"]],
        ["c2", ["u1"]],
      ]);
      const registry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);
      memberCipherMappingService.mapCiphersToMembers.mockReturnValue(of({ mapping, registry }));

      const result = await firstValueFrom(
        service.generateReport(ciphers, members, collectionAccess, groupMemberships),
      );

      const report = result.reports[0];
      // u1 should appear only once despite having access to both ciphers
      expect(Object.keys(report.memberRefs).length).toBe(1);
      expect(report.memberRefs["u1"]).toBe(true); // At-risk because c1 is at-risk
      expect(report.memberCount).toBe(1);
      expect(report.atRiskMemberCount).toBe(1);
    });
  });

  // ==================== Carry-Over Tests ====================

  describe("carryOverApplicationMetadata", () => {
    it("should carry over isCritical flag from previous report", async () => {
      const ciphers = [createCipher("c1", ["https://github.com"], ["coll-1"])];
      const members = [createMember("u1", "Alice", "alice@example.com")];
      const collectionAccess = [createCollectionAccess("coll-1", ["u1"], [])];
      const groupMemberships: GroupMembershipDetails[] = [];

      const healthMap = new Map([["c1", createCipherHealth(false)]]);
      cipherHealthService.checkCipherHealth.mockReturnValue(of(healthMap));

      const mapping = new Map([["c1", ["u1"]]]);
      const registry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);
      memberCipherMappingService.mapCiphersToMembers.mockReturnValue(of({ mapping, registry }));

      const previousApplications = [createApplication("github.com", true)];

      const result = await firstValueFrom(
        service.generateReport(
          ciphers,
          members,
          collectionAccess,
          groupMemberships,
          previousApplications,
        ),
      );

      const app = result.applications.find((a) => a.applicationName === "github.com");
      expect(app?.isCritical).toBe(true);
    });

    it("should carry over reviewedDate from previous report", async () => {
      const ciphers = [createCipher("c1", ["https://github.com"], ["coll-1"])];
      const members = [createMember("u1", "Alice", "alice@example.com")];
      const collectionAccess = [createCollectionAccess("coll-1", ["u1"], [])];
      const groupMemberships: GroupMembershipDetails[] = [];

      const healthMap = new Map([["c1", createCipherHealth(false)]]);
      cipherHealthService.checkCipherHealth.mockReturnValue(of(healthMap));

      const mapping = new Map([["c1", ["u1"]]]);
      const registry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);
      memberCipherMappingService.mapCiphersToMembers.mockReturnValue(of({ mapping, registry }));

      const reviewedDate = new Date("2024-01-15");
      const previousApplications = [createApplication("github.com", false, reviewedDate)];

      const result = await firstValueFrom(
        service.generateReport(
          ciphers,
          members,
          collectionAccess,
          groupMemberships,
          previousApplications,
        ),
      );

      const app = result.applications.find((a) => a.applicationName === "github.com");
      expect(app?.reviewedDate).toEqual(reviewedDate);
    });

    it("should default new applications to isCritical=false and reviewedDate=undefined", async () => {
      const ciphers = [createCipher("c1", ["https://github.com"], ["coll-1"])];
      const members = [createMember("u1", "Alice", "alice@example.com")];
      const collectionAccess = [createCollectionAccess("coll-1", ["u1"], [])];
      const groupMemberships: GroupMembershipDetails[] = [];

      const healthMap = new Map([["c1", createCipherHealth(false)]]);
      cipherHealthService.checkCipherHealth.mockReturnValue(of(healthMap));

      const mapping = new Map([["c1", ["u1"]]]);
      const registry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);
      memberCipherMappingService.mapCiphersToMembers.mockReturnValue(of({ mapping, registry }));

      // No previous applications
      const result = await firstValueFrom(
        service.generateReport(ciphers, members, collectionAccess, groupMemberships),
      );

      const app = result.applications.find((a) => a.applicationName === "github.com");
      expect(app?.isCritical).toBe(false);
      expect(app?.reviewedDate).toBeUndefined();
    });

    it("should not include deleted applications from previous report", async () => {
      const ciphers = [createCipher("c1", ["https://github.com"], ["coll-1"])];
      const members = [createMember("u1", "Alice", "alice@example.com")];
      const collectionAccess = [createCollectionAccess("coll-1", ["u1"], [])];
      const groupMemberships: GroupMembershipDetails[] = [];

      const healthMap = new Map([["c1", createCipherHealth(false)]]);
      cipherHealthService.checkCipherHealth.mockReturnValue(of(healthMap));

      const mapping = new Map([["c1", ["u1"]]]);
      const registry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);
      memberCipherMappingService.mapCiphersToMembers.mockReturnValue(of({ mapping, registry }));

      // Previous report had gitlab.com which no longer exists
      const previousApplications = [
        createApplication("github.com", true),
        createApplication("gitlab.com", true), // Deleted app
      ];

      const result = await firstValueFrom(
        service.generateReport(
          ciphers,
          members,
          collectionAccess,
          groupMemberships,
          previousApplications,
        ),
      );

      expect(result.applications.length).toBe(1);
      expect(result.applications.find((a) => a.applicationName === "gitlab.com")).toBeUndefined();
    });
  });

  // ==================== Summary Tests ====================

  describe("recomputeSummary", () => {
    it("should compute correct total counts", async () => {
      const ciphers = [
        createCipher("c1", ["https://github.com"], ["coll-1"]),
        createCipher("c2", ["https://gitlab.com"], ["coll-2"]),
      ];

      const members = [
        createMember("u1", "Alice", "alice@example.com"),
        createMember("u2", "Bob", "bob@example.com"),
      ];

      const collectionAccess = [
        createCollectionAccess("coll-1", ["u1"], []),
        createCollectionAccess("coll-2", ["u2"], []),
      ];
      const groupMemberships: GroupMembershipDetails[] = [];

      const healthMap = new Map([
        ["c1", createCipherHealth(true)], // At-risk
        ["c2", createCipherHealth(false)], // Safe
      ]);
      cipherHealthService.checkCipherHealth.mockReturnValue(of(healthMap));

      const mapping = new Map([
        ["c1", ["u1"]],
        ["c2", ["u2"]],
      ]);
      const registry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
        { id: "u2", name: "Bob", email: "bob@example.com" },
      ]);
      memberCipherMappingService.mapCiphersToMembers.mockReturnValue(of({ mapping, registry }));

      const result = await firstValueFrom(
        service.generateReport(ciphers, members, collectionAccess, groupMemberships),
      );

      expect(result.summary.totalApplicationCount).toBe(2);
      expect(result.summary.totalAtRiskApplicationCount).toBe(1); // github.com
      expect(result.summary.totalMemberCount).toBe(2);
      expect(result.summary.totalAtRiskMemberCount).toBe(1); // u1 has access to at-risk c1
    });

    it("should deduplicate at-risk members across applications", async () => {
      const ciphers = [
        createCipher("c1", ["https://github.com"], ["coll-1"]), // u1 has access
        createCipher("c2", ["https://gitlab.com"], ["coll-2"]), // u1 also has access
      ];

      const members = [createMember("u1", "Alice", "alice@example.com")];

      const collectionAccess = [
        createCollectionAccess("coll-1", ["u1"], []),
        createCollectionAccess("coll-2", ["u1"], []),
      ];
      const groupMemberships: GroupMembershipDetails[] = [];

      const healthMap = new Map([
        ["c1", createCipherHealth(true)], // At-risk
        ["c2", createCipherHealth(true)], // At-risk
      ]);
      cipherHealthService.checkCipherHealth.mockReturnValue(of(healthMap));

      const mapping = new Map([
        ["c1", ["u1"]],
        ["c2", ["u1"]],
      ]);
      const registry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);
      memberCipherMappingService.mapCiphersToMembers.mockReturnValue(of({ mapping, registry }));

      const result = await firstValueFrom(
        service.generateReport(ciphers, members, collectionAccess, groupMemberships),
      );

      // u1 appears in both applications, but should be counted once
      expect(result.summary.totalAtRiskMemberCount).toBe(1);
    });

    it("should compute correct critical application counts", async () => {
      const ciphers = [
        createCipher("c1", ["https://github.com"], ["coll-1"]),
        createCipher("c2", ["https://gitlab.com"], ["coll-2"]),
      ];

      const members = [
        createMember("u1", "Alice", "alice@example.com"),
        createMember("u2", "Bob", "bob@example.com"),
      ];

      const collectionAccess = [
        createCollectionAccess("coll-1", ["u1"], []),
        createCollectionAccess("coll-2", ["u2"], []),
      ];
      const groupMemberships: GroupMembershipDetails[] = [];

      const healthMap = new Map([
        ["c1", createCipherHealth(true)], // At-risk
        ["c2", createCipherHealth(false)], // Safe
      ]);
      cipherHealthService.checkCipherHealth.mockReturnValue(of(healthMap));

      const mapping = new Map([
        ["c1", ["u1"]],
        ["c2", ["u2"]],
      ]);
      const registry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
        { id: "u2", name: "Bob", email: "bob@example.com" },
      ]);
      memberCipherMappingService.mapCiphersToMembers.mockReturnValue(of({ mapping, registry }));

      // Mark github.com as critical
      const previousApplications = [createApplication("github.com", true)];

      const result = await firstValueFrom(
        service.generateReport(
          ciphers,
          members,
          collectionAccess,
          groupMemberships,
          previousApplications,
        ),
      );

      expect(result.summary.totalCriticalApplicationCount).toBe(1); // github.com
      expect(result.summary.totalCriticalAtRiskApplicationCount).toBe(1); // github.com is at-risk
      expect(result.summary.totalCriticalMemberCount).toBe(1); // u1
      expect(result.summary.totalCriticalAtRiskMemberCount).toBe(1); // u1 is at-risk
    });
  });

  // ==================== Member Registry Tests ====================

  describe("Member Registry", () => {
    it("should create registry with all unique members", async () => {
      const ciphers = [
        createCipher("c1", ["https://github.com"], ["coll-1"]),
        createCipher("c2", ["https://gitlab.com"], ["coll-2"]),
      ];

      const members = [
        createMember("u1", "Alice", "alice@example.com"),
        createMember("u2", "Bob", "bob@example.com"),
      ];

      const collectionAccess = [
        createCollectionAccess("coll-1", ["u1"], []),
        createCollectionAccess("coll-2", ["u2"], []),
      ];
      const groupMemberships: GroupMembershipDetails[] = [];

      const healthMap = new Map([
        ["c1", createCipherHealth(false)],
        ["c2", createCipherHealth(false)],
      ]);
      cipherHealthService.checkCipherHealth.mockReturnValue(of(healthMap));

      const mapping = new Map([
        ["c1", ["u1"]],
        ["c2", ["u2"]],
      ]);
      const registry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
        { id: "u2", name: "Bob", email: "bob@example.com" },
      ]);
      memberCipherMappingService.mapCiphersToMembers.mockReturnValue(of({ mapping, registry }));

      const result = await firstValueFrom(
        service.generateReport(ciphers, members, collectionAccess, groupMemberships),
      );

      expect(Object.keys(result.memberRegistry).length).toBe(2);
      expect(result.memberRegistry["u1"]).toEqual({
        id: "u1",
        userName: "Alice",
        email: "alice@example.com",
      });
      expect(result.memberRegistry["u2"]).toEqual({
        id: "u2",
        userName: "Bob",
        email: "bob@example.com",
      });
    });

    it("should ensure all report memberRefs exist in registry", async () => {
      const ciphers = [createCipher("c1", ["https://github.com"], ["coll-1"])];
      const members = [createMember("u1", "Alice", "alice@example.com")];
      const collectionAccess = [createCollectionAccess("coll-1", ["u1"], [])];
      const groupMemberships: GroupMembershipDetails[] = [];

      const healthMap = new Map([["c1", createCipherHealth(false)]]);
      cipherHealthService.checkCipherHealth.mockReturnValue(of(healthMap));

      const mapping = new Map([["c1", ["u1"]]]);
      const registry = createMemberRegistry([
        { id: "u1", name: "Alice", email: "alice@example.com" },
      ]);
      memberCipherMappingService.mapCiphersToMembers.mockReturnValue(of({ mapping, registry }));

      const result = await firstValueFrom(
        service.generateReport(ciphers, members, collectionAccess, groupMemberships),
      );

      // All member IDs in reports should exist in registry
      result.reports.forEach((report) => {
        Object.keys(report.memberRefs).forEach((memberId) => {
          expect(result.memberRegistry[memberId]).toBeDefined();
        });
      });
    });
  });
});
