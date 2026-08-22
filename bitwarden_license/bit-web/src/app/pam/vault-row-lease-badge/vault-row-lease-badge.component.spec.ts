import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import type { CipherAccessStateView } from "@bitwarden/sdk-internal";

import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";

import { VaultRowLeaseBadgeComponent } from "./vault-row-lease-badge.component";

describe("VaultRowLeaseBadgeComponent", () => {
  let fixture: ComponentFixture<VaultRowLeaseBadgeComponent>;
  let component: VaultRowLeaseBadgeComponent;
  let enabled$: BehaviorSubject<boolean>;
  let accessRequestSdkService: {
    getCipherAccessState: jest.Mock<Promise<CipherAccessStateView>, [string]>;
  };

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

  function gatedCipher(): CipherView {
    const cipher = new CipherView();
    cipher.id = "cipher-1";
    cipher.partial = true;
    return cipher;
  }

  beforeEach(() => {
    enabled$ = new BehaviorSubject<boolean>(true);
    accessRequestSdkService = { getCipherAccessState: jest.fn() };

    TestBed.configureTestingModule({
      imports: [VaultRowLeaseBadgeComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => enabled$ } },
        { provide: AccessRequestSdkService, useValue: accessRequestSdkService },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    });
  });

  it("renders nothing for a non-gated cipher", async () => {
    accessRequestSdkService.getCipherAccessState.mockResolvedValue({} as CipherAccessStateView);
    const cipher = new CipherView();
    cipher.id = "cipher-1";
    cipher.partial = false;

    create(cipher);
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
