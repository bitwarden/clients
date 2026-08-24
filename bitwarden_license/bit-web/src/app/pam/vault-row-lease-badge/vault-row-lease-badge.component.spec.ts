import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import type { CipherAccessStateView } from "@bitwarden/sdk-internal";

import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";

import { VaultRowLeaseBadgeComponent } from "./vault-row-lease-badge.component";

const PAM_ORG = "org-1";
const PLAIN_ORG = "org-2";

describe("VaultRowLeaseBadgeComponent", () => {
  let fixture: ComponentFixture<VaultRowLeaseBadgeComponent>;
  let component: VaultRowLeaseBadgeComponent;
  let enabled$: BehaviorSubject<boolean>;
  let accessRequestSdkService: {
    getCipherAccessState: jest.Mock<Promise<CipherAccessStateView>, [string]>;
  };
  let organizations$: BehaviorSubject<{ id: string; usePam: boolean }[]>;

  function create(cipher: CipherView): void {
    fixture = TestBed.createComponent(VaultRowLeaseBadgeComponent);
    fixture.componentRef.setInput("cipher", cipher);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function createForCollection(collection: { hasEnabledAccessRule?: boolean }): void {
    fixture = TestBed.createComponent(VaultRowLeaseBadgeComponent);
    fixture.componentRef.setInput("collection", collection);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function gatedCipher(organizationId = PAM_ORG): CipherView {
    const cipher = new CipherView();
    cipher.id = "cipher-1";
    cipher.partial = true;
    cipher.organizationId = organizationId as CipherView["organizationId"];
    return cipher;
  }

  function ungatedCipher(organizationId?: string): CipherView {
    const cipher = new CipherView();
    cipher.id = "cipher-1";
    cipher.partial = false;
    cipher.organizationId = (organizationId ?? null) as CipherView["organizationId"];
    return cipher;
  }

  function placeholder(): HTMLElement | null {
    return fixture.nativeElement.querySelector("[data-testid='vault-row-no-access-rule']");
  }

  beforeEach(() => {
    enabled$ = new BehaviorSubject<boolean>(true);
    accessRequestSdkService = { getCipherAccessState: jest.fn() };
    organizations$ = new BehaviorSubject<{ id: string; usePam: boolean }[]>([
      { id: PAM_ORG, usePam: true },
      { id: PLAIN_ORG, usePam: false },
    ]);

    TestBed.configureTestingModule({
      imports: [VaultRowLeaseBadgeComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => enabled$ } },
        { provide: AccessRequestSdkService, useValue: accessRequestSdkService },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: OrganizationService, useValue: { organizations$: () => organizations$ } },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    });
  });

  it("renders nothing for a non-gated cipher", async () => {
    accessRequestSdkService.getCipherAccessState.mockResolvedValue({} as CipherAccessStateView);

    create(ungatedCipher(PAM_ORG));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component["badge"]()).toBeNull();
    expect(accessRequestSdkService.getCipherAccessState).not.toHaveBeenCalled();
  });

  it("renders nothing when the PAM flag is off, even if the cipher is gated", async () => {
    enabled$.next(false);

    create(gatedCipher());
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component["badge"]()).toBeNull();
    expect(accessRequestSdkService.getCipherAccessState).not.toHaveBeenCalled();
  });

  it("resolves the privileged (resting) state when gated with no request or lease", async () => {
    accessRequestSdkService.getCipherAccessState.mockResolvedValue({
      activeLease: undefined,
      pendingRequest: undefined,
      approvedRequest: undefined,
      badgeState: "privileged",
    } as unknown as CipherAccessStateView);

    create(gatedCipher());
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component["badge"]()?.kind).toBe("privileged");
  });

  it("resolves the active state with the lease expiry when a lease is active", async () => {
    const notAfter = new Date(Date.now() + 60_000).toISOString();
    accessRequestSdkService.getCipherAccessState.mockResolvedValue({
      activeLease: { id: "lease-1", notAfter },
      badgeState: { active: { expiresAt: notAfter } },
    } as unknown as CipherAccessStateView);

    create(gatedCipher());
    await fixture.whenStable();
    fixture.detectChanges();

    const badge = component["badge"]();
    expect(badge?.kind).toBe("active");
    expect(badge).toEqual({ kind: "active", expiresAt: new Date(notAfter) });
  });

  it("resolves the pending state when a request is awaiting a decision", async () => {
    accessRequestSdkService.getCipherAccessState.mockResolvedValue({
      pendingRequest: {},
      badgeState: "pending",
    } as unknown as CipherAccessStateView);

    create(gatedCipher());
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component["badge"]()?.kind).toBe("pending");
  });

  it("renders nothing when the access-state fetch fails", async () => {
    accessRequestSdkService.getCipherAccessState.mockRejectedValue(new Error("boom"));

    create(gatedCipher());
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component["badge"]()).toBeNull();
  });

  describe("the no-access-rule placeholder", () => {
    it("draws an em dash for an ungated cipher in a PAM organization", async () => {
      create(ungatedCipher(PAM_ORG));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component["showNoAccessRule"]()).toBe(true);
      expect(placeholder()?.textContent?.trim()).toBe("\u2014");
    });

    it("names the empty state for screen readers, since the dash is aria-hidden", async () => {
      create(ungatedCipher(PAM_ORG));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(placeholder()?.getAttribute("aria-hidden")).toBe("true");
      expect(fixture.nativeElement.querySelector(".tw-sr-only")?.textContent?.trim()).toBe(
        "pamNoAccessRule",
      );
    });

    // `hasEnabledAccessRule` defaults to false and is read off the response as `|| false`, so a
    // server too old to derive it looks exactly like one reporting no rule. Blank, not a dash.
    it("draws no em dash for an ungoverned collection, whose flag cannot say it was checked", () => {
      createForCollection({ hasEnabledAccessRule: false });

      expect(component["showNoAccessRule"]()).toBe(false);
      expect(placeholder()).toBeNull();
    });

    it("draws no em dash for a cipher whose organization does not use PAM", async () => {
      create(ungatedCipher(PLAIN_ORG));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component["showNoAccessRule"]()).toBe(false);
      expect(placeholder()).toBeNull();
    });

    it("draws no em dash for a collection a rule does govern", () => {
      createForCollection({ hasEnabledAccessRule: true });

      expect(component["showNoAccessRule"]()).toBe(false);
      expect(placeholder()).toBeNull();
    });

    it("draws no em dash for a personal cipher, which belongs to no organization", async () => {
      create(ungatedCipher());
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component["showNoAccessRule"]()).toBe(false);
      expect(placeholder()).toBeNull();
    });

    it("draws no em dash while the PAM flag is off", async () => {
      enabled$.next(false);

      create(ungatedCipher(PAM_ORG));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component["showNoAccessRule"]()).toBe(false);
      expect(placeholder()).toBeNull();
    });

    it("draws no em dash when the access-state fetch fails, which is not evidence of no rule", async () => {
      accessRequestSdkService.getCipherAccessState.mockRejectedValue(new Error("boom"));

      create(gatedCipher(PAM_ORG));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component["showNoAccessRule"]()).toBe(false);
      expect(placeholder()).toBeNull();
    });

    it("draws the badge and no em dash when the row is governed", async () => {
      accessRequestSdkService.getCipherAccessState.mockResolvedValue({
        badgeState: "privileged",
      } as unknown as CipherAccessStateView);

      create(gatedCipher(PAM_ORG));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component["showNoAccessRule"]()).toBe(false);
      expect(placeholder()).toBeNull();
    });
  });

  describe("on a collection row", () => {
    it("resolves the privileged pill when the collection has an enabled access rule", () => {
      createForCollection({ hasEnabledAccessRule: true });

      expect(component["badge"]()).toEqual({ kind: "privileged" });
    });

    it("renders nothing for an ungoverned collection", () => {
      createForCollection({ hasEnabledAccessRule: false });

      expect(component["badge"]()).toBeNull();
    });

    it("renders nothing while the PAM flag is off", () => {
      enabled$.next(false);

      createForCollection({ hasEnabledAccessRule: true });

      expect(component["badge"]()).toBeNull();
    });

    it("renders nothing for pseudo-collections carrying no server state (e.g. Unassigned)", () => {
      createForCollection({});

      expect(component["badge"]()).toBeNull();
    });
  });
});
