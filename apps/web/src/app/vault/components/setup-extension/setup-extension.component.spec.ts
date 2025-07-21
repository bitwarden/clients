import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Router, RouterModule } from "@angular/router";
import { BehaviorSubject } from "rxjs";

import { DeviceType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { WebBrowserInteractionService } from "../../services/web-browser-interaction.service";

import { SetupExtensionComponent } from "./setup-extension.component";

describe("SetupExtensionComponent", () => {
  let fixture: ComponentFixture<SetupExtensionComponent>;
  let component: SetupExtensionComponent;

  const getFeatureFlag = jest.fn().mockResolvedValue(false);
  const navigate = jest.fn().mockResolvedValue(true);
  const openExtension = jest.fn().mockResolvedValue(true);
  const extensionInstalled$ = new BehaviorSubject<boolean | null>(null);

  beforeEach(async () => {
    navigate.mockClear();
    openExtension.mockClear();
    getFeatureFlag.mockClear().mockResolvedValue(true);
    window.matchMedia = jest.fn().mockReturnValue(false);

    await TestBed.configureTestingModule({
      imports: [SetupExtensionComponent, RouterModule.forRoot([])],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: ConfigService, useValue: { getFeatureFlag } },
        { provide: WebBrowserInteractionService, useValue: { extensionInstalled$, openExtension } },
        { provide: PlatformUtilsService, useValue: { getDevice: () => DeviceType.UnknownBrowser } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SetupExtensionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    router.navigate = navigate;
  });

  it("initially shows the loading spinner", () => {
    const spinner = fixture.debugElement.query(By.css("i"));

    expect(spinner.nativeElement.title).toBe("loading");
  });

  it("sets webStoreUrl", () => {
    expect(component["webStoreUrl"]).toBe("https://bitwarden.com/download/#downloads-web-browser");
  });

  describe("initialization", () => {
    it("redirects to the vault if the feature flag is disabled", async () => {
      Utils.isMobileBrowser = false;
      getFeatureFlag.mockResolvedValue(false);
      navigate.mockClear();

      await component.ngOnInit();

      expect(navigate).toHaveBeenCalledWith(["/vault"]);
    });

    it("redirects to the vault if the user is on a mobile browser", async () => {
      Utils.isMobileBrowser = true;
      getFeatureFlag.mockResolvedValue(true);
      navigate.mockClear();

      await component.ngOnInit();

      expect(navigate).toHaveBeenCalledWith(["/vault"]);
    });

    it("does not redirect the user", async () => {
      Utils.isMobileBrowser = false;
      getFeatureFlag.mockResolvedValue(true);
      navigate.mockClear();

      await component.ngOnInit();

      expect(getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.PM19315EndUserActivationMvp);
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe("extensionInstalled$", () => {
    it("redirects the user to the vault when the first emitted value is true", () => {
      extensionInstalled$.next(true);

      expect(navigate).toHaveBeenCalledWith(["/vault"]);
    });

    describe("success state", () => {
      beforeEach(() => {
        // avoid initial redirect
        extensionInstalled$.next(false);

        fixture.detectChanges();

        extensionInstalled$.next(true);
        fixture.detectChanges();
      });

      it("shows link to the vault", () => {
        const successLink = fixture.debugElement.query(By.css("a"));

        expect(successLink.nativeElement.href).toContain("/vault");
      });

      it("shows open extension button", () => {
        const openExtensionButton = fixture.debugElement.query(By.css("button"));

        openExtensionButton.triggerEventHandler("click");

        expect(openExtension).toHaveBeenCalled();
      });
    });
  });
});
