import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, map, of } from "rxjs";

import { AvailableRegionsService } from "@bitwarden/common/platform/abstractions/available-regions.service";
import {
  Environment,
  EnvironmentService,
  Region,
  RegionConfig,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DialogService,
  I18nMockService,
  MenuTriggerForDirective,
  ToastService,
} from "@bitwarden/components";

import { SelfHostedEnvConfigDialogComponent } from "../self-hosted-env-config-dialog";

import { LoginServerSelectorComponent } from "./login-server-selector.component";

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

describe("LoginServerSelectorComponent", () => {
  let fixture: ComponentFixture<LoginServerSelectorComponent>;
  let environmentService: MockProxy<EnvironmentService>;
  let toastService: MockProxy<ToastService>;
  let currentRegion$: BehaviorSubject<Region>;

  const trigger = (): HTMLButtonElement =>
    fixture.debugElement.query(By.css("[data-testid='login-server-selector-trigger']"))
      .nativeElement;
  const triggerDirective = () =>
    fixture.debugElement
      .query(By.directive(MenuTriggerForDirective))
      .injector.get(MenuTriggerForDirective);
  const menuItems = (): HTMLButtonElement[] =>
    Array.from(document.querySelectorAll<HTMLButtonElement>(".bit-menu-panel button"));
  const openMenu = () => {
    trigger().click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    currentRegion$ = new BehaviorSubject<Region>(Region.US);
    environmentService = mock<EnvironmentService>();
    environmentService.availableRegions.mockReturnValue(regions);
    environmentService.setEnvironment.mockResolvedValue({});
    Object.defineProperty(environmentService, "globalEnvironment$", {
      value: currentRegion$.pipe(map((region) => ({ getRegion: () => region }) as Environment)),
    });
    toastService = mock<ToastService>();

    await TestBed.configureTestingModule({
      imports: [LoginServerSelectorComponent],
      providers: [
        { provide: EnvironmentService, useValue: environmentService },
        {
          provide: AvailableRegionsService,
          useValue: { availableRegions$: of(regions) } as Partial<AvailableRegionsService>,
        },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: toastService },
        {
          provide: I18nService,
          useValue: new I18nMockService({
            loggingInOn: "Logging in on:",
            selfHostedServer: "self-hosted",
            environmentSaved: "Environment URLs saved",
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginServerSelectorComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    if (triggerDirective().isOpen()) {
      triggerDirective().toggleMenu();
    }
    jest.restoreAllMocks();
  });

  it("renders the label followed by the selected domain", () => {
    const text = (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, " ");
    expect(text).toContain("Logging in on: bitwarden.com");
  });

  it("shows self-hosted when the environment matches no cloud region", () => {
    currentRegion$.next(Region.SelfHosted);
    fixture.detectChanges();

    expect(trigger().textContent).toContain("self-hosted");
  });

  it("flips the chevron while the menu is open", () => {
    expect(trigger().querySelector(".bwi-angle-down")).toBeTruthy();

    openMenu();
    expect(trigger().querySelector(".bwi-angle-up")).toBeTruthy();
    expect(trigger().querySelector(".bwi-angle-down")).toBeNull();

    triggerDirective().toggleMenu();
    fixture.detectChanges();
    expect(trigger().querySelector(".bwi-angle-down")).toBeTruthy();
  });

  it("marks the selected region as pressed", () => {
    openMenu();

    const [us, eu, selfHosted] = menuItems();
    expect(us.getAttribute("aria-pressed")).toBe("true");
    expect(eu.getAttribute("aria-pressed")).toBe("false");
    expect(selfHosted.getAttribute("aria-pressed")).toBe("false");
  });

  it("sets the environment when a cloud region is chosen", () => {
    openMenu();
    menuItems()[1].click();

    expect(environmentService.setEnvironment).toHaveBeenCalledWith(Region.EU);
  });

  it("opens the self-hosted dialog without setting the environment", async () => {
    const openSpy = jest.spyOn(SelfHostedEnvConfigDialogComponent, "open").mockResolvedValue(false);

    openMenu();
    menuItems()[2].click();
    await fixture.whenStable();

    expect(openSpy).toHaveBeenCalled();
    expect(environmentService.setEnvironment).not.toHaveBeenCalled();
    expect(toastService.showToast).not.toHaveBeenCalled();
  });

  it("shows a success toast when the self-hosted dialog saves", async () => {
    jest.spyOn(SelfHostedEnvConfigDialogComponent, "open").mockResolvedValue(true);

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
