import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  I18nMockService,
  ToastService,
} from "@bitwarden/components";

import { AuditRow } from "../access-audit-row";

import { AuditEventDrawerComponent, AuditEventDrawerParams } from "./audit-event-drawer.component";

const ORGANIZATION_ID = "org-1";

const REQUEST_ID = "3a9d5f74-2c18-4c6b-9f0d-71b8e4a2c6d5";
const LEASE_ID = "b27e4c91-5d3a-4f88-a1c6-90e7d5f2b834";

const ADA = { name: "Ada", email: "ada@example.com", organizationUserId: "org-user-1" };
const GRACE = { name: "Grace", email: "grace@example.com", organizationUserId: "org-user-2" };

/** A fully-populated row, so a test can knock out the one field it is about. */
function row(overrides: Partial<AuditRow> = {}): AuditRow {
  return {
    occurredAt: new Date("2026-08-18T09:00:00.000Z"),
    kindLabelKey: "pamAuditKindLeaseActivated",
    actor: "Ada",
    actorId: "user-1",
    actorEmail: "ada@example.com",
    requester: "Grace",
    requesterId: "user-2",
    requesterEmail: "grace@example.com",
    cipherName: "Prod database",
    cipherId: "cipher-1",
    collectionName: "Production",
    collectionId: "collection-1",
    ruleName: "Approval required",
    ruleId: "rule-1",
    detail: "Approved for the incident window.",
    automated: false,
    inDoubt: false,
    requestId: REQUEST_ID,
    leaseId: LEASE_ID,
    duration: { key: "pamInboxDuration1Hour", value: null },
    exactWindow: "18/08/2026, 09:00 – 18/08/2026, 10:00",
    extendedUntil: null,
    ...overrides,
  };
}

