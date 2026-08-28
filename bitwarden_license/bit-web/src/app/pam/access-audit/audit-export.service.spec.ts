import { TestBed } from "@angular/core/testing";
import * as papa from "papaparse";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { AuditRow } from "./access-audit-row";
import { AuditExportService } from "./audit-export.service";

function row(overrides: Partial<AuditRow> = {}): AuditRow {
  return {
    occurredAt: new Date("2026-06-30T12:00:00Z"),
    kindLabelKey: "pamAuditKindLeaseActivated",
    actor: "Ada Lovelace",
    actorId: "user-ada",
    actorEmail: "ada@example.com",
    requester: "Grace Hopper",
    requesterId: "user-grace",
    requesterEmail: "grace@example.com",
    cipherName: "prod db",
    collectionName: "production",
    ruleName: "Production access",
    detail: "Approved for the incident window.",
    automated: false,
    inDoubt: false,
    requestId: "req-1",
    duration: { key: "pamInboxDurationHours", value: 4 },
    exactWindow: "6/30/26, 12:00 – 6/30/26, 16:00",
    extendedUntil: null,
    searchText: "ada lovelace grace hopper prod db production",
    ...overrides,
  };
}

describe("AuditExportService", () => {
  let service: AuditExportService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: I18nService,
          useValue: new I18nMockService({
            pamAuditKindLeaseActivated: "Lease activated",
            pamAuditKindRuleCreated: "Access rule created",
            pamInboxDurationHours: "__$1__ hours",
            pamInboxDuration1Hour: "1 hour",
          }),
        },
      ],
    });
    service = TestBed.inject(AuditExportService);
  });

  describe("toAuditExport", () => {
    it("maps a fully populated row onto the column contract", () => {
      expect(service.toAuditExport(row())).toEqual({
        timestamp: "2026-06-30T12:00:00.000Z",
        event: "Lease activated",
        actorName: "Ada Lovelace",
        actorEmail: "ada@example.com",
        requesterName: "Grace Hopper",
        requesterEmail: "grace@example.com",
        itemName: "prod db",
        collectionName: "production",
        ruleName: "Production access",
        grantedDuration: "4 hours",
        detail: "Approved for the incident window.",
        automated: false,
        incomplete: false,
      });
    });

    // The file outlives the session that produced it, so the instant is written in full rather than in the
    // exporter's own zone the way the Time column renders it.
    it("writes the timestamp as a full ISO 8601 instant", () => {
      const exported = service.toAuditExport(
        row({ occurredAt: new Date("2026-01-05T23:30:15.250Z") }),
      );

      expect(exported.timestamp).toBe("2026-01-05T23:30:15.250Z");
    });

    it("renders every absent value as an empty cell", () => {
      const exported = service.toAuditExport(
        row({
          kindLabelKey: "pamAuditKindRuleCreated",
          actor: null,
          actorId: null,
          actorEmail: null,
          requester: null,
          requesterId: null,
          requesterEmail: null,
          cipherName: null,
          collectionName: null,
          ruleName: null,
          detail: null,
          duration: null,
          exactWindow: null,
          extendedUntil: null,
          automated: true,
          inDoubt: true,
        }),
      );

      expect(exported).toEqual({
        timestamp: "2026-06-30T12:00:00.000Z",
        event: "Access rule created",
        actorName: "",
        actorEmail: "",
        requesterName: "",
        requesterEmail: "",
        itemName: "",
        collectionName: "",
        ruleName: "",
        grantedDuration: "",
        detail: "",
        automated: true,
        incomplete: true,
      });
      expect(JSON.stringify(exported)).not.toMatch(/null|undefined/);
    });

    // Cipher and collection names come from local vault state, so an item the exporter cannot decrypt has
    // none. The empty cell is the correct answer: the response's encrypted names are not a fallback.
    it("leaves the item empty for a row whose item did not resolve", () => {
      const exported = service.toAuditExport(row({ cipherName: null, collectionName: null }));

      expect(exported.itemName).toBe("");
      expect(exported.collectionName).toBe("");
      expect(exported.ruleName).toBe("Production access");
    });

    it("localizes a duration that takes no substitution", () => {
      const exported = service.toAuditExport(
        row({ duration: { key: "pamInboxDuration1Hour", value: null } }),
      );

      expect(exported.grantedDuration).toBe("1 hour");
    });
  });

  describe("getAuditExport", () => {
    it("writes one record per row, in the order given", () => {
      const csv = service.getAuditExport([
        row({ detail: "first" }),
        row({ detail: "second" }),
        row({ detail: "third" }),
      ]);

      const parsed = papa.parse<Record<string, string>>(csv, { header: true });
      expect(parsed.data.map((record) => record.detail)).toEqual(["first", "second", "third"]);
    });

    // Approver comments are free text: a comment carrying the delimiter, a quote or a line break has to
    // survive the round trip rather than shift every later column.
    it("quotes a detail containing a comma, a double quote and a newline", () => {
      const detail = 'Approved, but "read-only"\nper the incident notes';

      const parsed = papa.parse<Record<string, string>>(service.getAuditExport([row({ detail })]), {
        header: true,
      });

      expect(parsed.data).toHaveLength(1);
      expect(parsed.data[0].detail).toBe(detail);
      expect(parsed.data[0].event).toBe("Lease activated");
    });

    it("names the file with a PAM-specific prefix and a csv extension", () => {
      expect(service.getFileName()).toMatch(/^bitwarden_pam_audit_export_\d{14}\.csv$/);
    });
  });
});
