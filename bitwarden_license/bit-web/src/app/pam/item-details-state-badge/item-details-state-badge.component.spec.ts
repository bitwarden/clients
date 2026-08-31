import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject, Subject } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import type { CipherAccessStateView } from "@bitwarden/sdk-internal";

import { AccessRefreshService } from "../abstractions/access-refresh.service";
import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";

import { ItemDetailsStateBadgeComponent } from "./item-details-state-badge.component";

describe("ItemDetailsStateBadgeComponent", () => {
  let fixture: ComponentFixture<ItemDetailsStateBadgeComponent>;
  let component: ItemDetailsStateBadgeComponent;
  let enabled$: BehaviorSubject<boolean>;
  let accessChanged$: Subject<void>;
  let accessRequestSdkService: {
    getCipherAccessState: jest.Mock<Promise<CipherAccessStateView>, [string]>;
  };

  function create(cipher: CipherView): void {
    fixture = TestBed.createComponent(ItemDetailsStateBadgeComponent);
    fixture.componentRef.setInput("cipher", cipher);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /**
   * A state under an active lease. The SDK ranks the badge FROM the lease, so the two always
   * travel together; a fixture carrying only the badge is a response the server cannot produce.
   */
  function activeLeaseState(notAfterMs: number): CipherAccessStateView {
    const notAfter = new Date(notAfterMs).toISOString();
    return {
      cipherId: "cipher-1",
      activeLease: { id: "lease-1", notAfter },
      badgeState: { active: { expiresAt: notAfter } },
    } as unknown as CipherAccessStateView;
  }

  function gatedCipher(): CipherView {
    const cipher = new CipherView();
    cipher.id = "cipher-1";
    cipher.partial = true;
    return cipher;
  }

  beforeEach(() => {
    enabled$ = new BehaviorSubject<boolean>(true);
    accessChanged$ = new Subject<void>();
    accessRequestSdkService = { getCipherAccessState: jest.fn() };

    TestBed.configureTestingModule({
      imports: [ItemDetailsStateBadgeComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => enabled$ } },
        { provide: AccessRequestSdkService, useValue: accessRequestSdkService },
        {
          provide: AccessRefreshService,
          useValue: { accessChanged$: () => accessChanged$, notifyAccessChanged: () => {} },
        },
        { provide: LogService, useValue: { error: jest.fn() } },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders nothing for an ungoverned cipher, and reads no access state", async () => {
    const cipher = new CipherView();
    cipher.id = "cipher-9";
    cipher.partial = false;

    create(cipher);
    await settle();

    expect(component["badge"]()).toBeNull();
    expect(fixture.nativeElement.textContent.trim()).toBe("");
    expect(
      fixture.nativeElement.querySelector("[data-testid='item-details-state-badge']"),
    ).toBeNull();
    expect(accessRequestSdkService.getCipherAccessState).not.toHaveBeenCalled();
  });

  it("renders nothing when the PAM flag is off, even for a gated cipher", async () => {
    enabled$.next(false);

    create(gatedCipher());
    await settle();

    expect(component["badge"]()).toBeNull();
    expect(accessRequestSdkService.getCipherAccessState).not.toHaveBeenCalled();
  });

  it("renders the resting privileged pill for a gated cipher", async () => {
    accessRequestSdkService.getCipherAccessState.mockResolvedValue({
      badgeState: "privileged",
    } as unknown as CipherAccessStateView);

    create(gatedCipher());
    await settle();

    expect(component["badge"]()?.kind).toBe("privileged");
    expect(
      fixture.nativeElement.querySelector("[data-testid='access-state-badge-privileged']"),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector("[data-testid='item-details-state-badge']"),
    ).not.toBeNull();
  });

  it("reads the state again when access changes, so it cannot contradict the card below", async () => {
    accessRequestSdkService.getCipherAccessState
      .mockResolvedValueOnce({ badgeState: "pending" } as unknown as CipherAccessStateView)
      .mockResolvedValueOnce({ badgeState: "privileged" } as unknown as CipherAccessStateView);

    create(gatedCipher());
    await settle();
    expect(component["badge"]()?.kind).toBe("pending");

    accessChanged$.next();
    await settle();

    expect(component["badge"]()?.kind).toBe("privileged");
    expect(accessRequestSdkService.getCipherAccessState).toHaveBeenCalledTimes(2);
  });

  it("renders nothing for an active lease, so the banner heading is the only countdown", async () => {
    accessRequestSdkService.getCipherAccessState.mockResolvedValue(
      activeLeaseState(Date.now() + 12 * 60 * 1000),
    );

    create(gatedCipher());
    await settle();

    expect(component["badge"]()).toBeNull();
    expect(
      fixture.nativeElement.querySelector("[data-testid='item-details-state-badge']"),
    ).toBeNull();
  });

  it("brings the pill back the second the lease's window closes", async () => {
    // PM-41837: nothing announces the lapse, so this host watches the shared badge clock for it.
    jest.useFakeTimers();
    accessRequestSdkService.getCipherAccessState.mockResolvedValue(
      activeLeaseState(Date.now() + 5_000),
    );

    create(gatedCipher());
    await jest.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(component["badge"]()).toBeNull();

    await jest.advanceTimersByTimeAsync(6_000);
    fixture.detectChanges();

    // Released, not re-read; the shared badge renders its own "Access ended" recipe.
    expect(component["badge"]()?.kind).toBe("active");
    expect(accessRequestSdkService.getCipherAccessState).toHaveBeenCalledTimes(1);
    expect(
      fixture.nativeElement.querySelector("[data-testid='access-state-badge-expired']"),
    ).not.toBeNull();
  });

  it("shows the badge for a lease the server still reports past its window", async () => {
    // Suppressed on the window, not the `active` ranking, or a trailing server clock would hide
    // the pill for good while the banner below had already fallen back to "Request access".
    accessRequestSdkService.getCipherAccessState.mockResolvedValue(
      activeLeaseState(Date.now() - 1_000),
    );

    create(gatedCipher());
    await settle();

    expect(component["badge"]()?.kind).toBe("active");
    expect(
      fixture.nativeElement.querySelector("[data-testid='access-state-badge-expired']"),
    ).not.toBeNull();
  });

  it("renders nothing when the access-state read fails", async () => {
    accessRequestSdkService.getCipherAccessState.mockRejectedValue(new Error("boom"));

    create(gatedCipher());
    await settle();

    expect(component["badge"]()).toBeNull();
  });
});
