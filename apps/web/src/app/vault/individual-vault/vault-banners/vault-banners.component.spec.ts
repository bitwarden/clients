import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { BannerModule } from "@bitwarden/components";

import { LooseComponentsModule } from "../../../shared";

import { VaultBannersService, VisibleVaultBanner } from "./services/vault-banners.service";
import { VaultBannersComponent } from "./vault-banners.component";

describe("VaultBannersComponent", () => {
  let component: VaultBannersComponent;
  let fixture: ComponentFixture<VaultBannersComponent>;

  const bannerService = mock<VaultBannersService>({
    shouldShowPremiumBanner: jest.fn(),
    shouldShowUpdateBrowserBanner: jest.fn(),
    shouldShowVerifyEmailBanner: jest.fn(),
    shouldShowLowKDFBanner: jest.fn(),
    bannerDismissed: jest.fn(),
  });

  beforeEach(async () => {
    bannerService.shouldShowPremiumBanner.mockResolvedValue(false);
    bannerService.shouldShowUpdateBrowserBanner.mockResolvedValue(false);
    bannerService.shouldShowVerifyEmailBanner.mockResolvedValue(false);
    bannerService.shouldShowLowKDFBanner.mockResolvedValue(false);

    await TestBed.configureTestingModule({
      imports: [BannerModule, LooseComponentsModule],
      declarations: [VaultBannersComponent, I18nPipe],
      providers: [
        {
          provide: VaultBannersService,
          useValue: bannerService,
        },
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
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VaultBannersComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  describe("determineVisibleBanner", () => {
    [
      {
        name: "Premium",
        method: bannerService.shouldShowPremiumBanner,
        banner: VisibleVaultBanner.Premium,
      },
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

          expect(bannerService.bannerDismissed).toHaveBeenCalledWith(banner);

          expect(component.visibleBanners).toEqual([]);
        });
      });
    });
  });
});
