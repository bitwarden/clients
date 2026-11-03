import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, map, of } from "rxjs";

import { ClientType } from "@bitwarden/common/enums";
import { AvailableRegionsService } from "@bitwarden/common/platform/abstractions/available-regions.service";
import {
  Environment,
  EnvironmentService,
  Region,
  RegionConfig,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  DialogService,
  I18nMockService,
  MenuTriggerForDirective,
  ToastService,
} from "@bitwarden/components";

import { SelfHostedEnvConfigDialogComponent } from "../self-hosted-env-config-dialog";

import { SelectedServer, ServerSelectorComponent } from "./server-selector.component";

// eslint-disable-next-line no-console
const originalError = console.error;
// eslint-disable-next-line no-console
console.error = (...args: unknown[]) => {
  // Opening the menu overlay makes JSDOM parse stylesheets it can't handle; safe to ignore.
  if (
    typeof args[0] === "object" &&
    (args[0] as Error)?.message?.includes("Could not parse CSS stylesheet")
  ) {
    return;
  }
  originalError(...args);
};

const regions: RegionConfig[] = [
  { key: Region.US, domain: "bitwarden.com", urls: {} } as RegionConfig,
  { key: Region.EU, domain: "bitwarden.eu", urls: {} } as RegionConfig,
];

type SetupOptions = {
  clientType?: ClientType;
  isSelfHost?: boolean;
  label?: string;
  readonly?: boolean;
};

