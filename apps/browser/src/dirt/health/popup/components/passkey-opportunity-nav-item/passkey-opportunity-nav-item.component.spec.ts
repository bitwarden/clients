import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";

import { VaultHealthReportStatus } from "@bitwarden/common/dirt/vault-health/models";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import {
  HEALTH_PASSKEYS_ROUTE,
  PasskeyOpportunityNavItemComponent,
} from "./passkey-opportunity-nav-item.component";

describe("PasskeyOpportunityNavItemComponent", () => {
  let fixture: ComponentFixture<PasskeyOpportunityNavItemComponent>;

  async function render(status: VaultHealthReportStatus, count: number | null, locked = false) {
    fixture.componentRef.setInput("status", status);
    fixture.componentRef.setInput("count", count);
    fixture.componentRef.setInput("locked", locked);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function text(): string {
    return fixture.nativeElement.textContent.replace(/\s+/g, " ").trim();
  }

  function link(): HTMLAnchorElement | null {
    return fixture.nativeElement.querySelector("a[bit-item-content]");
  }

  function retryButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector("#passkey-opportunity-nav-item_button_retry");
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasskeyOpportunityNavItemComponent, RouterTestingModule],
      providers: [
        {
          provide: I18nService,
          // Echo the key plus any non-empty substitutions.
          useValue: {
            t: (key: string, ...args: unknown[]) =>
              [key, ...args.filter((a) => a != null && a !== "")].join(" "),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PasskeyOpportunityNavItemComponent);
  });

  it.each([VaultHealthReportStatus.Idle, VaultHealthReportStatus.Loading])(
    "shows progress, not a count, before any result (%s)",
    async (status) => {
      await render(status, null);

      expect(text()).toContain("passkeyOpportunitiesChecking");
      expect(fixture.nativeElement.querySelector("[role=status]")).not.toBeNull();
      expect(link()).toBeNull();
    },
  );

  it("shows the failure with a retry when the first check failed", async () => {
    await render(VaultHealthReportStatus.Error, null);

    expect(text()).toContain("passkeyOpportunitiesFailed");
    expect(text()).toContain("passkeyOpportunitiesFailedDesc");
    expect(link()).toBeNull();
  });

  it("emits retry when the retry button is pressed", async () => {
    await render(VaultHealthReportStatus.Error, null);
    const retry = jest.fn();
    fixture.componentInstance.retry.subscribe(retry);

    retryButton()!.click();

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it.each([
    [0, "passkeyOpportunitiesNone", "passkeyOpportunitiesNoneDesc"],
    [1, "passkeyOpportunity", "passkeyOpportunitiesDesc"],
    [4, "passkeyOpportunitiesPlural 4", "passkeyOpportunitiesDesc"],
  ])("renders a count of %s as a category row", async (count, title, description) => {
    await render(VaultHealthReportStatus.Success, count);

    expect(text()).toContain(title);
    expect(text()).toContain(description);
  });

  it("links the row to the passkey detail page", async () => {
    await render(VaultHealthReportStatus.Success, 2);

    expect(link()!.getAttribute("href")).toBe(HEALTH_PASSKEYS_ROUTE);
  });

  describe("when locked behind Premium", () => {
    it("shows the category with a labelled lock, no count, and no link", async () => {
      await render(VaultHealthReportStatus.Idle, null, true);

      expect(text()).toContain("passkeyOpportunitiesLocked");
      // The description carries the reason to upgrade, next to the lock.
      expect(text()).toContain("passkeyOpportunitiesLockedDesc");
      expect(link()).toBeNull();
      const lock = fixture.nativeElement.querySelector("bit-icon[slot=end]");
      expect(lock.getAttribute("aria-label") ?? lock.textContent).toContain(
        "premiumSubscriptionRequired",
      );
    });

    it.each([
      [VaultHealthReportStatus.Error, null],
      [VaultHealthReportStatus.Success, 3],
    ])("stays locked whatever the check state (%s)", async (status, count) => {
      await render(status, count, true);

      expect(text()).toContain("passkeyOpportunitiesLocked");
      expect(link()).toBeNull();
      expect(retryButton()).toBeNull();
    });
  });

  it("keeps an earlier count on screen when a later check failed", async () => {
    await render(VaultHealthReportStatus.Error, 3);

    expect(text()).toContain("passkeyOpportunitiesPlural 3");
    expect(retryButton()).toBeNull();
  });
});
