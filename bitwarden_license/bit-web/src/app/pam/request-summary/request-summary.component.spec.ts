import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { RequestSummaryComponent } from "./request-summary.component";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RequestSummaryComponent],
  template: `
    <pam-request-summary
      [itemName]="itemName()"
      [organizationName]="organizationName()"
      [collectionName]="collectionName()"
      [requesterName]="requesterName()"
      [requesterEmail]="requesterEmail()"
      [duration]="{ key: 'pamInboxDuration1Hour', value: null }"
      [relativeStart]="{ key: 'pamInboxStartTomorrow', value: null }"
      [reason]="reason()"
    >
      <div data-testid="host-row">Resolved</div>
    </pam-request-summary>
  `,
})
class HostComponent {
  readonly itemName = signal("Prod database");
  readonly organizationName = signal<string | null>("Meridian Group");
  readonly collectionName = signal<string | null>("Production");
  readonly requesterName = signal("Grace Hopper");
  readonly requesterEmail = signal<string | null>("grace@example.com");
  readonly reason = signal<string | null>("prod incident");
}

describe("RequestSummaryComponent", () => {
  let fixture: ComponentFixture<HostComponent>;

  function card(name: "item" | "details"): HTMLElement {
    return fixture.nativeElement.querySelector(`[data-testid="request-summary-${name}"]`);
  }

  function fieldValue(id: string): string {
    return (fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement).value;
  }

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ").trim() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it("puts the item, its organization and its collection in the item card", () => {
    expect(card("item").textContent).toContain("Prod database");
    expect(card("item").textContent).toContain("Meridian Group");
    expect(card("item").textContent).toContain("Production");
    expect(card("item").querySelector(".bwi-business")).not.toBeNull();
    expect(card("item").querySelector(".bwi-collection")).not.toBeNull();
  });

  it("says which of the two item-card names is the organization and which is the collection", () => {
    expect(card("item").querySelector(".bwi-business")!.getAttribute("aria-label")).toBe(
      "organization",
    );
    expect(card("item").querySelector(".bwi-collection")!.getAttribute("aria-label")).toBe(
      "collection",
    );
  });

  it("names the collection only in the item card, never as a request-details row", () => {
    expect(card("details").textContent).not.toContain("Production");
  });

  it("renders nothing at all for names that did not resolve", () => {
    fixture.componentInstance.organizationName.set(null);
    fixture.componentInstance.collectionName.set(null);
    fixture.detectChanges();

    expect(card("item").querySelector(".bwi-business")).toBeNull();
    expect(card("item").querySelector(".bwi-collection")).toBeNull();
  });

  it("shows the requester's name with their email beside it", () => {
    expect(card("details").textContent).toContain("Grace Hopper");
    expect(card("details").textContent).toContain("<grace@example.com>");
  });

  it("does not repeat the email when it is already standing in for the name", () => {
    fixture.componentInstance.requesterName.set("grace@example.com");
    fixture.detectChanges();

    expect(card("details").textContent).not.toContain("<grace@example.com>");
  });

  it("joins the window's duration and start into one requested-access line", () => {
    expect(fieldValue("pam-request-summary_input_access-requested")).toBe(
      "pamInboxDuration1Hour, pamInboxStartTomorrow",
    );
  });

  it("quotes the reason", () => {
    expect(fieldValue("pam-request-summary_input_reason")).toBe("“prod incident”");
  });

  it("wraps a long reason rather than clipping it to a single line", () => {
    fixture.componentInstance.reason.set("x".repeat(400));
    fixture.detectChanges();

    const reason = fixture.nativeElement.querySelector("#pam-request-summary_input_reason");
    expect(reason.tagName).toBe("TEXTAREA");
    expect(reason.value).toContain("x".repeat(400));
  });

  it("leaves the reason field empty, with placeholder copy, when none was given", () => {
    fixture.componentInstance.reason.set(null);
    fixture.detectChanges();

    const reason = fixture.nativeElement.querySelector(
      "#pam-request-summary_input_reason",
    ) as HTMLInputElement;
    expect(reason.value).toBe("");
    expect(reason.placeholder).toContain("pamInboxReasonMissing");
  });

  it("projects the host's extra rows into the request-details card", () => {
    expect(card("details").querySelector('[data-testid="host-row"]')).not.toBeNull();
  });
});