describe("ServerSelectorComponent", () => {
  let fixture: ComponentFixture<ServerSelectorComponent>;
  let environmentService: MockProxy<EnvironmentService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let availableRegionsService: MockProxy<AvailableRegionsService>;
  let toastService: MockProxy<ToastService>;
  let currentRegion$: BehaviorSubject<Region>;
  let emitted: SelectedServer[];

  const text = () => (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, " ");
  const trigger = (): HTMLButtonElement | null =>
    fixture.debugElement.query(By.css("#server-selector_button_trigger"))?.nativeElement ?? null;
  const triggerDirective = () =>
    fixture.debugElement
      .query(By.directive(MenuTriggerForDirective))
      ?.injector.get(MenuTriggerForDirective);
  const menuItems = (): HTMLButtonElement[] =>
    Array.from(document.querySelectorAll<HTMLButtonElement>(".bit-menu-panel button"));
  const openMenu = () => {
    trigger()!.click();
    fixture.detectChanges();
  };

  async function setup(options: SetupOptions = {}) {
    platformUtilsService.getClientType.mockReturnValue(options.clientType ?? ClientType.Browser);
    platformUtilsService.isSelfHost.mockReturnValue(options.isSelfHost ?? false);

    await TestBed.configureTestingModule({
      imports: [ServerSelectorComponent],
      providers: [
        { provide: EnvironmentService, useValue: environmentService },
        { provide: AvailableRegionsService, useValue: availableRegionsService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: toastService },
        {
          provide: I18nService,
          useValue: new I18nMockService({
            loggingInOn: "Logging in on",
            selfHostedServer: "self-hosted",
            environmentSaved: "Environment URLs saved",
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ServerSelectorComponent);
    if (options.label !== undefined) {
      fixture.componentRef.setInput("label", options.label);
    }
    if (options.readonly !== undefined) {
      fixture.componentRef.setInput("readonly", options.readonly);
    }
    fixture.componentInstance.selectedRegionChange.subscribe((server) => emitted.push(server));
    fixture.detectChanges();
  }

  beforeEach(() => {
    emitted = [];
    currentRegion$ = new BehaviorSubject<Region>(Region.US);
    environmentService = mock<EnvironmentService>();
    // Assigned rather than passed to mock(), which would deep-proxy the observable.
    environmentService.globalEnvironment$ = currentRegion$.pipe(
      map((region) => {
        const env = mock<Environment>();
        env.getRegion.mockReturnValue(region);
        return env;
      }),
    );
    environmentService.availableRegions.mockReturnValue(regions);
    environmentService.setEnvironment.mockResolvedValue({});
    platformUtilsService = mock<PlatformUtilsService>();
    availableRegionsService = mock<AvailableRegionsService>();
    availableRegionsService.availableRegions$ = of(regions);
    toastService = mock<ToastService>();
  });

  afterEach(() => {
    if (triggerDirective()?.isOpen()) {
      triggerDirective()!.toggleMenu();
    }
    jest.restoreAllMocks();
  });

  describe("label", () => {
    it("renders the default label followed by the selected domain", async () => {
      await setup();
      expect(text()).toContain("Logging in on: bitwarden.com");
    });

    it("renders a custom label", async () => {
      await setup({ label: "Creating account on" });
      expect(text()).toContain("Creating account on: bitwarden.com");
    });

    it("shows self-hosted when the environment matches no cloud region", async () => {
      await setup();
      currentRegion$.next(Region.SelfHosted);
      fixture.detectChanges();

      expect(trigger()!.textContent).toContain("self-hosted");
    });
  });

  describe("read-only", () => {
    it("shows the domain as text without a menu trigger", async () => {
      await setup({ readonly: true, label: "Creating account on" });

      expect(text()).toContain("Creating account on: bitwarden.com");
      expect(trigger()).toBeNull();
      expect(triggerDirective()).toBeUndefined();
    });
  });

  describe("visibility", () => {
    it("renders nothing on a self-hosted web vault", async () => {
      await setup({ clientType: ClientType.Web, isSelfHost: true });
      expect(text()?.trim()).toBe("");
    });

    it("renders on a cloud web vault", async () => {
      await setup({ clientType: ClientType.Web, isSelfHost: false });
      expect(trigger()).not.toBeNull();
    });
  });

  describe("menu", () => {
    it("flips the chevron while the menu is open", async () => {
      await setup();
      expect(trigger()!.querySelector(".bwi-angle-down")).toBeTruthy();

      openMenu();
      expect(trigger()!.querySelector(".bwi-angle-up")).toBeTruthy();

      triggerDirective()!.toggleMenu();
      fixture.detectChanges();
      expect(trigger()!.querySelector(".bwi-angle-down")).toBeTruthy();
    });

    it("marks the selected region with a visible check and aria-pressed", async () => {
      await setup();
      openMenu();

      const [us, eu, selfHosted] = menuItems();
      expect(us.getAttribute("aria-pressed")).toBe("true");
      expect(eu.getAttribute("aria-pressed")).toBe("false");
      expect(selfHosted.getAttribute("aria-pressed")).toBe("false");

      const check = (item: HTMLButtonElement) => item.querySelector("bit-icon")!;
      expect(check(us).classList).not.toContain("tw-invisible");
      expect(check(eu).classList).toContain("tw-invisible");
      expect(check(us).getAttribute("style")).toBeNull();
      expect(check(us).classList).toContain("bwi-fw");
    });

    it("offers self-hosted on browser and desktop", async () => {
      await setup({ clientType: ClientType.Desktop });
      openMenu();

      expect(menuItems().map((item) => item.textContent?.trim())).toEqual([
        "bitwarden.com",
        "bitwarden.eu",
        "self-hosted",
      ]);
    });

    it("doesn't offer self-hosted on web", async () => {
      await setup({ clientType: ClientType.Web });
      openMenu();

      expect(menuItems().map((item) => item.textContent?.trim())).toEqual([
        "bitwarden.com",
        "bitwarden.eu",
      ]);
    });

    it("sets the environment when a cloud region is chosen", async () => {
      await setup();
      openMenu();
      menuItems()[1].click();

      expect(environmentService.setEnvironment).toHaveBeenCalledWith(Region.EU);
    });

    it("opens the self-hosted dialog without setting the environment", async () => {
      const openSpy = jest
        .spyOn(SelfHostedEnvConfigDialogComponent, "open")
        .mockResolvedValue(false);
      await setup();

      openMenu();
      menuItems()[2].click();
      await fixture.whenStable();

      expect(openSpy).toHaveBeenCalled();
      expect(environmentService.setEnvironment).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("shows a success toast when the self-hosted dialog saves", async () => {
      jest.spyOn(SelfHostedEnvConfigDialogComponent, "open").mockResolvedValue(true);
      await setup();

      openMenu();
      menuItems()[2].click();
      await fixture.whenStable();

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: "",
        message: "Environment URLs saved",
      });
    });
  });

  describe("selectedRegionChange", () => {
    it("emits the current server on load and whenever it changes", async () => {
      await setup();
      currentRegion$.next(Region.EU);
      currentRegion$.next(Region.SelfHosted);

      expect(emitted).toEqual([regions[0], regions[1], Region.SelfHosted]);
    });
  });
});
