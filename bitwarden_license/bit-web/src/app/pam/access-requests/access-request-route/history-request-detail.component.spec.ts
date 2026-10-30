import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import type { AccessRequestView } from "../../abstractions/access-lease";
import { HistoryOutcome } from "../../helpers/history-detail";
import { automaticDecision, humanDecision } from "../../testing/decision-builders";

import { HistoryRequestDetailComponent } from "./history-request-detail.component";

/** A local wall-clock time, so the formatted dates hold in any runner's timezone. */
function local(hour: number): string {
  return new Date(2026, 9, 21, hour).toISOString();
}

const NOW = Date.parse(local(22));

function request(overrides: Record<string, unknown> = {}): AccessRequestView {
  return {
    id: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    organizationId: "org-1",
    requesterId: "requester-1",
    status: "denied",
    leaseNotBefore: local(14),
    leaseNotAfter: local(18),
    submittedAt: local(14),
    resolvedAt: local(15),
    decisions: [],
    ...overrides,
  } as unknown as AccessRequestView;
}

describe("HistoryRequestDetailComponent", () => {
  let fixture: ComponentFixture<HistoryRequestDetailComponent>;

  function render(
    outcome: HistoryOutcome,
    overrides: Record<string, unknown> = {},
    inputs: Record<string, unknown> = {},
  ): void {
    fixture = TestBed.createComponent(HistoryRequestDetailComponent);
    fixture.componentRef.setInput("request", request(overrides));
    fixture.componentRef.setInput("outcome", outcome);
    fixture.componentRef.setInput("itemName", "Stripe dashboard");
    fixture.componentRef.setInput("requesterName", "marcus.chen");
    fixture.componentRef.setInput("organizationName", "Meridian Group");
    fixture.componentRef.setInput("collectionName", "Finance");
    fixture.componentRef.setInput("nowMs", NOW);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  }

  function byTestId(id: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${id}"]`);
  }

  function textOf(id: string): string {
    return byTestId(id)?.textContent?.trim() ?? "";
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryRequestDetailComponent],
      providers: [
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ").trim() },
        },
      ],
    }).compileComponents();
  });

  describe("item card", () => {
    it("names the item, its organization and its collection", () => {
      render("denied");

      const card = byTestId("request-item-card")!;
      expect(textOf("request-item-card-name")).toBe("Stripe dashboard");
      expect(card.textContent).toContain("Meridian Group");
      expect(card.textContent).toContain("Finance");
    });

    it("drops the organization and collection line when neither resolved", () => {
      render("denied", {}, { organizationName: null, collectionName: null });

      const card = byTestId("request-item-card")!;
      expect(card.querySelector(".bwi-business")).toBeNull();
      expect(card.querySelector(".bwi-collection-shared")).toBeNull();
    });

    it("falls back to a key icon when the item is not in the viewer's vault", () => {
      render("denied");

      expect(byTestId("request-item-card")!.querySelector(".bwi-key")).not.toBeNull();
    });

    it.each([
      ["denied", "pamStatusDenied"],
      ["canceled", "pamStatusCanceled"],
      ["expired", "pamStatusExpired"],
      ["revoked", "pamStatusRevoked"],
      ["sessionEnded", "pamStatusSessionEnded"],
    ] as const)("badges a %s request as %s, inside the item card", (outcome, label) => {
      render(outcome);

      const badge = byTestId("request-item-card")!.querySelector(
        '[data-testid="history-request-detail-status"]',
      );
      expect(badge?.textContent?.trim()).toBe(label);
    });
  });

  describe("details", () => {
    it("shows the requester, the requested window and when it was submitted", () => {
      render("denied");

      const details = byTestId("history-request-detail-details")!;
      expect(details.textContent).toContain("details");
      expect(details.textContent).toContain("marcus.chen");
      expect(textOf("history-request-detail-window")).toMatch(/^pamInboxDurationHours 4, Oct 21/);
      expect(textOf("history-request-detail-submitted")).toContain("Oct 21, 2026");
    });

    it("shows the reason only when one was given", () => {
      render("denied", { reason: "Quarterly close" });
      expect(textOf("history-request-detail-reason")).toBe("Quarterly close");

      render("denied", { reason: "   " });
      expect(byTestId("history-request-detail-reason")).toBeNull();
    });
  });

  describe("decision", () => {
    it("names the denier, their email and comment on a denied request", () => {
      render("denied", {
        decisions: [
          humanDecision({
            id: "a",
            name: "derek.finnegan",
            email: "derek.finnegan@acme.com",
            verdict: "deny",
            comment: "Not needed.",
          }),
        ],
      });

      const decision = byTestId("history-request-detail-decision")!;
      expect(decision.textContent).toContain("pamDeniedBy");
      expect(textOf("history-request-detail-decider")).toBe("derek.finnegan");
      expect(textOf("history-request-detail-email")).toBe("derek.finnegan@acme.com");
      expect(textOf("history-request-detail-comment")).toBe("Not needed.");
      expect(byTestId("history-request-detail-resolved")).not.toBeNull();
    });

    it("credits an access rule by its label, with no email row", () => {
      render("sessionEnded", { status: "approved", decisions: [automaticDecision()] });

      expect(textOf("history-request-detail-decider")).toBe("pamResolverAccessRule");
      expect(byTestId("history-request-detail-email")).toBeNull();
    });

    it("leaves out the comment row when the decision carried none", () => {
      render("sessionEnded", {
        status: "approved",
        decisions: [humanDecision({ id: "a", name: "derek" })],
      });

      expect(byTestId("history-request-detail-comment")).toBeNull();
    });

    it.each(["canceled", "expired"] as const)(
      "shows only when a %s request was resolved, since nobody decided it",
      (outcome) => {
        render(outcome, { status: outcome });

        expect(byTestId("history-request-detail-decision")).not.toBeNull();
        expect(byTestId("history-request-detail-decider")).toBeNull();
        expect(byTestId("history-request-detail-resolved")).not.toBeNull();
      },
    );

    it("puts the exact time behind the relative one", () => {
      render("denied");

      expect(byTestId("history-request-detail-resolved")!.getAttribute("title")).toContain(
        "Oct 21, 2026",
      );
    });

    it("is left out entirely with no decision and no resolved time", () => {
      render("canceled", { status: "canceled", resolvedAt: undefined });

      expect(byTestId("history-request-detail-decision")).toBeNull();
    });
  });
});
