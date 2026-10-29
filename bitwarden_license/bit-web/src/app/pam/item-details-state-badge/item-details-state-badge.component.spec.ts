import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject, of, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
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
  let revealed$: BehaviorSubject<ReadonlyMap<CipherId, CipherView>>;
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
   * The SDK ranks the badge from the lease, so a fixture carrying only the badge is a response the
   * server cannot produce.
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
    revealed$ = new BehaviorSubject<ReadonlyMap<CipherId, CipherView>>(new Map());
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
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: RevealedCipherService, useValue: { revealed$: () => revealed$ } },
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

  it("reads access state for a revealed cipher whose partial data is gone", async () => {
    accessRequestSdkService.getCipherAccessState.mockResolvedValue(activeLeaseState(Date.now()));
    const cipher = new CipherView();
    cipher.id = "cipher-1";
    cipher.partial = false;
    revealed$.next(new Map([["cipher-1" as CipherId, cipher]]));

    create(cipher);
    await settle();

    expect(accessRequestSdkService.getCipherAccessState).toHaveBeenCalledWith("cipher-1");
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

  it("accepts isAdminConsole without changing what it reads", async () => {
    accessRequestSdkService.getCipherAccessState.mockResolvedValue(activeLeaseState(Date.now()));
    fixture = TestBed.createComponent(ItemDetailsStateBadgeComponent);
    fixture.componentRef.setInput("cipher", gatedCipher());
    fixture.componentRef.setInput("isAdminConsole", true);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await settle();

    expect(component.isAdminConsole()).toBe(true);
    expect(accessRequestSdkService.getCipherAccessState).toHaveBeenCalledWith("cipher-1");
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
    // Nothing announces the lapse, so this host watches the shared badge clock for it.
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

    expect(component["badge"]()?.kind).toBe("active");
    expect(accessRequestSdkService.getCipherAccessState).toHaveBeenCalledTimes(2);
    expect(
      fixture.nativeElement.querySelector("[data-testid='access-state-badge-expired']"),
    ).not.toBeNull();
  });

  it("keeps the pill withheld past the original end of a lease extended elsewhere", async () => {
    jest.useFakeTimers();
    accessRequestSdkService.getCipherAccessState.mockResolvedValue(
      activeLeaseState(Date.now() + 5_000),
    );

    create(gatedCipher());
    await jest.advanceTimersByTimeAsync(0);
    fixture.detectChanges();

    accessRequestSdkService.getCipherAccessState.mockResolvedValue(
      activeLeaseState(Date.now() + 1_800_000),
    );
    await jest.advanceTimersByTimeAsync(6_000);
    fixture.detectChanges();

    expect(component["badge"]()).toBeNull();
    expect(accessRequestSdkService.getCipherAccessState).toHaveBeenCalledTimes(2);
  });

  it("shows the badge for a lease the server still reports past its window", async () => {
    // Suppressed on the window, not the `active` ranking, or a trailing server clock would hide
    // the pill for good.
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
