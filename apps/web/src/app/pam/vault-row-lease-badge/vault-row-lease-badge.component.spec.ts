import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";
import { CipherLeaseState, LeaseResponse, PamApiService } from "@bitwarden/pam";

import { PamMockConfig } from "../mock/pam-mock-config";

import { VaultRowLeaseBadgeComponent } from "./vault-row-lease-badge.component";

describe("VaultRowLeaseBadgeComponent", () => {
  let pamFlag$: BehaviorSubject<boolean>;
  let leaseState$: Subject<CipherLeaseState>;
  let pamApi: { getCipherLeaseState$: jest.Mock };

  beforeEach(async () => {
    pamFlag$ = new BehaviorSubject<boolean>(true);
    leaseState$ = new Subject<CipherLeaseState>();
    pamApi = { getCipherLeaseState$: jest.fn(() => leaseState$.asObservable()) };

    const accountService = mock<AccountService>();
    (accountService as any).activeAccount$ = of({ id: "user-1" });

    await TestBed.configureTestingModule({
      imports: [VaultRowLeaseBadgeComponent],
      providers: [
        { provide: AccountService, useValue: accountService },
        {
          provide: ConfigService,
          useValue: {
            getFeatureFlag$: jest
              .fn()
              .mockImplementation((flag: FeatureFlag) =>
                flag === FeatureFlag.Pam ? pamFlag$.asObservable() : of(false),
              ),
          },
        },
        { provide: PamApiService, useValue: pamApi },
        {
          provide: I18nService,
          useValue: new I18nMockService({
            cipherLeaseRequiresApproval: "Requires approval to view",
            cipherLeaseExpiresIn: "Leased — expires in __$1__",
          }),
        },
      ],
    }).compileComponents();
  });

  const create = (cipherId: string): ComponentFixture<VaultRowLeaseBadgeComponent> => {
    const fixture = TestBed.createComponent(VaultRowLeaseBadgeComponent);
    fixture.componentRef.setInput("cipherId", cipherId);
    fixture.detectChanges();
    return fixture;
  };

  const badgeEl = (fixture: ComponentFixture<VaultRowLeaseBadgeComponent>): HTMLElement | null =>
    fixture.nativeElement.querySelector("app-cipher-lease-badge");

  it("renders nothing when the Pam feature flag is OFF", () => {
    pamFlag$.next(false);
    jest.spyOn(PamMockConfig, "shouldGate").mockReturnValue(true);

    const fixture = create("any-cipher");

    expect(badgeEl(fixture)).toBeNull();
    expect(pamApi.getCipherLeaseState$).not.toHaveBeenCalled();
  });

  it("renders nothing when the cipher is not gated", () => {
    jest.spyOn(PamMockConfig, "shouldGate").mockReturnValue(false);

    const fixture = create("ungated-cipher");

    expect(badgeEl(fixture)).toBeNull();
    expect(pamApi.getCipherLeaseState$).not.toHaveBeenCalled();
  });

  it("renders the gated-no-lease badge when the cipher has neither lease nor request", () => {
    jest.spyOn(PamMockConfig, "shouldGate").mockReturnValue(true);

    const fixture = create("gated-cipher");
    leaseState$.next({});
    fixture.detectChanges();

    expect(badgeEl(fixture)).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="cipher-lease-badge-gated"]'),
    ).not.toBeNull();
  });

  it("renders the active-lease badge when the cipher has an active lease", () => {
    jest.spyOn(PamMockConfig, "shouldGate").mockReturnValue(true);
    const activeLease = {
      cipherId: "gated-cipher",
      granteeUserId: "user-1",
      status: "active",
      notAfter: new Date(Date.now() + 60_000).toISOString(),
    } as unknown as LeaseResponse;

    const fixture = create("gated-cipher");
    leaseState$.next({ activeLease });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="cipher-lease-badge-active"]'),
    ).not.toBeNull();
  });

  it("updates from gated-no-lease to active when a lease arrives on the stream", () => {
    jest.spyOn(PamMockConfig, "shouldGate").mockReturnValue(true);
    const fixture = create("gated-cipher");

    leaseState$.next({});
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-testid="cipher-lease-badge-gated"]'),
    ).not.toBeNull();

    leaseState$.next({
      activeLease: {
        cipherId: "gated-cipher",
        granteeUserId: "user-1",
        status: "active",
        notAfter: new Date(Date.now() + 60_000).toISOString(),
      } as unknown as LeaseResponse,
    });
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-testid="cipher-lease-badge-active"]'),
    ).not.toBeNull();
  });
});