describe("AuditEventDrawerComponent", () => {
  let fixture: ComponentFixture<AuditEventDrawerComponent>;
  let dialogService: MockProxy<DialogService>;
  let dialogRef: MockProxy<DialogRef>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;

  const render = async (overrides: Partial<AuditEventDrawerParams> = {}) => {
    const params: AuditEventDrawerParams = {
      row: row(),
      organizationId: ORGANIZATION_ID,
      actor: ADA,
      requester: GRACE,
      canManageAccessRules: true,
      canViewCollections: true,
      ...overrides,
    };

    await TestBed.configureTestingModule({
      imports: [AuditEventDrawerComponent],
      providers: [
        provideRouter([]),
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogService, useValue: dialogService },
        { provide: DialogRef, useValue: dialogRef },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: ToastService, useValue: mock<ToastService>() },
        {
          provide: I18nService,
          // I18nMockService throws on an unknown key, so this is every key the pane can render.
          useValue: new I18nMockService({
            timestamp: "Timestamp",
            collection: "Collection",
            pamAuditColumnActor: "Actor",
            pamAuditColumnRequester: "Requester",
            pamAuditColumnItem: "Item",
            pamAuditColumnDuration: "Duration",
            pamAuditColumnDetail: "Detail",
            pamColumnWindow: "Window",
            pamAccessRequestTitle: "Access request",
            pamAccessRequestLeaseTitle: "Access",
            pamResolverAccessRule: "Access rule",
            pamAuditSystem: "System",
            pamAuditIncomplete: "Incomplete",
            pamAuditIncompleteTooltip: "Outcome never confirmed.",
            pamAuditDurationExtendedTo: "Extended to __$1__",
            pamInboxDuration1Hour: "1 hour",
            pamAuditKindLeaseActivated: "Lease activated",
            pamAuditKindLeaseExtended: "Lease extended",
            pamAuditKindRuleDeleted: "Access rule deleted",
            copyValue: "Copy value",
            copySuccessful: "Copy Successful",
            close: "Close",
          }),
        },
      ],
    })
      // Stub the dialog shell so these tests exercise the pane's own fields rather than
      // `bit-dialog`'s chrome, which wants a real DialogRef and a drawer stack to sit in.
      .overrideComponent(AuditEventDrawerComponent, {
        remove: { imports: [DialogModule] },
        add: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AuditEventDrawerComponent);
    fixture.detectChanges();
  };

  beforeEach(() => {
    dialogService = mock<DialogService>();
    dialogRef = mock<DialogRef>();
    platformUtilsService = mock<PlatformUtilsService>();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  const field = (name: string): HTMLElement =>
    fixture.nativeElement.querySelector(`[data-testid="drawer-${name}"]`);

  const text = (name: string) => field(name).textContent!.trim().replace(/\s+/g, " ");

  /** The params the one opened dialog was configured with. */
  const dialogData = () =>
    (dialogService.open.mock.calls[0][1] as { data: Record<string, unknown> }).data;

  describe("title", () => {
    it("titles the pane with the event label", async () => {
      await render();

      expect(fixture.nativeElement.textContent).toContain("Lease activated");
    });

    it("carries the in-doubt badge when the outcome never landed", async () => {
      await render({ row: row({ inDoubt: true }) });

      expect(fixture.nativeElement.querySelector("[bitBadge]").textContent!.trim()).toBe(
        "Incomplete",
      );
    });

    it("carries no badge for an event whose outcome landed", async () => {
      await render();

      expect(fixture.nativeElement.querySelector("[bitBadge]")).toBeNull();
    });
  });

  describe("fields", () => {
    it("renders the whole timestamp", async () => {
      await render();

      // `long` carries the seconds and the zone, which is what an auditor correlating two systems needs.
      expect(text("timestamp")).toContain("2026");
      expect(text("timestamp")).toContain(":00:00");
    });

    it("renders each populated field", async () => {
      await render();

      expect(text("actor")).toContain("Ada");
      expect(text("requester")).toContain("Grace");
      expect(text("item")).toBe("Prod database");
      expect(text("collection")).toBe("Production");
      expect(text("duration")).toBe("1 hour");
      expect(text("window")).toBe("18/08/2026, 09:00 – 18/08/2026, 10:00");
      expect(text("detail")).toBe("Approved for the incident window.");
      expect(text("request-id")).toBe("3a9d5f74");
      expect(text("lease-id")).toBe("b27e4c91");
      expect(text("rule")).toBe("Approval required");
    });

    it("puts each identity's email under their name", async () => {
      await render();

      expect(field("actor").querySelector("a")!.textContent!.trim()).toBe("Ada");
      expect(field("actor").querySelector(":scope > div")!.textContent!.trim()).toBe(
        "ada@example.com",
      );
      expect(field("requester").querySelector(":scope > div")!.textContent!.trim()).toBe(
        "grace@example.com",
      );
    });

    // The trail falls back to the email as the display name, and the same address twice reads as a bug.
    it("does not repeat an email that is already the display name", async () => {
      await render({ row: row({ actor: "ada@example.com" }), actor: null });

      expect(text("actor")).toBe("ada@example.com");
    });

    it("falls back to the rule name when the event names no item", async () => {
      await render({
        row: row({ cipherName: null, cipherId: null, ruleName: "Production access" }),
      });

      expect(text("item")).toBe("Production access");
    });

    // "System" is a value, not an absence: an automated event has an actor, it just is not a person.
    it("reads System rather than a dash for an automated event", async () => {
      await render({ row: row({ automated: true }), actor: null });

      expect(text("actor")).toBe("System");
    });

    it("renders an extension's new end as the duration", async () => {
      await render({
        row: row({
          kindLabelKey: "pamAuditKindLeaseExtended",
          duration: null,
          exactWindow: null,
          extendedUntil: "2026-08-18T12:00:00.000Z",
        }),
      });

      expect(text("duration")).toContain("Extended to");
    });

    // The reason is the pane's one unbounded field, and the drawer column is a fixed 24rem that no
    // content can widen — so this wrap is the whole of what keeps a reason offering no break
    // opportunity (a pasted token, a correlation id) inside the column. Unwrapped, the same value
    // dragged a horizontal scrollbar onto the entire page back when Detail was still a table
    // column, which is what PM-42588 reported.
    it("wraps a reason that offers no break opportunity", async () => {
      const unbroken = "Xk9Qw2Zr7Lm4Vb8Ns3Ty6Hj1Pd5Gf0Cx".repeat(13);

      await render({ row: row({ detail: unbroken }) });

      expect(text("detail")).toBe(unbroken);
      expect(field("detail").classList.contains("tw-break-words")).toBe(true);
    });
  });

  // A pane that dropped its empty rows would read as a different event each time, and an auditor
  // could not tell "we hold no value for this" from "this pane failed to draw it".
  describe("absent values", () => {
    const EMPTY_ROW = row({
      actor: null,
      actorId: null,
      actorEmail: null,
      requester: null,
      requesterId: null,
      requesterEmail: null,
      cipherName: null,
      cipherId: null,
      collectionName: null,
      collectionId: null,
      ruleName: null,
      ruleId: null,
      detail: null,
      requestId: null,
      leaseId: null,
      duration: null,
      exactWindow: null,
      extendedUntil: null,
    });

    it.each([
      "actor",
      "requester",
      "item",
      "collection",
      "duration",
      "window",
      "detail",
      "request-id",
      "lease-id",
      "rule",
    ])("renders the muted em dash for an absent %s", async (name) => {
      await render({ row: EMPTY_ROW, actor: null, requester: null });

      expect(text(name)).toBe("—");
      expect(field(name).querySelector(".tw-text-muted")).not.toBeNull();
    });
  });

  describe("entity event history links", () => {
    it("opens the actor's event history from their name", async () => {
      await render();

      fixture.nativeElement.querySelector("#pam-audit-event-drawer_link_actor").click();

      expect(dialogService.open).toHaveBeenCalledTimes(1);
      expect(dialogData()).toEqual({
        entity: "user",
        entityId: "org-user-1",
        organizationId: ORGANIZATION_ID,
        name: "Ada",
        showUser: true,
      });
    });

    it("opens the requester's event history from their name", async () => {
      await render();

      fixture.nativeElement.querySelector("#pam-audit-event-drawer_link_requester").click();

      expect(dialogData()).toEqual({
        entity: "user",
        entityId: "org-user-2",
        organizationId: ORGANIZATION_ID,
        name: "Grace",
        showUser: true,
      });
    });

    it("opens the item's event history from its name", async () => {
      await render();

      fixture.nativeElement.querySelector("#pam-audit-event-drawer_link_item").click();

      expect(dialogData()).toEqual({
        entity: "cipher",
        entityId: "cipher-1",
        organizationId: ORGANIZATION_ID,
        name: "Prod database",
        showUser: true,
      });
    });

    // A dead link on an audit surface invites a click that reports nothing.
    it("leaves an identity the page could not resolve as plain text", async () => {
      await render({ actor: null, requester: null });

      expect(fixture.nativeElement.querySelector("#pam-audit-event-drawer_link_actor")).toBeNull();
      expect(
        fixture.nativeElement.querySelector("#pam-audit-event-drawer_link_requester"),
      ).toBeNull();
      expect(text("actor")).toContain("Ada");
    });

    // There is no entity-events dialog for an access rule.
    it("leaves a rule-named item as plain text", async () => {
      await render({
        row: row({ cipherName: null, cipherId: null, ruleName: "Production access" }),
      });

      expect(fixture.nativeElement.querySelector("#pam-audit-event-drawer_link_item")).toBeNull();
    });
  });

  describe("access rule", () => {
    const link = () => fixture.nativeElement.querySelector("#pam-audit-event-drawer_link_rule");

    // A uuid tells an auditor nothing, and the store already carries the name it stood for.
    it("names the rule rather than identifying it by uuid", async () => {
      await render();

      expect(text("rule")).toBe("Approval required");
      expect(text("rule")).not.toContain("rule-1");
    });

    it("links the name to the rule editor when the viewer administers rules", async () => {
      await render();

      expect(link().getAttribute("href")).toBe("/organizations/org-1/pam/access-rules/rule-1");
    });

    // The rule is gone, so the editor would answer the one event most worth reading with a 404.
    it("leaves a rule deletion's name as plain text", async () => {
      await render({ row: row({ kindLabelKey: "pamAuditKindRuleDeleted" }) });

      expect(link()).toBeNull();
      expect(text("rule")).toBe("Approval required");
    });

    // This page's own guard does not imply the rule editor's.
    it("leaves the name as plain text without the rules permission", async () => {
      await render({ canManageAccessRules: false });

      expect(link()).toBeNull();
      expect(text("rule")).toBe("Approval required");
    });

    it("closes the drawer before following the link out of it", async () => {
      await render();
      jest.spyOn(TestBed.inject(Router), "navigateByUrl").mockResolvedValue(true);

      link().click();

      expect(dialogRef.close).toHaveBeenCalled();
    });
  });

  describe("collection", () => {
    const link = () =>
      fixture.nativeElement.querySelector("#pam-audit-event-drawer_link_collection");

    it("links the name to the organization vault narrowed to that collection", async () => {
      await render();

      expect(link().getAttribute("href")).toBe(
        "/organizations/org-1/vault?collectionId=collection-1",
      );
    });

    it("leaves the name as plain text without permission to open the vault", async () => {
      await render({ canViewCollections: false });

      expect(link()).toBeNull();
      expect(text("collection")).toBe("Production");
    });
  });

  describe("request and lease ids", () => {
    const copyButton = (name: string): HTMLElement =>
      fixture.nativeElement.querySelector(`#pam-audit-event-drawer_button_copy-${name}`);

    it.each([
      ["request-id", REQUEST_ID],
      ["lease-id", LEASE_ID],
    ])("shortens the %s to its first eight characters", async (name, id) => {
      await render();

      expect(text(name)).toBe(id.substring(0, 8));
      expect(text(name)).toHaveLength(8);
    });

    it.each([
      ["request-id", REQUEST_ID],
      ["lease-id", LEASE_ID],
    ])("copies the whole %s, not the short form", async (name, id) => {
      await render();

      copyButton(name).click();

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(id);
    });

    it.each(["request-id", "lease-id"])(
      "offers no copy affordance beside an absent %s",
      async (name) => {
        await render({ row: row({ requestId: null, leaseId: null }) });

        expect(text(name)).toBe("—");
        expect(copyButton(name)).toBeNull();
      },
    );
  });
});
