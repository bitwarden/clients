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
    accessRequestSdkService.getCipherAccessState.mockResolvedValue({
      badgeState: { active: { expiresAt: new Date(Date.now() + 12 * 60 * 1000).toISOString() } },
    } as unknown as CipherAccessStateView);

    create(gatedCipher());
    await settle();

    expect(component["badge"]()).toBeNull();
    expect(
      fixture.nativeElement.querySelector("[data-testid='item-details-state-badge']"),
    ).toBeNull();
  });

  it("renders nothing when the access-state read fails", async () => {
    accessRequestSdkService.getCipherAccessState.mockRejectedValue(new Error("boom"));

    create(gatedCipher());
    await settle();

    expect(component["badge"]()).toBeNull();
  });
});
