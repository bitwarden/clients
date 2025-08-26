import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Router, RouterModule } from "@angular/router";
import { BehaviorSubject } from "rxjs";

import { BrowserExtensionIcon } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DeviceType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { StateProvider } from "@bitwarden/common/platform/state";
import { AnonLayoutWrapperDataService } from "@bitwarden/components";

import { WebBrowserInteractionService } from "../../services/web-browser-interaction.service";

import { SetupExtensionComponent, SetupExtensionState } from "./setup-extension.component";

describe("SetupExtensionComponent", () => {
  let fixture: ComponentFixture<SetupExtensionComponent>;
  let component: SetupExtensionComponent;

  const navigate = jest.fn().mockResolvedValue(true);
  const openExtension = jest.fn().mockResolvedValue(true);
  const update = jest.fn().mockResolvedValue(true);
  const setAnonLayoutWrapperData = jest.fn();
  const extensionInstalled$ = new BehaviorSubject<boolean | null>(null);

  beforeEach(async () => {
    navigate.mockClear();
    openExtension.mockClear();
    update.mockClear();
    setAnonLayoutWrapperData.mockClear();
    window.matchMedia = jest.fn().mockReturnValue(false);

    await TestBed.configureTestingModule({
      imports: [SetupExtensionComponent, RouterModule.forRoot([])],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: WebBrowserInteractionService, useValue: { extensionInstalled$, openExtension } },
        { provide: PlatformUtilsService, useValue: { getDevice: () => DeviceType.UnknownBrowser } },
        { provide: AnonLayoutWrapperDataService, useValue: { setAnonLayoutWrapperData } },
        {
          provide: AccountService,
          useValue: { activeAccount$: new BehaviorSubject({ account: { id: "account-id" } }) },
        },
        {
          provide: StateProvider,
          useValue: { getUser: () => ({ update }) },
        },
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
    it("redirects to the vault if the user is on a mobile browser", async () => {
      Utils.isMobileBrowser = true;
      navigate.mockClear();

      await component.ngOnInit();

      expect(navigate).toHaveBeenCalledWith(["/vault"]);
    });

    it("does not redirect the user", async () => {
      Utils.isMobileBrowser = false;
      navigate.mockClear();

      await component.ngOnInit();

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

      it("dismisses the extension page", () => {
        expect(update).toHaveBeenCalledTimes(1);
      });

      it("shows error state when extension fails to open", fakeAsync(() => {
        openExtension.mockRejectedValueOnce(new Error("Failed to open extension"));

        const openExtensionButton = fixture.debugElement.query(By.css("button"));

        openExtensionButton.triggerEventHandler("click");

        tick();

        expect(component["state"]).toBe(SetupExtensionState.ManualOpen);
        expect(setAnonLayoutWrapperData).toHaveBeenCalledWith({
          pageTitle: {
            key: "somethingWentWrong",
          },
          pageIcon: BrowserExtensionIcon,
          hideIcon: false,
          hideCardWrapper: false,
          maxWidth: "md",
        });
      }));
    });
  });
});
