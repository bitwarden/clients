import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, map, of } from "rxjs";

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
import { DialogService, ToastService } from "@bitwarden/components";

import { SelfHostedEnvConfigDialogComponent } from "../self-hosted-env-config-dialog";

import { SelectedServer, ServerSelectionService } from "./server-selection.service";

const regions: RegionConfig[] = [
  { key: Region.US, domain: "bitwarden.com", urls: {} } as RegionConfig,
  { key: Region.EU, domain: "bitwarden.eu", urls: {} } as RegionConfig,
];

describe("ServerSelectionService", () => {
  let environmentService: MockProxy<EnvironmentService>;
  let availableRegionsService: MockProxy<AvailableRegionsService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let toastService: MockProxy<ToastService>;
  let i18nService: MockProxy<I18nService>;
  let currentRegion$: BehaviorSubject<Region>;

  function createService(clientType = ClientType.Browser, isSelfHost = false) {
    platformUtilsService.getClientType.mockReturnValue(clientType);
    platformUtilsService.isSelfHost.mockReturnValue(isSelfHost);

    TestBed.configureTestingModule({
      providers: [
        ServerSelectionService,
        { provide: EnvironmentService, useValue: environmentService },
        { provide: AvailableRegionsService, useValue: availableRegionsService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
      ],
    });
    return TestBed.inject(ServerSelectionService);
  }

  beforeEach(() => {
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
    availableRegionsService = mock<AvailableRegionsService>();
    availableRegionsService.availableRegions$ = of(regions);
    platformUtilsService = mock<PlatformUtilsService>();
    toastService = mock<ToastService>();
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => key);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("selectedServer$", () => {
    it("emits the region matching the environment, and follows changes", () => {
      const service = createService();
      const emitted: SelectedServer[] = [];
      const sub = service.selectedServer$.subscribe((server) => emitted.push(server));

      currentRegion$.next(Region.EU);
      currentRegion$.next(Region.SelfHosted);
      sub.unsubscribe();

      expect(emitted).toEqual([regions[0], regions[1], Region.SelfHosted]);
    });
  });

  it("exposes the available cloud regions", async () => {
    const service = createService();
    expect(await firstValueFrom(service.availableRegions$)).toEqual(regions);
  });

  describe("platform rules", () => {
    it.each([
      [ClientType.Browser, true],
      [ClientType.Desktop, true],
      [ClientType.Web, false],
    ])("self-hosted available on %s: %s", (clientType, expected) => {
      expect(createService(clientType).selfHostedAvailable).toBe(expected);
    });

    it("is hidden on a self-hosted web vault", () => {
      expect(createService(ClientType.Web, true).hidden).toBe(true);
    });

    it("is shown on a cloud web vault and on desktop", () => {
      expect(createService(ClientType.Web, false).hidden).toBe(false);
      TestBed.resetTestingModule();
      expect(createService(ClientType.Desktop, true).hidden).toBe(false);
    });
  });

  describe("selectRegion", () => {
    it("sets the environment to the chosen region", async () => {
      await createService().selectRegion(regions[1]);
      expect(environmentService.setEnvironment).toHaveBeenCalledWith(Region.EU);
    });
  });

  describe("selectSelfHosted", () => {
    it("opens the dialog without setting the environment or a toast when cancelled", async () => {
      const openSpy = jest
        .spyOn(SelfHostedEnvConfigDialogComponent, "open")
        .mockResolvedValue(false);

      await createService().selectSelfHosted();

      expect(openSpy).toHaveBeenCalled();
      expect(environmentService.setEnvironment).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("shows a success toast when the dialog saves", async () => {
      jest.spyOn(SelfHostedEnvConfigDialogComponent, "open").mockResolvedValue(true);

      await createService().selectSelfHosted();

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: "",
        message: "environmentSaved",
      });
    });
  });
});
