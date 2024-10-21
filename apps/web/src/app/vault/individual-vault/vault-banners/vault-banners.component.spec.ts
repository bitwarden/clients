import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { RouterTestingModule } from "@angular/router/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, Observable } from "rxjs";

import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { BannerComponent, BannerModule } from "@bitwarden/components";

import { VerifyEmailComponent } from "../../../auth/settings/verify-email.component";
import { SharedModule } from "../../../shared";

import { VaultBannersService, VisibleVaultBanner } from "./services/vault-banners.service";
import { VaultBannersComponent } from "./vault-banners.component";

describe("VaultBannersComponent", () => {
  let component: VaultBannersComponent;
  let fixture: ComponentFixture<VaultBannersComponent>;
  const premiumBanner$ = new BehaviorSubject<boolean>(false);
  const mockUserId = Utils.newGuid() as UserId;

  const bannerService = mock<VaultBannersService>({
    shouldShowPremiumBanner$: jest.fn((userId$: Observable<UserId>) => premiumBanner$),
    shouldShowUpdateBrowserBanner: jest.fn(),
    shouldShowVerifyEmailBanner: jest.fn(),
    shouldShowLowKDFBanner: jest.fn(),
    dismissBanner: jest.fn(),
  });

  const accountService: FakeAccountService = mockAccountServiceWith(mockUserId);

  beforeEach(async () => {
    bannerService.shouldShowUpdateBrowserBanner.mockResolvedValue(false);
    bannerService.shouldShowVerifyEmailBanner.mockResolvedValue(false);
    bannerService.shouldShowLowKDFBanner.mockResolvedValue(false);

    premiumBanner$.next(false);

    await TestBed.configureTestingModule({
      imports: [
        BannerModule,
        SharedModule,
        VerifyEmailComponent,
        VaultBannersComponent,
        RouterTestingModule,
      ],
      declarations: [I18nPipe],
      providers: [
        {
          provide: I18nService,
          useValue: mock<I18nService>({ t: (key) => key }),
        },
        {
          provide: ApiService,
          useValue: mock<ApiService>(),
        },
        {
          provide: PlatformUtilsService,
          useValue: mock<PlatformUtilsService>(),
        },
        {
          provide: TokenService,
          useValue: mock<TokenService>(),
        },
        {
          provide: AccountService,
          useValue: accountService,
        },
      ],
    })
      .overrideProvider(VaultBannersService, { useValue: bannerService })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VaultBannersComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  describe("premiumBannerVisible$", () => {
    it("shows premium banner", async () => {
      premiumBanner$.next(true);

      fixture.detectChanges();

      const banner = fixture.debugElement.query(By.directive(BannerComponent));
      expect(banner.componentInstance.bannerType).toBe("premium");
    });

    it("dismisses premium banner", async () => {
      premiumBanner$.next(false);

      fixture.detectChanges();

      const banner = fixture.debugElement.query(By.directive(BannerComponent));
      expect(banner).toBeNull();
    });
  });

  describe("determineVisibleBanner", () => {
    [
      {
        name: "OutdatedBrowser",
        method: bannerService.shouldShowUpdateBrowserBanner,
        banner: VisibleVaultBanner.OutdatedBrowser,
      },
      {
        name: "VerifyEmail",
        method: bannerService.shouldShowVerifyEmailBanner,
        banner: VisibleVaultBanner.VerifyEmail,
      },
      {
        name: "LowKDF",
        method: bannerService.shouldShowLowKDFBanner,
        banner: VisibleVaultBanner.KDFSettings,
      },
    ].forEach(({ name, method, banner }) => {
      describe(name, () => {
        beforeEach(async () => {
          method.mockResolvedValue(true);

          await component.ngOnInit();
          fixture.detectChanges();
        });

        it(`shows ${name} banner`, async () => {
          expect(component.visibleBanners).toEqual([banner]);
        });

        it(`dismisses ${name} banner`, async () => {
          const dismissButton = fixture.debugElement.nativeElement.querySelector(
            'button[biticonbutton="bwi-close"]',
          );

          // Mock out the banner service returning false after dismissing
          method.mockResolvedValue(false);

          dismissButton.dispatchEvent(new Event("click"));

          expect(bannerService.dismissBanner).toHaveBeenCalledWith(mockUserId, banner);

          expect(component.visibleBanners).toEqual([]);
        });
      });
    });
  });
});
