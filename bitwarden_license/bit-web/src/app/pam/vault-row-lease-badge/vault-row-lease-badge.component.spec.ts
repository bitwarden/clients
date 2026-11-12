import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject, of, Subject } from "rxjs";

import type { AccessBadgeState } from "@bitwarden/bit-pam";
import { MyAccessRequestsService } from "@bitwarden/bit-pam-components";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { VaultRowLeaseBadgeComponent } from "./vault-row-lease-badge.component";

const PAM_ORG = "org-1";
const PLAIN_ORG = "org-2";

describe("VaultRowLeaseBadgeComponent", () => {
  let fixture: ComponentFixture<VaultRowLeaseBadgeComponent>;
  let component: VaultRowLeaseBadgeComponent;
  let enabled$: BehaviorSubject<boolean>;
  let organizations$: BehaviorSubject<{ id: string; usePam: boolean }[]>;
  // The caller's badges from their own requests; a Subject, so "not loaded yet" can be tested.
  let badges$: Subject<ReadonlyMap<string, AccessBadgeState>>;

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

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    enabled$ = new BehaviorSubject<boolean>(true);
    organizations$ = new BehaviorSubject<{ id: string; usePam: boolean }[]>([
      { id: PAM_ORG, usePam: true },
      { id: PLAIN_ORG, usePam: false },
    ]);
    badges$ = new Subject<ReadonlyMap<string, AccessBadgeState>>();

    TestBed.configureTestingModule({
      imports: [VaultRowLeaseBadgeComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => enabled$ } },
        { provide: MyAccessRequestsService, useValue: { badges$ } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: OrganizationService, useValue: { organizations$: () => organizations$ } },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    });
  });

  it("renders nothing for a non-gated cipher, and does not read the caller's badges", async () => {
    create(ungatedCipher(PAM_ORG));
    await settle();

    expect(component["badge"]()).toBeNull();
    expect(badges$.observed).toBe(false);
  });

  it("renders nothing when the PAM flag is off, even if the cipher is gated", async () => {
    enabled$.next(false);

    create(gatedCipher());
    await settle();

    expect(component["badge"]()).toBeNull();
    expect(badges$.observed).toBe(false);
  });

  it("resolves the privileged (resting) state when the caller holds nothing on the cipher", async () => {
    create(gatedCipher());
    badges$.next(new Map([["other-cipher", { kind: "pending" }]]));
    await settle();

    expect(component["badge"]()?.kind).toBe("privileged");
  });

  it("resolves the active state with the lease expiry when a lease is active", async () => {
    const expiresAt = new Date(Date.now() + 60_000);

    create(gatedCipher());
    badges$.next(new Map([["cipher-1", { kind: "active", expiresAt }]]));
    await settle();

    expect(component["badge"]()).toEqual({ kind: "active", expiresAt });
  });

  it("resolves the pending state when a request is awaiting a decision", async () => {
    create(gatedCipher());
    badges$.next(new Map([["cipher-1", { kind: "pending" }]]));
    await settle();

    expect(component["badge"]()?.kind).toBe("pending");
  });

  it("renders nothing until the caller's requests have loaded", async () => {
    create(gatedCipher());
    await settle();

    expect(component["badge"]()).toBeNull();
  });

  it("follows the caller's badges as they change, as after a cancel from the row's menu", async () => {
    create(gatedCipher());
    badges$.next(new Map([["cipher-1", { kind: "pending" }]]));
    await settle();
    expect(component["badge"]()?.kind).toBe("pending");

    badges$.next(new Map());
    await settle();

    expect(component["badge"]()?.kind).toBe("privileged");
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

    // `hasEnabledAccessRule` defaults false, so an older server looks like one reporting no rule.
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

    it("draws no em dash before the caller's requests load, which is not evidence of no rule", async () => {
      create(gatedCipher(PAM_ORG));
      await settle();

      expect(component["showNoAccessRule"]()).toBe(false);
      expect(placeholder()).toBeNull();
    });

    it("draws the badge and no em dash when the row is governed", async () => {
      create(gatedCipher(PAM_ORG));
      badges$.next(new Map());
      await settle();

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
