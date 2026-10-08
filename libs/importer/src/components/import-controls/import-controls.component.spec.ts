import { LiveAnnouncer } from "@angular/cdk/a11y";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Validators } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { map, of, Subject, throwError } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ClientType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";

import { KeeperAuthError, KeeperAuthErrorCode } from "../../importers/keeper/access";
import { Loader } from "../../metadata";
import {
  CredentialKind,
  ImportOption,
  ImportResult,
  ImportResultError,
  ImportResultErrorKey,
  ImportType,
} from "../../models";
import {
  ImporterCapabilities,
  ImportMetadataServiceAbstraction,
  ImportServiceAbstraction,
} from "../../services";
import {
  ImportErrorDialogComponent,
  ImportSkippedItemsDialogComponent,
  ImportSuccessDialogComponent,
} from "../dialog";
import { KeeperDirectImportService } from "../keeper/keeper-direct-import.service";
import { LastPassDirectImportService } from "../lastpass/lastpass-direct-import.service";

import { ImportControlsComponent } from "./import-controls.component";

describe("ImportControlsComponent", () => {
  let fixture: ComponentFixture<ImportControlsComponent>;
  let importService: MockProxy<ImportServiceAbstraction>;
  let importMetadataService: MockProxy<ImportMetadataServiceAbstraction>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let logService: MockProxy<LogService>;
  let liveAnnouncer: MockProxy<LiveAnnouncer>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let policyService: MockProxy<PolicyService>;
  let accountService: MockProxy<AccountService>;
  let syncService: MockProxy<SyncService>;
  let keeperDirectImportService: MockProxy<KeeperDirectImportService>;
  let lastPassDirectImportService: MockProxy<LastPassDirectImportService>;

  const component = () => fixture.componentInstance as any;
  const byId = (id: string) => fixture.debugElement.query(By.css(`#${id}`));
  // jsdom's FileReader callback isn't tracked by Zone, so fixture.whenStable() won't wait for it.
  // Polls the actual condition (filePasswordCheckPending() leaving "pending") and returns as soon
  // as it settles, instead of racing a fixed-duration wait against variable scheduling.
  const flushFileRead = async () => {
    for (let i = 0; i < 40; i++) {
      if (!(component().filePasswordCheckPending() as boolean)) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
      fixture.detectChanges();
    }
    throw new Error("flushFileRead: filePasswordCheckPending() never settled after 40 polls");
  };

  const baseProviders = () => [
    { provide: ImportServiceAbstraction, useValue: importService },
    { provide: ImportMetadataServiceAbstraction, useValue: importMetadataService },
    { provide: PlatformUtilsService, useValue: platformUtilsService },
    { provide: I18nService, useValue: mock<I18nService>({ t: (key: string) => key }) },
    { provide: LogService, useValue: logService },
    { provide: LiveAnnouncer, useValue: liveAnnouncer },
    { provide: DialogService, useValue: dialogService },
    { provide: ToastService, useValue: toastService },
    { provide: PolicyService, useValue: policyService },
    { provide: AccountService, useValue: accountService },
    { provide: SyncService, useValue: syncService },
    { provide: KeeperDirectImportService, useValue: keeperDirectImportService },
    { provide: LastPassDirectImportService, useValue: lastPassDirectImportService },
    {
      provide: AbstractThemingService,
      useValue: { theme$: of(ThemeTypes.Light) } as Partial<AbstractThemingService>,
    },
  ];

  const setup = async (importType: ImportType, clientType: ClientType) => {
    platformUtilsService.getClientType.mockReturnValue(clientType);

    await TestBed.configureTestingModule({
      imports: [ImportControlsComponent],
      providers: baseProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(ImportControlsComponent);
    fixture.componentRef.setInput("importType", importType);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    logService = mock<LogService>();
    liveAnnouncer = mock<LiveAnnouncer>();
    importMetadataService = mock<ImportMetadataServiceAbstraction>();
    importMetadataService.init.mockResolvedValue(undefined);
    importMetadataService.metadata$.mockReturnValue(
      of<ImporterCapabilities>({ type: "chromecsv", loaders: [Loader.file] }),
    );
    // Default to an empty (but successful) profile list — otherwise the auto-mock returns
    // undefined, which defer() rejects, silently routing every test that never touches chromium
    // profiles directly through the error branch instead of an empty-success one.
    importMetadataService.getAvailableProfiles.mockResolvedValue([]);
    platformUtilsService = mock<PlatformUtilsService>();

    dialogService = mock<DialogService>();
    // Defaults dialog.closed to a resolved emission so unrelated tests don't hang.
    dialogService.open.mockReturnValue({ closed: of(undefined) } as any);
    toastService = mock<ToastService>();
    policyService = mock<PolicyService>();
    policyService.policyAppliesToUser$.mockReturnValue(of(false));
    accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: "test-user-id" } as unknown as Account);
    syncService = mock<SyncService>();
    syncService.fullSync.mockResolvedValue(true);
    keeperDirectImportService = mock<KeeperDirectImportService>();
    lastPassDirectImportService = mock<LastPassDirectImportService>();

    const options: Record<string, ImportOption> = {
      keeper: buildOption({
        id: "keeper",
        name: "Keeper",
        hasDirectImporter: true,
        acceptedFileTypes: ["csv", "json"],
        pasteFormats: ["csv", "json"],
        instructionLink: "https://bitwarden.com/help/import-from-keeper/",
      }),
      keepercsv: buildOption({
        id: "keepercsv",
        name: "Keeper (csv)",
        acceptedFileTypes: ["csv"],
        pasteFormats: ["csv"],
      }),
      keeperjson: buildOption({
        id: "keeperjson",
        name: "Keeper (json)",
        acceptedFileTypes: ["json"],
        pasteFormats: ["json"],
      }),
      lastpasscsv: buildOption({
        id: "lastpasscsv",
        name: "LastPass",
        hasDirectImporter: true,
        acceptedFileTypes: ["csv", "html"],
        pasteFormats: ["csv"],
      }),
      chromecsv: buildOption({
        id: "chromecsv",
        name: "Chrome",
        isBrowser: true,
        hasDirectImporter: true,
        loaders: [Loader.file],
      }),
      dashlanecsv: buildOption({
        id: "dashlanecsv",
        name: "Dashlane (csv)",
        instructionKey: "importDashlaneCsvInstructions",
      }),
      dashlanejson: buildOption({
        id: "dashlanejson",
        name: "Dashlane (json)",
        acceptedFileTypes: ["json"],
        pasteFormats: ["json"],
        instructionKey: "importDashlaneJsonInstructions",
      }),
      "1password1pux": buildOption({
        id: "1password1pux",
        name: "1Password (1pux/json)",
        acceptedFileTypes: ["1pux", "json"],
        pasteFormats: ["json"],
      }),
      "1password1pif": buildOption({
        id: "1password1pif",
        name: "1Password (1pif)",
        acceptedFileTypes: ["1pif"],
        pasteFormats: ["1pif"],
      }),
      "1passwordwincsv": buildOption({
        id: "1passwordwincsv",
        name: "1Password 6 and 7 Windows (csv)",
        acceptedFileTypes: ["csv"],
        pasteFormats: ["csv"],
      }),
      "1passwordmaccsv": buildOption({
        id: "1passwordmaccsv",
        name: "1Password 6 and 7 Mac (csv)",
        acceptedFileTypes: ["csv"],
        pasteFormats: ["csv"],
      }),
      keepass2xml: buildOption({
        id: "keepass2xml",
        name: "KeePass 2 (xml)",
        acceptedFileTypes: ["xml"],
        pasteFormats: ["xml"],
      }),
      keepasskdbx: buildOption({
        id: "keepasskdbx",
        name: "KeePass (kdbx)",
        acceptedFileTypes: ["kdbx"],
        pasteFormats: [],
        sdk: { fileTypes: ["kdbx"], credentialKind: CredentialKind.passwordWithKeyFile },
      }),
      keepassxcsv: buildOption({
        id: "keepassxcsv",
        name: "KeePassX (csv)",
        acceptedFileTypes: ["csv"],
        pasteFormats: ["csv"],
      }),
      bravecsv: buildOption({
        id: "bravecsv",
        name: "Brave",
        isBrowser: true,
        hasDirectImporter: true,
        instructionKey: "importChromiumAliasPreamble",
        instructionLink: "https://bitwarden.com/help/import-from-chrome/",
      }),
      delineaxml: buildOption({
        id: "delineaxml",
        name: "Delinea (xml)",
        acceptedFileTypes: ["xml"],
        pasteFormats: ["xml"],
      }),
      delineacsv: buildOption({
        id: "delineacsv",
        name: "Delinea (csv)",
      }),
      bitwardenjson: buildOption({
        id: "bitwardenjson",
        name: "Bitwarden (json)",
        acceptedFileTypes: ["json"],
        pasteFormats: ["json"],
      }),
      bitwardencsv: buildOption({
        id: "bitwardencsv",
        name: "Bitwarden (csv)",
        acceptedFileTypes: ["csv"],
        pasteFormats: ["csv"],
      }),
    };
    importService = mock<ImportServiceAbstraction>();
    importService.getImportOption.mockImplementation((id) => options[id]);
  });

  function buildOption(overrides: Partial<ImportOption> & { id: string }): ImportOption {
    return {
      name: overrides.id,
      featuredImporter: false,
      isBrowser: false,
      acceptedFileTypes: ["csv"],
      pasteFormats: ["csv"],
      hasDirectImporter: false,
      loaders: [Loader.file],
      ...overrides,
    };
  }

  describe("default mode selection", () => {
    it("defaults to direct for a vendor-direct importer on Desktop", async () => {
      await setup("keeper", ClientType.Desktop);
      expect(component().primaryMode()).toBe("direct");
    });

    it("defaults to direct for a vendor-direct importer on Browser", async () => {
      await setup("lastpasscsv", ClientType.Browser);
      expect(component().primaryMode()).toBe("direct");
    });

    it("never defaults to direct on Web, even when hasDirectImporter is true", async () => {
      await setup("keeper", ClientType.Web);
      expect(component().primaryMode()).toBe("manual");
    });

    it("defaults to chromium for a browser vendor once Loader.chromium is available", async () => {
      importMetadataService.metadata$.mockReturnValue(
        of<ImporterCapabilities>({ type: "chromecsv", loaders: [Loader.file, Loader.chromium] }),
      );
      await setup("chromecsv", ClientType.Desktop);
      expect(component().primaryMode()).toBe("chromium");
    });

    it("falls back to manual for a browser vendor with no chromium loader available", async () => {
      await setup("chromecsv", ClientType.Desktop);
      expect(component().primaryMode()).toBe("manual");
    });

    it("only reflects chromium availability once init() actually resolves, not before", async () => {
      let initResolved = false;
      let resolveInit!: () => void;
      importMetadataService.init.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveInit = () => {
            initResolved = true;
            resolve();
          };
        }),
      );
      importMetadataService.metadata$.mockImplementation(() =>
        of<ImporterCapabilities>({
          type: "chromecsv",
          loaders: initResolved ? [Loader.file, Loader.chromium] : [Loader.file],
        }),
      );
      platformUtilsService.getClientType.mockReturnValue(ClientType.Desktop);

      await TestBed.configureTestingModule({
        imports: [ImportControlsComponent],
        providers: baseProviders(),
      }).compileComponents();
      fixture = TestBed.createComponent(ImportControlsComponent);
      fixture.componentRef.setInput("importType", "chromecsv");
      fixture.detectChanges();

      expect(component().primaryMode()).toBe("manual");
      expect(byId("importer-controls_radio_file")).toBeFalsy();
      expect(fixture.debugElement.query(By.css("bit-spinner"))).toBeTruthy();
      expect(
        byId("importer-controls_button_continue").nativeElement.getAttribute("aria-disabled"),
      ).toBe("true");
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);
      await component().submit();
      expect(continueSpy).not.toHaveBeenCalled();

      resolveInit();
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component().primaryMode()).toBe("chromium");
      expect(fixture.debugElement.query(By.css("bit-spinner"))).toBeFalsy();
      expect(byId("importer-controls_select_profile")).toBeTruthy();
      expect(
        byId("importer-controls_button_continue").nativeElement.getAttribute("aria-disabled"),
      ).not.toBe("true");
    });

    it("defaults to manual for a vendor with no direct importer at all", async () => {
      await setup("dashlanecsv", ClientType.Desktop);
      expect(component().primaryMode()).toBe("manual");
    });
  });

  describe("chromium profiles", () => {
    it("populates the profile select with the real browser profiles once chromium mode resolves", async () => {
      importMetadataService.metadata$.mockReturnValue(
        of<ImporterCapabilities>({ type: "chromecsv", loaders: [Loader.file, Loader.chromium] }),
      );
      importMetadataService.getAvailableProfiles.mockResolvedValue([
        { id: "Default", name: "Default" },
        { id: "Profile 1", name: "Work" },
      ]);
      await setup("chromecsv", ClientType.Desktop);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(importMetadataService.getAvailableProfiles).toHaveBeenCalledWith("chromecsv");
      expect(component().profiles()).toEqual([
        { id: "Default", name: "Default" },
        { id: "Profile 1", name: "Work" },
      ]);
      expect(component().profilesPending()).toBe(false);
      expect(byId("importer-controls_select_profile")).toBeTruthy();
    });

    it("does not fetch profiles for a vendor that never resolves to chromium mode", async () => {
      await setup("keeper", ClientType.Desktop);

      expect(importMetadataService.getAvailableProfiles).not.toHaveBeenCalled();
      expect(component().profiles()).toEqual([]);
    });

    it("clears profiles when the vendor changes away from chromium mode", async () => {
      importMetadataService.metadata$.mockReturnValue(
        of<ImporterCapabilities>({ type: "chromecsv", loaders: [Loader.file, Loader.chromium] }),
      );
      importMetadataService.getAvailableProfiles.mockResolvedValue([
        { id: "Default", name: "Default" },
      ]);
      await setup("chromecsv", ClientType.Desktop);
      expect(component().profiles().length).toBe(1);

      fixture.componentRef.setInput("importType", "dashlanecsv");
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component().profiles()).toEqual([]);
    });

    it('refetches when switching between two different chromium vendors, even though both resolve to "chromium" mode', async () => {
      importMetadataService.metadata$.mockImplementation((type$) =>
        type$.pipe(map((type) => ({ type, loaders: [Loader.file, Loader.chromium] }))),
      );
      importMetadataService.getAvailableProfiles.mockImplementation((type) =>
        Promise.resolve([{ id: type, name: type }]),
      );
      await setup("chromecsv", ClientType.Desktop);
      expect(component().profiles()).toEqual([{ id: "chromecsv", name: "chromecsv" }]);
      component().formGroup.controls.profile.setValue("chromecsv");
      fixture.detectChanges();

      fixture.componentRef.setInput("importType", "bravecsv");
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component().primaryMode()).toBe("chromium");
      expect(importMetadataService.getAvailableProfiles).toHaveBeenCalledWith("bravecsv");
      expect(component().profiles()).toEqual([{ id: "bravecsv", name: "bravecsv" }]);
      // A profile id selected for Chrome must not survive into Brave's freshly-fetched list.
      expect(component().formGroup.controls.profile.value).toBe("");
    });

    it("falls back to an empty list when getAvailableProfiles rejects (e.g. browser access denied), but does not fail silently", async () => {
      importMetadataService.metadata$.mockReturnValue(
        of<ImporterCapabilities>({ type: "chromecsv", loaders: [Loader.file, Loader.chromium] }),
      );
      importMetadataService.getAvailableProfiles.mockRejectedValue(
        new Error("browserAccessDenied"),
      );

      await setup("chromecsv", ClientType.Desktop);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component().profiles()).toEqual([]);
      expect(component().profilesError()).toBe("browserAccessDenied");
      expect(logService.error).toHaveBeenCalledWith(
        "Error loading chromium profiles:",
        expect.any(Error),
      );
      const callout = byId("importer-controls_callout_profiles-error");
      expect(callout.nativeElement.textContent).toContain("browserAccessDenied");
      expect(liveAnnouncer.announce).toHaveBeenCalledWith("browserAccessDenied", "assertive");
    });

    it("surfaces an error when the fetch succeeds but returns no profiles at all, instead of leaving an unfillable required select", async () => {
      importMetadataService.metadata$.mockReturnValue(
        of<ImporterCapabilities>({ type: "chromecsv", loaders: [Loader.file, Loader.chromium] }),
      );
      importMetadataService.getAvailableProfiles.mockResolvedValue([]);

      await setup("chromecsv", ClientType.Desktop);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component().profiles()).toEqual([]);
      expect(component().profilesError()).toBe("noBrowserProfilesFound");
      expect(logService.error).not.toHaveBeenCalled();
      const callout = byId("importer-controls_callout_profiles-error");
      expect(callout.nativeElement.textContent).toContain("noBrowserProfilesFound");
      expect(liveAnnouncer.announce).toHaveBeenCalledWith("noBrowserProfilesFound", "assertive");
    });

    it("clears the selected profile after a chromium -> manual -> chromium toggle round trip", async () => {
      importMetadataService.metadata$.mockReturnValue(
        of<ImporterCapabilities>({ type: "chromecsv", loaders: [Loader.file, Loader.chromium] }),
      );
      importMetadataService.getAvailableProfiles.mockResolvedValue([
        { id: "Default", name: "Default" },
      ]);
      await setup("chromecsv", ClientType.Desktop);
      component().formGroup.controls.profile.setValue("Default");
      component().formGroup.controls.profile.markAsTouched();
      fixture.detectChanges();

      component().toggleToManual();
      fixture.detectChanges();
      component().toggleToAlternate();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component().primaryMode()).toBe("chromium");
      expect(component().formGroup.controls.profile.value).toBe("");
      expect(component().formGroup.controls.profile.touched).toBe(false);
    });

    it("shows the loading spinner and disables Continue while profiles are still resolving", async () => {
      let resolveProfiles!: (profiles: { id: string; name: string }[]) => void;
      importMetadataService.metadata$.mockReturnValue(
        of<ImporterCapabilities>({ type: "chromecsv", loaders: [Loader.file, Loader.chromium] }),
      );
      importMetadataService.getAvailableProfiles.mockReturnValue(
        new Promise((resolve) => {
          resolveProfiles = resolve;
        }),
      );
      platformUtilsService.getClientType.mockReturnValue(ClientType.Desktop);

      await TestBed.configureTestingModule({
        imports: [ImportControlsComponent],
        providers: baseProviders(),
      }).compileComponents();
      fixture = TestBed.createComponent(ImportControlsComponent);
      fixture.componentRef.setInput("importType", "chromecsv");
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component().primaryMode()).toBe("chromium");
      expect(component().profilesPending()).toBe(true);
      expect(fixture.debugElement.query(By.css("bit-spinner"))).toBeTruthy();
      expect(byId("importer-controls_select_profile")).toBeFalsy();
      expect(
        byId("importer-controls_button_continue").nativeElement.getAttribute("aria-disabled"),
      ).toBe("true");

      resolveProfiles([{ id: "Default", name: "Default" }]);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component().profilesPending()).toBe(false);
      expect(fixture.debugElement.query(By.css("bit-spinner"))).toBeFalsy();
      expect(byId("importer-controls_select_profile")).toBeTruthy();
      expect(
        byId("importer-controls_button_continue").nativeElement.getAttribute("aria-disabled"),
      ).not.toBe("true");
    });
  });

  describe("footer toggle", () => {
    it("has an alternate to toggle to when a direct importer exists", async () => {
      await setup("keeper", ClientType.Desktop);
      expect(component().hasAlternate()).toBe(true);
    });

    it("has no alternate for a file-only vendor", async () => {
      await setup("dashlanecsv", ClientType.Desktop);
      expect(component().hasAlternate()).toBe(false);
    });

    it("toggles to manual and back to the vendor's default", async () => {
      await setup("keeper", ClientType.Desktop);
      expect(component().primaryMode()).toBe("direct");

      component().toggleToManual();
      expect(component().primaryMode()).toBe("manual");

      component().toggleToAlternate();
      expect(component().primaryMode()).toBe("direct");
    });

    it("still submits after a manual-then-back-to-direct toggle round trip, driven by real clicks", async () => {
      await setup("keeper", ClientType.Desktop);

      byId("importer-controls_button_import-manually-instead").nativeElement.click();
      fixture.detectChanges();
      byId("importer-controls_button_directly-import-instead").nativeElement.click();
      fixture.detectChanges();

      expect(component().primaryMode()).toBe("direct");
      expect(
        byId("importer-controls_button_continue").nativeElement.getAttribute("aria-disabled"),
      ).not.toBe("true");
      expect(
        byId("importer-controls_button_back").nativeElement.getAttribute("aria-disabled"),
      ).not.toBe("true");

      byId("importer-controls_button_continue").nativeElement.click();
      fixture.detectChanges();

      expect(component().directStep()).toBe("credentials");
    });

    it("renders the correct button text for each direction, driven by real clicks — not just the internal signal", async () => {
      await setup("keeper", ClientType.Desktop);
      fixture.detectChanges();
      let manualLink = byId("importer-controls_button_import-manually-instead");
      expect(manualLink).toBeTruthy();
      expect(byId("importer-controls_button_directly-import-instead")).toBeFalsy();

      manualLink.nativeElement.click();
      fixture.detectChanges();

      expect(byId("importer-controls_button_import-manually-instead")).toBeFalsy();
      const directLink = byId("importer-controls_button_directly-import-instead");
      expect(directLink).toBeTruthy();

      directLink.nativeElement.click();
      fixture.detectChanges();

      manualLink = byId("importer-controls_button_import-manually-instead");
      expect(manualLink).toBeTruthy();
    });
  });

  describe("direct step progression", () => {
    it("starts on the intro sub-step and advances to credentials when the Continue button is clicked", async () => {
      await setup("keeper", ClientType.Desktop);
      expect(component().directStep()).toBe("intro");
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);
      byId("importer-controls_button_continue").nativeElement.click();
      fixture.detectChanges();

      expect(component().directStep()).toBe("credentials");
      expect(continueSpy).not.toHaveBeenCalled();
    });

    it("enables the Keeper email field only once the credentials sub-step is reached", async () => {
      await setup("keeper", ClientType.Desktop);
      expect(component().formGroup.controls.keeperEmail.disabled).toBe(true);

      component().continueFromIntro();
      fixture.detectChanges();

      expect(component().formGroup.controls.keeperEmail.disabled).toBe(false);
      expect(component().formGroup.controls.lastPassEmail.disabled).toBe(true);
    });

    it("does not show a stale required error immediately upon re-entering the credentials step", async () => {
      // touched survives disable/enable, so a stale error would else flash on re-entry.
      await setup("keeper", ClientType.Desktop);
      component().continueFromIntro();
      fixture.detectChanges();
      await component().submit();
      expect(component().formGroup.controls.keeperEmail.touched).toBe(true);
      expect(component().formGroup.controls.keeperEmail.invalid).toBe(true);

      component().toggleToManual();
      component().toggleToAlternate();
      fixture.detectChanges();
      component().continueFromIntro();
      fixture.detectChanges();

      expect(component().formGroup.controls.keeperEmail.touched).toBe(false);
    });

    it("enables the LastPass email field, not Keeper's, for lastpasscsv", async () => {
      await setup("lastpasscsv", ClientType.Browser);
      component().continueFromIntro();
      fixture.detectChanges();

      expect(component().formGroup.controls.lastPassEmail.disabled).toBe(false);
      expect(component().formGroup.controls.keeperEmail.disabled).toBe(true);
    });

    it("renders Keeper's region field, not LastPass's shared-folders checkbox, on the Keeper credentials screen", async () => {
      await setup("keeper", ClientType.Desktop);
      component().continueFromIntro();
      fixture.detectChanges();

      expect(byId("importer-controls_input_keeper-email")).toBeTruthy();
      expect(byId("importer-controls_select_keeper-region")).toBeTruthy();
      expect(byId("importer-controls_input_lastpass-email")).toBeFalsy();
      expect(byId("importer-controls_input_include-shared-folders")).toBeFalsy();
    });

    it("renders LastPass's shared-folders checkbox, not Keeper's region field, on the LastPass credentials screen", async () => {
      await setup("lastpasscsv", ClientType.Browser);
      component().continueFromIntro();
      fixture.detectChanges();

      expect(byId("importer-controls_input_lastpass-email")).toBeTruthy();
      expect(byId("importer-controls_input_include-shared-folders")).toBeTruthy();
      expect(byId("importer-controls_input_keeper-email")).toBeFalsy();
      expect(byId("importer-controls_select_keeper-region")).toBeFalsy();
    });
  });

  describe("vendor format grouping", () => {
    it("unions accepted file types across every sibling format", async () => {
      await setup("1password1pux", ClientType.Web);
      expect(component().acceptedFileTypes()).toEqual(
        expect.arrayContaining(["1pux", "json", "1pif", "csv"]),
      );
    });

    it("prefixes each extension with a dot in the hint text, unlike the raw acceptedFileTypes", async () => {
      await setup("dashlanecsv", ClientType.Web);
      expect(component().acceptedFileTypesHint()).toBe(".csv, .json");

      component().formGroup.controls.method.setValue("paste");
      fixture.detectChanges();
      expect(component().pasteFormatsHint()).toBe(".csv, .json");
    });

    // A user pick marks the control dirty (the select's view-to-model change); setValue() alone
    // is how the component seeds its default, so tests mark dirty to simulate a real pick.
    const pickFormat = (id: ImportType) => {
      component().formGroup.controls.formatChoice.setValue(id);
      component().formGroup.controls.formatChoice.markAsDirty();
      fixture.detectChanges();
    };

    it("shows the full sibling union for a format dropdown vendor (KeePass) until the user picks", async () => {
      await setup("keepass2xml", ClientType.Web);
      fixture.detectChanges();
      expect(component().acceptedFileTypesHint()).toBe(".xml, .kdbx, .csv");

      // Seeded without a user pick: must not narrow.
      component().formGroup.controls.formatChoice.setValue("keepasskdbx");
      fixture.detectChanges();
      expect(component().acceptedFileTypesHint()).toBe(".xml, .kdbx, .csv");
    });

    it("narrows the hint to the format the user picked from the dropdown (KeePass)", async () => {
      await setup("keepass2xml", ClientType.Web);
      pickFormat("keepasskdbx");
      expect(component().acceptedFileTypesHint()).toBe(".kdbx");

      pickFormat("keepassxcsv");
      expect(component().acceptedFileTypesHint()).toBe(".csv");
    });

    it("narrows 1Password's hint after a user pick, and keeps the union before it", async () => {
      await setup("1password1pux", ClientType.Web);
      fixture.detectChanges();
      expect(component().acceptedFileTypesHint()).toBe(".1pux, .json, .1pif, .csv");

      component().formGroup.controls.file.setValue({ name: "export.csv" } as File);
      fixture.detectChanges();
      expect(component().acceptedFileTypesHint()).toBe(".1pux, .json, .1pif, .csv");

      pickFormat("1passwordmaccsv");
      expect(component().acceptedFileTypesHint()).toBe(".csv");
    });

    it("narrows the paste hint to the picked format's pasteFormats", async () => {
      await setup("keepass2xml", ClientType.Web);
      component().formGroup.controls.method.setValue("paste");
      fixture.detectChanges();
      expect(component().pasteFormatsHint()).toBe(".xml, .csv");

      pickFormat("keepassxcsv");
      expect(component().pasteFormatsHint()).toBe(".csv");
    });

    it("reverts the hint to the union when the method changes", async () => {
      await setup("keepass2xml", ClientType.Web);
      pickFormat("keepasskdbx");
      expect(component().acceptedFileTypesHint()).toBe(".kdbx");

      component().formGroup.controls.method.setValue("paste");
      fixture.detectChanges();
      expect(component().pasteFormatsHint()).toBe(".xml, .csv");
    });

    it("reverts the hint to the union when a different file replaces the chosen one", async () => {
      await setup("1password1pux", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.csv" } as File);
      pickFormat("1passwordmaccsv");
      expect(component().acceptedFileTypesHint()).toBe(".csv");

      component().formGroup.controls.file.setValue({ name: "other.csv" } as File);
      fixture.detectChanges();
      expect(component().acceptedFileTypesHint()).toBe(".1pux, .json, .1pif, .csv");
    });

    it("keeps fileAccept() as the full union for a vendor with no format dropdown", async () => {
      await setup("dashlanecsv", ClientType.Web);
      expect(component().fileAccept()).toBe(".csv,.json");
    });

    it("keeps fileAccept() as the full sibling union for a vendor with a format dropdown (KeePass), matching the hint", async () => {
      await setup("keepass2xml", ClientType.Web);
      component().formGroup.controls.formatChoice.setValue("keepasskdbx");
      fixture.detectChanges();
      expect(component().fileAccept()).toBe(".xml,.kdbx,.csv");

      component().formGroup.controls.formatChoice.setValue("keepassxcsv");
      fixture.detectChanges();
      expect(component().fileAccept()).toBe(".xml,.kdbx,.csv");
    });

    it("keeps fileAccept() as the full sibling union for 1Password too, matching the hint", async () => {
      await setup("1password1pux", ClientType.Web);
      fixture.detectChanges();
      expect(component().fileAccept()).toBe(".1pux,.json,.1pif,.csv");

      component().formGroup.controls.file.setValue({ name: "export.csv" } as File);
      component().formGroup.controls.formatChoice.setValue("1passwordmaccsv");
      fixture.detectChanges();
      expect(component().fileAccept()).toBe(".1pux,.json,.1pif,.csv");
    });

    it("binds the method radio group's block input to true, so it actually renders stacked vertically", async () => {
      await setup("dashlanecsv", ClientType.Web);
      const radioGroup = fixture.debugElement.query(By.css("bit-radio-group"));

      expect((radioGroup.componentInstance as { block: () => boolean }).block()).toBe(true);
    });

    it("applies the deep-selector margin override to the file-upload element", async () => {
      await setup("dashlanecsv", ClientType.Web);
      const fileUpload = fixture.nativeElement.querySelector("bit-file-upload");

      expect(fileUpload.className).toContain("[&_bit-form-field]:!tw-mb-0");
    });

    it("renders formatChoice as a dropdown, labeled with the vendor name, not a radio group", async () => {
      await setup("1password1pux", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.csv" } as File);
      fixture.detectChanges();

      expect(byId("importer-controls_select_format-choice")).toBeTruthy();
      expect(fixture.nativeElement.textContent).toContain("importVendorFileType");
      expect(fixture.debugElement.queryAll(By.css("bit-radio-group")).length).toBe(1); // method only
    });

    it("labels an unambiguous always-prompt format with a bare extension, not the full descriptive name", async () => {
      await setup("keepass2xml", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.kdbx" } as File);
      fixture.detectChanges();

      expect(component().needsFormatDisambiguation()).toBe(false);
      const [candidate] = component().formatChoiceOptions();
      expect(candidate.id).toBe("keepasskdbx");
      expect(component().formatChoiceLabel(candidate)).toBe(".kdbx");
    });

    it("keeps the full descriptive label for a genuine collision (Windows vs. Mac csv)", async () => {
      await setup("1password1pux", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.csv" } as File);
      fixture.detectChanges();

      expect(component().needsFormatDisambiguation()).toBe(true);
      const labels = component()
        .formatChoiceOptions()
        .map((candidate: ImportOption) => component().formatChoiceLabel(candidate));
      expect(labels).toEqual(["1Password 6 and 7 Windows (csv)", "1Password 6 and 7 Mac (csv)"]);
    });

    it("falls back to the full descriptive label for a shared extension even outside a disambiguation prompt (1Password's wincsv/maccsv, before any file narrows the list)", async () => {
      await setup("1password1pux", ClientType.Web);
      fixture.detectChanges();

      expect(component().needsFormatDisambiguation()).toBe(false);
      const labels = component()
        .formatChoiceOptions()
        .map((candidate: ImportOption) => component().formatChoiceLabel(candidate));
      expect(labels).toEqual([
        // 1password1pux's label is its own primary extension only — its secondary .json
        // acceptance is for the file picker/hint, not this identifier.
        ".1pux",
        ".1pif",
        "1Password 6 and 7 Windows (csv)",
        "1Password 6 and 7 Mac (csv)",
      ]);
    });

    it("keeps the primary-extension label for 1password1pux even once a real .json file resolves it, not switching to .json", async () => {
      await setup("1password1pux", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.json" } as File);
      fixture.detectChanges();

      expect(component().resolvedFormat()).toBe("1password1pux");
      const [candidate] = component().formatChoiceOptions();
      expect(candidate.id).toBe("1password1pux");
      expect(component().formatChoiceLabel(candidate)).toBe(".1pux");
    });

    it("keeps a pre-file dropdown pick when it's still valid for the first file chosen, instead of discarding it", async () => {
      await setup("1password1pux", ClientType.Web);
      component().formGroup.controls.formatChoice.setValue("1passwordmaccsv");
      fixture.detectChanges();

      // wincsv/maccsv both accept .csv, so this genuinely collides.
      component().formGroup.controls.file.setValue({ name: "export.csv" } as File);
      fixture.detectChanges();

      expect(component().needsFormatDisambiguation()).toBe(true);
      expect(component().formGroup.controls.formatChoice.value).toBe("1passwordmaccsv");
      expect(component().resolvedFormat()).toBe("1passwordmaccsv");
    });

    it("still forces independent re-confirmation on a SECOND ambiguous file, even if the first file's answer is still technically valid", async () => {
      await setup("1password1pux", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "first.csv" } as File);
      fixture.detectChanges();
      component().formGroup.controls.formatChoice.setValue("1passwordmaccsv");
      fixture.detectChanges();

      component().formGroup.controls.file.setValue({ name: "second.csv" } as File);
      fixture.detectChanges();

      expect(component().formGroup.controls.formatChoice.value).toBeNull();
    });

    it("does not let a cosmetic pre-file auto-seed survive into the genuine collision the first real file creates", async () => {
      // A cosmetic seed (not a real pick) must still reset correctly — it's only ever preserved
      // because it never coincides with this vendor's real collision set, not because it's "safe".
      await setup("1password1pux", ClientType.Web);
      fixture.detectChanges();
      expect(component().formGroup.controls.formatChoice.value).toBe("1password1pux");

      component().formGroup.controls.file.setValue({ name: "export.csv" } as File);
      fixture.detectChanges();

      expect(component().needsFormatDisambiguation()).toBe(true);
      expect(component().formGroup.controls.formatChoice.value).toBeNull();
      expect(component().resolvedFormat()).toBeUndefined();
    });

    it("falls back to the candidate's name if it declares no accepted file type (file mode) or paste format (paste mode)", async () => {
      // Not reachable with real data today (every entry declares at least one of each) — guards
      // against a future entry that omits one, rather than rendering a bare ".undefined" label.
      await setup("dashlanecsv", ClientType.Web);
      const noFileType = buildOption({ id: "no-file-type", acceptedFileTypes: [] });
      const noPasteFormat = buildOption({ id: "no-paste-format", pasteFormats: [] });

      expect(component().formatChoiceLabel(noFileType)).toBe(noFileType.name);

      component().formGroup.controls.method.setValue("paste");
      fixture.detectChanges();
      expect(component().formatChoiceLabel(noPasteFormat)).toBe(noPasteFormat.name);
    });

    it("labels by pasteFormats in paste mode, not acceptedFileTypes — there's no file extension to show", async () => {
      await setup("1password1pux", ClientType.Web);
      component().formGroup.controls.method.setValue("paste");
      fixture.detectChanges();

      // 1password1pux's pasteFormats is ["json"], not acceptedFileTypes' ["1pux", "json"].
      const labels = component()
        .formatChoiceOptions()
        .map((candidate: ImportOption) => component().formatChoiceLabel(candidate));
      expect(labels).toEqual([
        ".json",
        ".1pif",
        "1Password 6 and 7 Windows (csv)",
        "1Password 6 and 7 Mac (csv)",
      ]);
    });

    it("does not need disambiguation for a vendor with no extension collision", async () => {
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.csv" } as File);
      fixture.detectChanges();

      expect(component().needsFormatDisambiguation()).toBe(false);
      expect(component().resolvedFormat()).toBe("dashlanecsv");
    });

    it("never renders the format dropdown for an ordinary vendor, with or without a file chosen", async () => {
      await setup("dashlanecsv", ClientType.Web);
      fixture.detectChanges();

      expect(component().showFormatChoice()).toBe(false);
      expect(byId("importer-controls_select_format-choice")).toBeFalsy();

      component().formGroup.controls.file.setValue({ name: "export.csv" } as File);
      fixture.detectChanges();

      expect(component().showFormatChoice()).toBe(false);
      expect(byId("importer-controls_select_format-choice")).toBeFalsy();
    });

    it("shows the resolved sibling format's own instructions once one resolves, not the vendor default", async () => {
      await setup("dashlanecsv", ClientType.Web);
      expect(component().activeInstructions().instructionKey).toBe("importDashlaneCsvInstructions");

      component().formGroup.controls.file.setValue({ name: "export.json" } as File);
      fixture.detectChanges();

      expect(component().resolvedFormat()).toBe("dashlanejson");
      expect(component().activeInstructions().instructionKey).toBe(
        "importDashlaneJsonInstructions",
      );
    });

    it("resolves Keeper's manual-mode file to a real parseable format, not the direct-import pseudo-format", async () => {
      await setup("keeper", ClientType.Web);
      component().toggleToManual();
      component().formGroup.controls.file.setValue({ name: "export.csv" } as File);
      fixture.detectChanges();
      expect(component().resolvedFormat()).toBe("keepercsv");

      component().formGroup.controls.file.setValue({ name: "export.json" } as File);
      fixture.detectChanges();
      expect(component().resolvedFormat()).toBe("keeperjson");
    });

    it("keeps showing Keeper's help link once a file resolves, even though keepercsv/keeperjson have no instructions of their own", async () => {
      await setup("keeper", ClientType.Web);
      expect(component().activeInstructions().instructionLink).toBeTruthy();

      component().formGroup.controls.file.setValue({ name: "export.csv" } as File);
      fixture.detectChanges();

      expect(component().resolvedFormat()).toBe("keepercsv");
      expect(component().activeInstructions().instructionLink).toBeTruthy();
    });

    it("needs disambiguation for 1Password's Windows/Mac csv collision, and resolves once chosen", async () => {
      await setup("1password1pux", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.csv" } as File);
      fixture.detectChanges();

      expect(component().needsFormatDisambiguation()).toBe(true);
      expect(
        component()
          .candidateFormats()
          .map((option: ImportOption) => option.id),
      ).toEqual(["1passwordwincsv", "1passwordmaccsv"]);
      expect(component().resolvedFormat()).toBeUndefined();

      component().formGroup.controls.formatChoice.setValue("1passwordmaccsv");
      fixture.detectChanges();

      expect(component().resolvedFormat()).toBe("1passwordmaccsv");
    });

    it("resolves unambiguous extensions (.1pux, .json, .1pif) without disambiguation", async () => {
      await setup("1password1pux", ClientType.Web);

      component().formGroup.controls.file.setValue({ name: "export.1pux" } as File);
      fixture.detectChanges();
      expect(component().resolvedFormat()).toBe("1password1pux");

      component().formGroup.controls.file.setValue({ name: "export.1pif" } as File);
      fixture.detectChanges();
      expect(component().resolvedFormat()).toBe("1password1pif");
    });

    it("resolves an always-prompt vendor's dropdown pick before any file is chosen, instead of leaving it decorative", async () => {
      await setup("keepass2xml", ClientType.Web);
      fixture.detectChanges();

      expect(component().candidateFormats()).toEqual([]);
      component().formGroup.controls.formatChoice.setValue("keepasskdbx");
      fixture.detectChanges();

      expect(component().resolvedFormat()).toBe("keepasskdbx");
      expect(component().needsKdbxCredentials()).toBe(true);
    });

    it("re-enables and re-seeds formatChoice after re-selecting a same-named file, instead of leaving it stuck blank", async () => {
      await setup("keepass2xml", ClientType.Web);
      const firstFile = { name: "Database.kdbx" } as File;
      component().formGroup.controls.file.setValue(firstFile);
      fixture.detectChanges();
      expect(component().resolvedFormat()).toBe("keepasskdbx");

      // Distinct File object, identical name — exactly what re-picking the same file produces.
      const secondFile = { name: "Database.kdbx" } as File;
      component().formGroup.controls.file.setValue(secondFile);
      fixture.detectChanges();

      expect(
        component()
          .candidateFormats()
          .map((o: ImportOption) => o.id),
      ).toEqual(["keepasskdbx"]);
      expect(component().resolvedFormat()).toBe("keepasskdbx");
      expect(component().formGroup.controls.formatChoice.valid).toBe(true);
    });

    it("still reports unresolved for an always-prompt vendor once a file is chosen that matches no format", async () => {
      await setup("1password1pux", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.pdf" } as File);
      fixture.detectChanges();

      // Disabled, not just null: required+null would block submit() before the real toast fires.
      expect(component().candidateFormats()).toEqual([]);
      expect(component().resolvedFormat()).toBeUndefined();
      expect(component().formGroup.controls.formatChoice.value).toBeNull();
      expect(component().formGroup.controls.formatChoice.disabled).toBe(true);
      expect(component().formGroup.valid).toBe(true);
      expect(byId("importer-controls_select_format-choice")).toBeFalsy();
    });

    it("surfaces the real 'unsupported file type' toast on the first submit() for an always-prompt vendor, not a spurious required error", async () => {
      await setup("1password1pux", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.pdf" } as File);
      fixture.detectChanges();

      await component().submit();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", message: "selectFileUnsupportedType" }),
      );
    });

    it("does not resolve an ordinary vendor's empty candidate set from a leftover formatChoice value", async () => {
      await setup("dashlanecsv", ClientType.Web);
      fixture.detectChanges();

      expect(component().candidateFormats()).toEqual([]);
      expect(component().resolvedFormat()).toBeUndefined();
    });

    it("clears a stale format choice when a new file is chosen, resolving unambiguously", async () => {
      await setup("1password1pux", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.csv" } as File);
      component().formGroup.controls.formatChoice.setValue("1passwordmaccsv");

      component().formGroup.controls.file.setValue({ name: "export.1pux" } as File);
      fixture.detectChanges();

      // Re-syncs to match the resolved file rather than sitting blank.
      expect(component().formGroup.controls.formatChoice.value).toBe("1password1pux");
      expect(component().resolvedFormat()).toBe("1password1pux");
    });

    it("resolves a second ambiguous file's choice independently of the first (formatChoice reset takes effect)", async () => {
      await setup("1password1pux", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "first.csv" } as File);
      fixture.detectChanges();
      component().formGroup.controls.formatChoice.setValue("1passwordmaccsv");
      fixture.detectChanges();
      expect(component().resolvedFormat()).toBe("1passwordmaccsv");

      component().formGroup.controls.file.setValue({ name: "second.csv" } as File);
      fixture.detectChanges();

      expect(component().formGroup.controls.formatChoice.value).toBeNull();
      expect(component().needsFormatDisambiguation()).toBe(true);
      expect(component().resolvedFormat()).toBeUndefined();
    });

    it("re-derives the filename correctly after switching away from file method and back", async () => {
      await setup("1password1pux", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.1pux" } as File);
      fixture.detectChanges();
      expect(component().resolvedFormat()).toBe("1password1pux");

      component().formGroup.controls.method.setValue("paste");
      fixture.detectChanges();
      component().formGroup.controls.method.setValue("file");
      fixture.detectChanges();

      expect(component().chosenFileName()).toBe("export.1pux");
      expect(component().resolvedFormat()).toBe("1password1pux");
    });

    describe("paste method", () => {
      it("offers every paste-capable format once content is present, for a vendor whose siblings aren't shape-narrowable (1Password)", async () => {
        await setup("1password1pux", ClientType.Web);
        component().formGroup.controls.method.setValue("paste");
        component().formGroup.controls.fileContents.setValue('{"some": "json"}');
        fixture.detectChanges();

        expect(
          component()
            .candidateFormats()
            .map((o: ImportOption) => o.id),
        ).toEqual(["1password1pux", "1password1pif", "1passwordwincsv", "1passwordmaccsv"]);
        expect(component().needsFormatDisambiguation()).toBe(true);
      });

      it("does not default to the first label in the list — requires an explicit choice", async () => {
        await setup("1password1pux", ClientType.Web);
        component().formGroup.controls.method.setValue("paste");
        component().formGroup.controls.fileContents.setValue(
          "url,username,password\nhttps://example.com,me,hunter2",
        );
        fixture.detectChanges();

        expect(component().resolvedFormat()).toBeUndefined();

        component().formGroup.controls.formatChoice.setValue("1passwordmaccsv");
        fixture.detectChanges();

        expect(component().resolvedFormat()).toBe("1passwordmaccsv");
      });

      it("keeps an explicit choice when the content is edited further without changing the candidate set", async () => {
        // 1Password is never shape-narrowable, so needsFormatDisambiguation() stays true on every
        // keystroke, not just the one that created the collision.
        await setup("1password1pux", ClientType.Web);
        component().formGroup.controls.method.setValue("paste");
        component().formGroup.controls.fileContents.setValue(
          "url,username,password\nhttps://example.com,me,hunter2",
        );
        fixture.detectChanges();
        component().formGroup.controls.formatChoice.setValue("1passwordmaccsv");
        fixture.detectChanges();

        component().formGroup.controls.fileContents.setValue(
          "url,username,password\nhttps://example.com,me,hunter2\nmore,rows,here",
        );
        fixture.detectChanges();

        expect(component().formGroup.controls.formatChoice.value).toBe("1passwordmaccsv");
        expect(component().resolvedFormat()).toBe("1passwordmaccsv");
      });

      it("does not let a formatChoice seeded while unambiguous survive into a genuine collision the edited content now creates", async () => {
        await setup("1password1pux", ClientType.Web);
        component().formGroup.controls.method.setValue("paste");
        fixture.detectChanges();

        // No content yet: single-vendor fallback list, seeded to its first entry — unforced, cosmetic.
        expect(component().formGroup.controls.formatChoice.value).toBe("1password1pux");

        // Editing content now creates a genuine 4-way collision (1Password isn't shape-narrowable).
        // The earlier seed must not silently answer it.
        component().formGroup.controls.fileContents.setValue('{"some": "json"}');
        fixture.detectChanges();

        expect(component().needsFormatDisambiguation()).toBe(true);
        expect(component().formGroup.controls.formatChoice.value).toBeNull();
        expect(component().resolvedFormat()).toBeUndefined();
      });

      it("shows no candidates until content is actually present", async () => {
        await setup("dashlanecsv", ClientType.Web);
        component().formGroup.controls.method.setValue("paste");
        fixture.detectChanges();

        expect(component().candidateFormats()).toEqual([]);
      });

      it("narrows to the single matching format by content shape for a shape-narrowable vendor, needing no explicit choice", async () => {
        await setup("dashlanecsv", ClientType.Web);
        component().formGroup.controls.method.setValue("paste");
        component().formGroup.controls.fileContents.setValue('{"some": "json"}');
        fixture.detectChanges();

        expect(component().needsFormatDisambiguation()).toBe(false);
        expect(component().resolvedFormat()).toBe("dashlanejson");
      });

      it("narrows to the csv sibling for a shape-narrowable vendor when the content doesn't look like json/xml", async () => {
        await setup("dashlanecsv", ClientType.Web);
        component().formGroup.controls.method.setValue("paste");
        component().formGroup.controls.fileContents.setValue(
          "url,username,password\nhttps://example.com,me,hunter2",
        );
        fixture.detectChanges();

        expect(component().needsFormatDisambiguation()).toBe(false);
        expect(component().resolvedFormat()).toBe("dashlanecsv");
      });

      it("narrows to the xml sibling for a shape-narrowable vendor with an xml/csv pair (Delinea)", async () => {
        await setup("delineaxml", ClientType.Web);
        component().formGroup.controls.method.setValue("paste");
        component().formGroup.controls.fileContents.setValue('<?xml version="1.0"?><root></root>');
        fixture.detectChanges();

        expect(component().needsFormatDisambiguation()).toBe(false);
        expect(component().resolvedFormat()).toBe("delineaxml");
      });

      it("doesn't list keepasskdbx in the pre-content fallback, since it can't be pasted", async () => {
        await setup("keepass2xml", ClientType.Web);
        component().formGroup.controls.method.setValue("paste");
        fixture.detectChanges();

        // Must match pasteFormatsHint(), which already excludes keepasskdbx (pasteFormats is []).
        const ids = component()
          .formatChoiceOptions()
          .map((option: ImportOption) => option.id);
        expect(ids).toEqual(["keepass2xml", "keepassxcsv"]);
      });

      it("narrows KeePass's xml/csv pair by shape, now that keepassxcsv joined the same picker card", async () => {
        await setup("keepass2xml", ClientType.Web);
        component().formGroup.controls.method.setValue("paste");
        component().formGroup.controls.fileContents.setValue('<?xml version="1.0"?><root></root>');
        fixture.detectChanges();

        expect(component().needsFormatDisambiguation()).toBe(false);
        expect(component().resolvedFormat()).toBe("keepass2xml");
      });

      it("narrows to the csv sibling for KeePass when pasted content doesn't look like xml", async () => {
        await setup("keepass2xml", ClientType.Web);
        component().formGroup.controls.method.setValue("paste");
        component().formGroup.controls.fileContents.setValue(
          "url,username,password\nhttps://example.com,me,hunter2",
        );
        fixture.detectChanges();

        expect(component().needsFormatDisambiguation()).toBe(false);
        expect(component().resolvedFormat()).toBe("keepassxcsv");
      });

      it("stays valid and resolved when an input event re-emits identical pasted content", async () => {
        // pastedContent() dedupes as a toSignal, so this must not leave formatChoice null-and-required
        // with nothing left to re-seed it.
        await setup("keepass2xml", ClientType.Web);
        component().formGroup.controls.method.setValue("paste");
        const content = '<?xml version="1.0"?><root></root>';
        component().formGroup.controls.fileContents.setValue(content);
        fixture.detectChanges();
        expect(component().resolvedFormat()).toBe("keepass2xml");

        component().formGroup.controls.fileContents.setValue(content);
        fixture.detectChanges();

        expect(component().formGroup.controls.formatChoice.valid).toBe(true);
        expect(component().resolvedFormat()).toBe("keepass2xml");
      });

      it("still requires an explicit choice for 1Password's Windows/Mac csv pair, since content shape can't tell them apart", async () => {
        await setup("1password1pux", ClientType.Web);
        component().formGroup.controls.method.setValue("paste");
        component().formGroup.controls.fileContents.setValue(
          "url,username,password\nhttps://example.com,me,hunter2",
        );
        fixture.detectChanges();

        expect(
          component()
            .candidateFormats()
            .map((o: ImportOption) => o.id),
        ).toEqual(["1password1pux", "1password1pif", "1passwordwincsv", "1passwordmaccsv"]);
        expect(component().needsFormatDisambiguation()).toBe(true);
      });
    });
  });

  describe("format choice required validation", () => {
    it("marks formatChoice required once enabled by genuine ambiguity, with the correct asterisk/required affordances", async () => {
      await setup("1password1pux", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.csv" } as File);
      fixture.detectChanges();

      expect(component().formGroup.controls.formatChoice.hasValidator(Validators.required)).toBe(
        true,
      );
      expect(component().formGroup.controls.formatChoice.invalid).toBe(true);
      expect(fixture.nativeElement.textContent).toContain("(required)");
    });

    it("blocks submit() with an inline required error, and never reaches onContinue(), when an ambiguous format is unresolved", async () => {
      await setup("1password1pux", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.csv" } as File);
      fixture.detectChanges();
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().submit();
      fixture.detectChanges();

      expect(component().formGroup.controls.formatChoice.touched).toBe(true);
      expect(continueSpy).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("disables and resets formatChoice (value and touched) when primaryMode leaves manual, independent of needsFormatDisambiguation() — the value isn't cleared by a primaryMode toggle, only by a method switch or a new file", async () => {
      await setup("keeper", ClientType.Desktop);
      component().toggleToManual();
      fixture.detectChanges();

      // Simulates a stale enabled+touched+selected formatChoice left over from manual mode.
      component().formGroup.controls.formatChoice.enable();
      component().formGroup.controls.formatChoice.setValue("1passwordmaccsv");
      component().formGroup.controls.formatChoice.markAsTouched();

      component().toggleToAlternate();
      fixture.detectChanges();

      expect(component().formGroup.controls.formatChoice.disabled).toBe(true);
      expect(component().formGroup.controls.formatChoice.touched).toBe(false);
      expect(component().formGroup.controls.formatChoice.value).toBeNull();
    });
  });

  describe("file required validation", () => {
    it("marks the file control required in file mode", async () => {
      await setup("dashlanecsv", ClientType.Web);

      expect(component().formGroup.controls.file.hasValidator(Validators.required)).toBe(true);
      expect(component().formGroup.controls.file.invalid).toBe(true);
    });

    it("clears the file control's required validator in paste mode", async () => {
      await setup("dashlanecsv", ClientType.Web);

      component().formGroup.controls.method.setValue("paste");
      fixture.detectChanges();

      expect(component().formGroup.controls.file.hasValidator(Validators.required)).toBe(false);
      expect(component().formGroup.controls.file.invalid).toBe(false);
    });

    it("blocks submit() with an inline required error, and never reaches onContinue(), when no file is chosen in file mode", async () => {
      await setup("dashlanecsv", ClientType.Web);
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().submit();
      fixture.detectChanges();

      expect(component().formGroup.controls.file.touched).toBe(true);
      expect(continueSpy).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();

      const bitError = byId("importer-controls_input_file").query(By.css("bit-error"));
      expect(bitError.nativeElement.textContent).toContain("inputRequired");
    });

    it("lets submit() proceed once a file is chosen in file mode", async () => {
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.file.setValue(new File(["a,b"], "export.csv"));
      fixture.detectChanges();
      importService.getImporter.mockReturnValue({} as any);
      importService.import.mockResolvedValue(new ImportResult());
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().submit();

      expect(continueSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("paste required validation", () => {
    it("marks the fileContents control required in paste mode", async () => {
      await setup("dashlanecsv", ClientType.Web);

      component().formGroup.controls.method.setValue("paste");
      fixture.detectChanges();

      expect(component().formGroup.controls.fileContents.invalid).toBe(true);
      expect(component().formGroup.controls.fileContents.errors).toEqual({ required: true });
    });

    it("keeps Validators.required in the mix (not replaced by the trim-aware validator alone), so the field still renders as required before any submit attempt", async () => {
      await setup("dashlanecsv", ClientType.Web);

      component().formGroup.controls.method.setValue("paste");
      fixture.detectChanges();

      expect(component().formGroup.controls.fileContents.hasValidator(Validators.required)).toBe(
        true,
      );
      const textarea: HTMLTextAreaElement = byId(
        "importer-controls_textarea_file-contents",
      ).nativeElement;
      expect(textarea.required).toBe(true);
      expect(fixture.nativeElement.textContent).toContain("(required)");
    });

    it("also treats whitespace-only paste content as required-but-missing, not just a truly empty string", async () => {
      await setup("dashlanecsv", ClientType.Web);

      component().formGroup.controls.method.setValue("paste");
      component().formGroup.controls.fileContents.setValue("   \n  ");
      fixture.detectChanges();

      expect(component().formGroup.controls.fileContents.invalid).toBe(true);
      expect(component().formGroup.controls.fileContents.errors).toEqual({ required: true });
    });

    it("clears the fileContents control's validator in file mode", async () => {
      await setup("dashlanecsv", ClientType.Web);

      expect(component().formGroup.controls.fileContents.invalid).toBe(false);
      expect(component().formGroup.controls.fileContents.errors).toBeNull();
    });

    it("blocks submit() with an inline required error, and never reaches onContinue(), when nothing is pasted in paste mode", async () => {
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.method.setValue("paste");
      fixture.detectChanges();
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().submit();
      fixture.detectChanges();

      expect(component().formGroup.controls.fileContents.touched).toBe(true);
      expect(continueSpy).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();

      const bitErrors = fixture.debugElement.queryAll(By.css("bit-error"));
      expect(bitErrors.length).toBe(1);
      expect(bitErrors[0].nativeElement.textContent).toContain("inputRequired");
    });

    it("checks the required validator before the personal ownership policy, so a policy-restricted user still sees the real problem first", async () => {
      policyService.policyAppliesToUser$.mockReturnValue(of(true));
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.method.setValue("paste");
      fixture.detectChanges();
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().submit();

      expect(continueSpy).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: "personalOwnershipPolicyInEffectImports" }),
      );
    });

    it("also blocks submit() inline for whitespace-only paste content, before the personal ownership policy check", async () => {
      policyService.policyAppliesToUser$.mockReturnValue(of(true));
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.method.setValue("paste");
      component().formGroup.controls.fileContents.setValue("   ");
      fixture.detectChanges();
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().submit();

      expect(continueSpy).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("lets submit() proceed once content is pasted in paste mode", async () => {
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.method.setValue("paste");
      component().formGroup.controls.fileContents.setValue("a,b");
      fixture.detectChanges();
      importService.getImporter.mockReturnValue({} as any);
      importService.import.mockResolvedValue(new ImportResult());
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().submit();

      expect(continueSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("touched state across method switches", () => {
    it("does not show a stale required error on fileContents after switching from a blocked file-mode submit to paste", async () => {
      await setup("dashlanecsv", ClientType.Web);

      // markAllAsTouched() touches every control, enabled or not.
      await component().submit();
      fixture.detectChanges();
      expect(component().formGroup.controls.file.touched).toBe(true);

      component().formGroup.controls.method.setValue("paste");
      fixture.detectChanges();

      expect(component().formGroup.controls.fileContents.touched).toBe(false);
      expect(fixture.debugElement.queryAll(By.css("bit-error")).length).toBe(0);
    });

    it("does not show a stale required error on file after switching from a blocked paste-mode submit to file", async () => {
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.method.setValue("paste");
      fixture.detectChanges();

      await component().submit();
      fixture.detectChanges();
      expect(component().formGroup.controls.fileContents.touched).toBe(true);

      component().formGroup.controls.method.setValue("file");
      fixture.detectChanges();

      expect(component().formGroup.controls.file.touched).toBe(false);
      expect(fixture.debugElement.queryAll(By.css("bit-error")).length).toBe(0);
    });

    it("does not show a stale required error on file/fileContents after switching from a blocked chromium submit to manual", async () => {
      await setup("chromecsv", ClientType.Desktop);

      // markAllAsTouched() touches file/fileContents even though chromium mode keeps them disabled.
      await component().submit();
      fixture.detectChanges();
      expect(component().formGroup.controls.file.touched).toBe(true);
      expect(component().formGroup.controls.fileContents.touched).toBe(true);

      component().toggleToManual();
      fixture.detectChanges();

      expect(component().formGroup.controls.file.touched).toBe(false);
      expect(component().formGroup.controls.fileContents.touched).toBe(false);
      expect(fixture.debugElement.queryAll(By.css("bit-error")).length).toBe(0);
    });

    it("does not show a stale required error on profile after switching from a blocked manual submit to chromium", async () => {
      importMetadataService.metadata$.mockReturnValue(
        of<ImporterCapabilities>({ type: "chromecsv", loaders: [Loader.file, Loader.chromium] }),
      );
      await setup("chromecsv", ClientType.Desktop);
      component().toggleToManual();
      fixture.detectChanges();

      await component().submit();
      fixture.detectChanges();
      expect(component().formGroup.controls.profile.touched).toBe(true);

      component().toggleToAlternate();
      fixture.detectChanges();

      expect(component().formGroup.controls.profile.touched).toBe(false);
      expect(fixture.debugElement.queryAll(By.css("bit-error")).length).toBe(0);
    });
  });

  describe("instructions callout", () => {
    it("renders both the alias preamble and the help link for a Chromium-alias vendor in manual mode, not either/or", async () => {
      await setup("bravecsv", ClientType.Web);

      expect(byId("importer-controls_radio_file")).toBeTruthy();
      expect(fixture.nativeElement.textContent).toContain("importChromiumAliasPreamble");
      const link = fixture.debugElement.query(By.css("bit-callout a"));
      expect(link.nativeElement.getAttribute("href")).toBe(
        "https://bitwarden.com/help/import-from-chrome/",
      );
    });

    it("renders both the alias preamble and the help link for a Chromium-alias vendor in chromium mode", async () => {
      importMetadataService.metadata$.mockReturnValue(
        of<ImporterCapabilities>({ type: "bravecsv", loaders: [Loader.file, Loader.chromium] }),
      );
      await setup("bravecsv", ClientType.Desktop);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component().primaryMode()).toBe("chromium");
      expect(fixture.nativeElement.textContent).toContain("importChromiumAliasPreamble");
      const link = fixture.debugElement.query(By.css("bit-callout a"));
      expect(link.nativeElement.getAttribute("href")).toBe(
        "https://bitwarden.com/help/import-from-chrome/",
      );
    });
  });

  describe("kdbx credentials", () => {
    it("stays disabled for a non-kdbx resolved format", async () => {
      await setup("keepass2xml", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.xml" } as File);
      fixture.detectChanges();

      expect(component().needsKdbxCredentials()).toBe(false);
      expect(component().formGroup.controls.kdbxPassword.disabled).toBe(true);
    });

    it("enables the master password field once a .kdbx file is chosen", async () => {
      await setup("keepass2xml", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.kdbx" } as File);
      fixture.detectChanges();

      expect(component().resolvedFormat()).toBe("keepasskdbx");
      expect(component().needsKdbxCredentials()).toBe(true);
      expect(component().formGroup.controls.kdbxPassword.disabled).toBe(false);
    });

    it("reveals and enables the key file input only after addKeyFile()", async () => {
      await setup("keepass2xml", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.kdbx" } as File);
      fixture.detectChanges();
      expect(component().showKeyFile()).toBe(false);
      expect(component().formGroup.controls.keyFile.disabled).toBe(true);

      component().addKeyFile();
      fixture.detectChanges();

      expect(component().showKeyFile()).toBe(true);
      expect(component().formGroup.controls.keyFile.disabled).toBe(false);
    });

    it("disables the master password and key file fields again, and hides the key file input, once the format is no longer kdbx", async () => {
      await setup("keepass2xml", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.kdbx" } as File);
      fixture.detectChanges();
      component().addKeyFile();
      fixture.detectChanges();

      component().formGroup.controls.file.setValue({ name: "export.xml" } as File);
      fixture.detectChanges();

      expect(component().needsKdbxCredentials()).toBe(false);
      expect(component().formGroup.controls.kdbxPassword.disabled).toBe(true);
      expect(component().formGroup.controls.keyFile.disabled).toBe(true);
      expect(component().showKeyFile()).toBe(false);
    });

    it("clears the master password and key file values, not just disabling them, once the format is no longer kdbx", async () => {
      await setup("keepass2xml", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.kdbx" } as File);
      fixture.detectChanges();
      component().formGroup.controls.kdbxPassword.setValue("hunter2");
      component().addKeyFile();
      component().formGroup.controls.keyFile.setValue({ name: "keyfile.key" } as File);
      fixture.detectChanges();

      component().formGroup.controls.file.setValue({ name: "export.xml" } as File);
      fixture.detectChanges();

      expect(component().formGroup.controls.kdbxPassword.value).toBe("");
      expect(component().formGroup.controls.keyFile.value).toBeNull();

      component().formGroup.controls.file.setValue({ name: "export.kdbx" } as File);
      fixture.detectChanges();

      expect(component().formGroup.controls.kdbxPassword.value).toBe("");
    });

    it("clears the master password and key file when swapping one kdbx database for another, without ever leaving the kdbx branch", async () => {
      await setup("keepass2xml", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "personal.kdbx" } as File);
      fixture.detectChanges();
      component().formGroup.controls.kdbxPassword.setValue("hunter2");
      component().addKeyFile();
      component().formGroup.controls.keyFile.setValue({ name: "personal.key" } as File);
      fixture.detectChanges();

      component().formGroup.controls.file.setValue({ name: "work.kdbx" } as File);
      fixture.detectChanges();

      expect(component().needsKdbxCredentials()).toBe(true);
      expect(component().formGroup.controls.kdbxPassword.value).toBe("");
      expect(component().formGroup.controls.keyFile.value).toBeNull();
      expect(component().showKeyFile()).toBe(false);
    });

    it("does not show a stale 'invalid master password' error on a different kdbx file that hasn't been touched yet", async () => {
      // setValue("") clears the value but not touched, so a stale error would else still show.
      await setup("keepass2xml", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "personal.kdbx" } as File);
      fixture.detectChanges();
      await component().submit();
      expect(component().formGroup.controls.kdbxPassword.touched).toBe(true);
      expect(component().formGroup.controls.kdbxPassword.invalid).toBe(true);

      component().formGroup.controls.file.setValue({ name: "work.kdbx" } as File);
      fixture.detectChanges();

      expect(component().formGroup.controls.kdbxPassword.touched).toBe(false);
    });

    it("keeps Validators.required alongside the custom validator, so the password field still renders as required before any submit attempt", async () => {
      await setup("keepass2xml", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.kdbx" } as File);
      fixture.detectChanges();

      expect(component().formGroup.controls.kdbxPassword.hasValidator(Validators.required)).toBe(
        true,
      );
      const input: HTMLInputElement = byId("importer-controls_input_kdbx-password").nativeElement;
      expect(input.required).toBe(true);
      expect(fixture.nativeElement.textContent).toContain("(required)");
    });

    it("shows the specific 'password is required' error, not the generic required message, when both validators fail on an empty value", async () => {
      await setup("keepass2xml", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.kdbx" } as File);
      fixture.detectChanges();

      await component().submit();
      fixture.detectChanges();

      const bitErrors = fixture.debugElement.queryAll(By.css("bit-error"));
      expect(bitErrors.length).toBe(1);
      expect(bitErrors[0].nativeElement.textContent).toContain("kdbxPasswordRequired");
      expect(bitErrors[0].nativeElement.textContent).not.toContain("inputRequired");
    });

    it("renders the format dropdown and kdbx credentials before the file upload control, not after", async () => {
      // The dropdown is the control: picking .kdbx is what makes the password/key-file fields
      // relevant at all, so it (and they) must precede the upload input they gate, not follow it.
      await setup("keepass2xml", ClientType.Web);
      component().formGroup.controls.formatChoice.setValue("keepasskdbx");
      fixture.detectChanges();

      const dropdown = byId("importer-controls_select_format-choice").nativeElement;
      const password = byId("importer-controls_input_kdbx-password").nativeElement;
      const upload = byId("importer-controls_input_file").nativeElement;

      expect(
        dropdown.compareDocumentPosition(password) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        password.compareDocumentPosition(upload) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  describe("Bitwarden file password", () => {
    const accountEncrypted = JSON.stringify({
      encrypted: true,
      encKeyValidation_DO_NOT_EDIT: "enc-key-validation",
      items: [],
      folders: [],
    });
    const passwordProtected = JSON.stringify({
      encrypted: true,
      passwordProtected: true,
      salt: "salt",
      kdfIterations: 600000,
      kdfType: 0,
      encKeyValidation_DO_NOT_EDIT: "enc-key-validation",
      data: "encrypted-data",
    });

    it("needs no password for an account-encrypted export", async () => {
      await setup("bitwardenjson", ClientType.Web);
      component().formGroup.controls.file.setValue(new File([accountEncrypted], "export.json"));
      fixture.detectChanges();
      await flushFileRead();
      fixture.detectChanges();

      expect(component().needsFilePassword()).toBe(false);
      expect(component().formGroup.controls.filePassword.disabled).toBe(true);
      expect(byId("importer-controls_input_file")).toBeTruthy();
      expect(byId("importer-controls_input_file-password")).toBeFalsy();
    });

    it("shows a toast, not the generic error dialog, when an account-encrypted export can't be decrypted by the current account", async () => {
      await setup("bitwardenjson", ClientType.Web);
      component().formGroup.controls.file.setValue(new File([accountEncrypted], "export.json"));
      fixture.detectChanges();
      await flushFileRead();
      fixture.detectChanges();

      importService.getImporter.mockReturnValue({} as any);
      importService.import.mockRejectedValue(
        new ImportResultError("importEncKeyError", ImportResultErrorKey.AccountMismatch),
      );

      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);
      await component().onContinue();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "importAccountMismatchError" }),
      );
      expect(dialogService.open).not.toHaveBeenCalledWith(
        ImportErrorDialogComponent,
        expect.anything(),
      );
      expect(continueSpy).not.toHaveBeenCalled();
    });

    it("shows the generic error dialog, not a toast, for a malformed export with no errorKey", async () => {
      // A blank encKeyValidation_DO_NOT_EDIT or a missing decryption key are real failures, but
      // neither is specifically an account mismatch — BitwardenEncryptedJsonImporter throws a
      // plain ImportResultError (no errorKey) for both, which must fall through to the generic
      // dialog rather than the account-mismatch toast.
      await setup("bitwardenjson", ClientType.Web);
      component().formGroup.controls.file.setValue(new File([accountEncrypted], "export.json"));
      fixture.detectChanges();
      await flushFileRead();
      fixture.detectChanges();

      importService.getImporter.mockReturnValue({} as any);
      importService.import.mockRejectedValue(new ImportResultError("importEncKeyError"));

      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);
      await component().onContinue();

      expect(dialogService.open).toHaveBeenCalledWith(
        ImportErrorDialogComponent,
        expect.anything(),
      );
      expect(toastService.showToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: "importAccountMismatchError" }),
      );
      expect(continueSpy).not.toHaveBeenCalled();
    });

    it("skips the password-protection peek entirely for a Bitwarden CSV file, not just failing it silently", async () => {
      // The Bitwarden picker card covers both bitwardenjson and bitwardencsv — the peek must key
      // off the resolved sub-format, not the picker card's importType(), or a CSV pick triggers a
      // doomed read+parse attempt on every file selection.
      await setup("bitwardenjson", ClientType.Web);
      component().formGroup.controls.file.setValue(
        new File(["url,username,password\nhttps://example.com,me,hunter2"], "export.csv"),
      );
      fixture.detectChanges();
      await flushFileRead();
      fixture.detectChanges();

      expect(component().resolvedFormat()).toBe("bitwardencsv");
      expect(component().needsFilePassword()).toBe(false);
      expect(logService.error).not.toHaveBeenCalled();
    });

    it("never logs the raw parse error when a chosen .json file isn't valid JSON — it can embed a fragment of the file's own content", async () => {
      // V8's JSON.parse SyntaxError embeds the first ~12 characters of the input in its message
      // (e.g. `Unexpected token 's', "secret-can"... is not valid JSON`) — logging the raw error
      // would put real file content in the log. Only a safe, content-free descriptor may be logged.
      const fileContent = "secret-canary-value and some more text that is not json";
      let parseErrorMessage = "";
      try {
        JSON.parse(fileContent);
      } catch (error) {
        parseErrorMessage = (error as Error).message;
      }
      // Guards the test itself: if this ever stops reproducing a real leak (e.g. a V8 change),
      // fail loudly here instead of silently passing for the wrong reason.
      expect(parseErrorMessage).toContain(fileContent.slice(0, 10));

      await setup("bitwardenjson", ClientType.Web);
      component().formGroup.controls.file.setValue(new File([fileContent], "export.json"));
      fixture.detectChanges();
      await flushFileRead();
      fixture.detectChanges();

      expect(logService.error).toHaveBeenCalledTimes(1);
      const loggedArgs = logService.error.mock.calls[0];
      for (const arg of loggedArgs) {
        expect(String(arg)).not.toContain(fileContent.slice(0, 10));
      }
      expect(component().needsFilePassword()).toBe(false);
    });

    it("blocks submit() and disables Continue while the password-protection peek hasn't resolved yet", async () => {
      await setup("bitwardenjson", ClientType.Web);
      component().formGroup.controls.file.setValue(new File([passwordProtected], "export.json"));
      fixture.detectChanges();

      expect(component().filePasswordCheckPending()).toBe(true);
      expect(
        byId("importer-controls_button_continue").nativeElement.getAttribute("aria-disabled"),
      ).toBe("true");

      importService.getImporter.mockReturnValue({} as any);
      importService.import.mockResolvedValue(new ImportResult());
      await component().submit();
      expect(importService.getImporter).not.toHaveBeenCalled();

      await flushFileRead();
      fixture.detectChanges();

      expect(component().filePasswordCheckPending()).toBe(false);
      expect(
        byId("importer-controls_button_continue").nativeElement.getAttribute("aria-disabled"),
      ).not.toBe("true");

      // Unblocked, but the (now-required) password field is still empty — fill it in to confirm
      // submit() actually proceeds once everything is satisfied, not just that it stops blocking.
      component().formGroup.controls.filePassword.setValue("hunter2");
      await component().submit();
      expect(importService.getImporter).toHaveBeenCalled();
    });

    it("doesn't submit an empty password when Continue is called directly while the peek is still pending", async () => {
      // The race finding 1 closes: without a pending gate, needsFilePassword() is read after an
      // await, so the peek can flip from false to true mid-submit and the empty inline field value
      // gets submitted as the password instead of being blocked outright.
      await setup("bitwardenjson", ClientType.Web);
      component().formGroup.controls.file.setValue(new File([passwordProtected], "export.json"));
      fixture.detectChanges();
      expect(component().filePasswordCheckPending()).toBe(true);

      importService.getImporter.mockReturnValue({} as any);
      importService.import.mockResolvedValue(new ImportResult());

      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);
      await component().onContinue();

      expect(importService.getImporter).not.toHaveBeenCalled();
      expect(continueSpy).not.toHaveBeenCalled();
    });

    it("replaces the upload control with an inline password field for a password-protected export", async () => {
      await setup("bitwardenjson", ClientType.Web);
      component().formGroup.controls.file.setValue(new File([passwordProtected], "export.json"));
      fixture.detectChanges();
      await flushFileRead();
      fixture.detectChanges();

      expect(component().needsFilePassword()).toBe(true);
      expect(component().formGroup.controls.filePassword.disabled).toBe(false);
      expect(byId("importer-controls_input_file-password")).toBeTruthy();
      expect(byId("importer-controls_input_file")).toBeFalsy();
    });

    it("shows the password-protected hint under the inline password field", async () => {
      await setup("bitwardenjson", ClientType.Web);
      component().formGroup.controls.file.setValue(new File([passwordProtected], "export.json"));
      fixture.detectChanges();
      await flushFileRead();
      fixture.detectChanges();

      const hints = fixture.debugElement.queryAll(By.css("bit-hint"));
      expect(hints.length).toBe(1);
      expect(hints[0].nativeElement.textContent).toContain("filePasswordProtectedHint");
    });

    it("announces the upload-to-password-field swap for screen readers, politely rather than interrupting", async () => {
      await setup("bitwardenjson", ClientType.Web);
      component().formGroup.controls.file.setValue(new File([passwordProtected], "export.json"));
      fixture.detectChanges();
      await flushFileRead();
      fixture.detectChanges();

      expect(liveAnnouncer.announce).toHaveBeenCalledWith("filePassword", "polite");
    });

    it("hides the method radio group once the inline password field appears, per Figma — only heading, callout, the field, and Back/Continue remain", async () => {
      await setup("bitwardenjson", ClientType.Web);
      expect(byId("importer-controls_radio_file")).toBeTruthy();

      component().formGroup.controls.file.setValue(new File([passwordProtected], "export.json"));
      fixture.detectChanges();
      await flushFileRead();
      fixture.detectChanges();

      expect(byId("importer-controls_radio_file")).toBeFalsy();
      expect(byId("importer-controls_radio_paste")).toBeFalsy();
    });

    it("shows the specific 'file password is required' error, not the generic required message, on an empty submit", async () => {
      await setup("bitwardenjson", ClientType.Web);
      component().formGroup.controls.file.setValue(new File([passwordProtected], "export.json"));
      fixture.detectChanges();
      await flushFileRead();
      fixture.detectChanges();

      await component().submit();
      fixture.detectChanges();
      // A second flush: the password field only existed from the async peek a moment earlier, so
      // its error-display subscription (set up in ngAfterViewInit) needs one more tick to settle
      // before it reflects submit()'s touched/invalid state.
      await fixture.whenStable();
      fixture.detectChanges();

      const bitErrors = fixture.debugElement.queryAll(By.css("bit-error"));
      expect(bitErrors.length).toBe(1);
      expect(bitErrors[0].nativeElement.textContent).toContain("filePasswordRequired");
      expect(bitErrors[0].nativeElement.textContent).not.toContain("inputRequired");
    });

    it("resets the password field and re-shows the upload control once a non-protected file replaces the protected one", async () => {
      await setup("bitwardenjson", ClientType.Web);
      component().formGroup.controls.file.setValue(new File([passwordProtected], "export.json"));
      fixture.detectChanges();
      await flushFileRead();
      fixture.detectChanges();
      component().formGroup.controls.filePassword.setValue("hunter2");

      component().formGroup.controls.file.setValue(new File([accountEncrypted], "export2.json"));
      fixture.detectChanges();
      await flushFileRead();
      fixture.detectChanges();

      expect(component().needsFilePassword()).toBe(false);
      expect(component().formGroup.controls.filePassword.value).toBe("");
    });

    it("passes the inline field's value directly to the importer, not the dialog-based prompt", async () => {
      await setup("bitwardenjson", ClientType.Web);
      component().formGroup.controls.file.setValue(new File([passwordProtected], "export.json"));
      fixture.detectChanges();
      await flushFileRead();
      fixture.detectChanges();
      component().formGroup.controls.filePassword.setValue("hunter2");

      importService.getImporter.mockReturnValue({} as any);
      importService.import.mockResolvedValue(new ImportResult());

      await component().onContinue();

      expect(dialogService.open).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ ariaModal: true }),
      );
      const [, passwordCallback] = importService.getImporter.mock.calls[0];
      await expect(passwordCallback()).resolves.toBe("hunter2");
    });

    it("shows an inline error and doesn't open the generic error dialog when the password is wrong", async () => {
      await setup("bitwardenjson", ClientType.Web);
      component().formGroup.controls.file.setValue(new File([passwordProtected], "export.json"));
      fixture.detectChanges();
      await flushFileRead();
      fixture.detectChanges();
      component().formGroup.controls.filePassword.setValue("wrong-password");

      importService.getImporter.mockReturnValue({} as any);
      importService.import.mockRejectedValue(
        new ImportResultError("invalidFilePassword", ImportResultErrorKey.InvalidFilePassword),
      );

      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);
      await component().onContinue();
      fixture.detectChanges();

      expect(component().formGroup.controls.filePassword.hasError("invalidFilePassword")).toBe(
        true,
      );
      // The displayed text is filePasswordInvalid's short wording, not the longer pre-existing
      // invalidFilePassword message (which is still used as errorMessage on the thrown error for
      // other consumers, but must not be what's shown inline here).
      expect(
        component().formGroup.controls.filePassword.getError("invalidFilePassword").message,
      ).toBe("filePasswordInvalid");
      expect(dialogService.open).not.toHaveBeenCalledWith(
        ImportErrorDialogComponent,
        expect.anything(),
      );
      expect(continueSpy).not.toHaveBeenCalled();
    });

    it("distinguishes a wrong password by errorKey, not by matching errorMessage text", async () => {
      // A same-message but keyless error (the realistic shape every OTHER importer's errorMessage
      // produces) must NOT be treated as a wrong password — proves the check is structural
      // (ImportResultError.errorKey), not a coincidental string match against translated text.
      await setup("bitwardenjson", ClientType.Web);
      component().formGroup.controls.file.setValue(new File([passwordProtected], "export.json"));
      fixture.detectChanges();
      await flushFileRead();
      fixture.detectChanges();
      component().formGroup.controls.filePassword.setValue("hunter2");

      importService.getImporter.mockReturnValue({} as any);
      importService.import.mockRejectedValue(new ImportResultError("invalidFilePassword"));

      await component().onContinue();

      expect(component().formGroup.controls.filePassword.hasError("invalidFilePassword")).toBe(
        false,
      );
      expect(dialogService.open).toHaveBeenCalledWith(
        ImportErrorDialogComponent,
        expect.anything(),
      );
    });

    it("doesn't stay stuck wanting a password field that's never rendered after switching to paste", async () => {
      // needsFilePassword() depends on filePasswordProtected(), which tracks chosenFile() — and
      // method-switching deliberately preserves the chosen file. Without also checking method(),
      // the signal stays true after switching to paste, enabling a required field that the
      // template never renders in paste mode — permanently deadlocking submit() with zero
      // feedback, since markAllAsTouched() has nothing in the DOM to show an error on.
      await setup("bitwardenjson", ClientType.Web);
      component().formGroup.controls.file.setValue(new File([passwordProtected], "export.json"));
      fixture.detectChanges();
      await flushFileRead();
      fixture.detectChanges();
      expect(component().needsFilePassword()).toBe(true);

      component().formGroup.controls.method.setValue("paste");
      component().formGroup.controls.fileContents.setValue(passwordProtected);
      fixture.detectChanges();

      expect(component().needsFilePassword()).toBe(false);
      expect(component().formGroup.controls.filePassword.disabled).toBe(true);
      expect(component().formGroup.valid).toBe(true);
    });
  });

  describe("changing importType on a live instance", () => {
    it("resets the manual footer override, the direct sub-step, and every form value to a new vendor's defaults", async () => {
      await setup("keeper", ClientType.Desktop);
      component().toggleToManual();
      component().formGroup.controls.method.setValue("paste");
      component().formGroup.controls.fileContents.setValue("some pasted content");
      fixture.detectChanges();
      expect(component().primaryMode()).toBe("manual");

      fixture.componentRef.setInput("importType", "dashlanecsv");
      fixture.detectChanges();

      expect(component()["primaryModeOverride"]()).toBeUndefined();
      expect(component().directStep()).toBe("intro");
      expect(component().formGroup.controls.fileContents.value).toBe("");
      expect(component().formGroup.controls.method.value).toBe("file");
    });

    it("seeds formatChoice when switching live into an always-prompt vendor, surviving the same-flush vendor-reset", async () => {
      // Both effects dirty on the same importType() change — the seed must run after the reset.
      await setup("dashlanecsv", ClientType.Web);
      fixture.detectChanges();
      expect(component().formGroup.controls.formatChoice.value).toBeNull();

      fixture.componentRef.setInput("importType", "keepass2xml");
      fixture.detectChanges();

      expect(component().formGroup.controls.formatChoice.value).toBe("keepass2xml");
      expect(component().formGroup.controls.formatChoice.valid).toBe(true);
      expect(component().resolvedFormat()).toBe("keepass2xml");
    });

    it("does not leak the previous vendor's chromium availability onto a new vendor via a stale capabilities emission", async () => {
      importMetadataService.metadata$.mockReturnValue(
        of<ImporterCapabilities>({ type: "chromecsv", loaders: [Loader.file, Loader.chromium] }),
      );
      await setup("chromecsv", ClientType.Desktop);
      expect(component().primaryMode()).toBe("chromium");

      fixture.componentRef.setInput("importType", "dashlanecsv");
      fixture.detectChanges();

      expect(component().isChromiumAvailable()).toBe(false);
      expect(component().primaryMode()).toBe("manual");
    });

    it("does not carry a Keeper email into a LastPass credentials screen after switching vendors", async () => {
      await setup("keeper", ClientType.Desktop);
      component().continueFromIntro();
      component().formGroup.controls.keeperEmail.setValue("someone@example.com");
      fixture.detectChanges();

      fixture.componentRef.setInput("importType", "lastpasscsv");
      fixture.detectChanges();

      expect(component().formGroup.controls.keeperEmail.value).toBe("");
      expect(component().directStep()).toBe("intro");
    });

    it("does not throw or freeze the component when init() rejects", async () => {
      importMetadataService.init.mockReset();
      importMetadataService.init.mockRejectedValue(new Error("native module unavailable"));

      await setup("chromecsv", ClientType.Desktop);

      expect(component().primaryMode()).toBe("manual");
      expect(component().capabilitiesPending()).toBe(false);
      expect(byId("importer-controls_radio_file")).toBeTruthy();
      expect(byId("importer-controls_button_continue")).toBeTruthy();
    });
  });

  describe("outputs", () => {
    it("emits back regardless of mode or sub-step", async () => {
      await setup("keeper", ClientType.Desktop);
      const backSpy = jest.fn();
      component().back.subscribe(backSpy);

      component().onBack();

      expect(backSpy).toHaveBeenCalledTimes(1);
    });

    it("emits continue once a real import actually completes successfully", async () => {
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.file.setValue(new File(["a,b"], "export.csv"));
      importService.getImporter.mockReturnValue({} as any);
      importService.import.mockResolvedValue(new ImportResult());
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(continueSpy).toHaveBeenCalledTimes(1);
      expect(logService.warning).not.toHaveBeenCalled();
      expect(logService.error).not.toHaveBeenCalled();
    });

    it("still emits continue — and logs, rather than throws — when the post-import sync throws", async () => {
      // The import already succeeded — a sync hiccup shouldn't block navigation or scare the user.
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.file.setValue(new File(["a,b"], "export.csv"));
      importService.getImporter.mockReturnValue({} as any);
      importService.import.mockResolvedValue(new ImportResult());
      syncService.fullSync.mockRejectedValue(new Error("network down"));
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(continueSpy).toHaveBeenCalledTimes(1);
      expect(logService.error).toHaveBeenCalledWith(
        "Post-import sync failed:",
        expect.objectContaining({ message: "network down" }),
      );
    });

    it("still emits continue — and logs — when the post-import sync merely resolves false (the real failure shape: fullSync(true) doesn't set allowThrowOnError, so an ordinary sync failure resolves false rather than throwing)", async () => {
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.file.setValue(new File(["a,b"], "export.csv"));
      importService.getImporter.mockReturnValue({} as any);
      importService.import.mockResolvedValue(new ImportResult());
      syncService.fullSync.mockResolvedValue(false);
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(continueSpy).toHaveBeenCalledTimes(1);
      expect(logService.warning).toHaveBeenCalledWith("Post-import sync did not complete");
    });

    it("does not emit continue — and shows a 'pasteContentRequired' toast, not 'select a file' — when Continue is clicked with nothing pasted", async () => {
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.method.setValue("paste");
      fixture.detectChanges();
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(continueSpy).not.toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", message: "pasteContentRequired" }),
      );
    });

    it("shows a 'select a file' toast in file mode when nothing is chosen (defensive — submit()'s required validator blocks this in the real UI)", async () => {
      await setup("dashlanecsv", ClientType.Web);
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(continueSpy).not.toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", message: "selectFile" }),
      );
    });

    it("shows a 'select a format' toast, not 'select a file', when a chosen file is genuinely ambiguous", async () => {
      await setup("1password1pux", ClientType.Web);
      component().formGroup.controls.file.setValue(new File(["a,b"], "export.csv"));
      fixture.detectChanges();
      expect(component().needsFormatDisambiguation()).toBe(true);
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(continueSpy).not.toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", message: "selectFormat" }),
      );
    });

    it("shows a 'selectFileUnsupportedType' toast, not the generic 'select a file', when a chosen file's extension isn't accepted for this vendor", async () => {
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.pdf" } as File);
      fixture.detectChanges();
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(continueSpy).not.toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", message: "selectFileUnsupportedType" }),
      );
    });

    it("shows the error dialog with errorReadingFile — not a 'select a file' toast — when a chosen file can't be read", async () => {
      // A real File, not a {name} stand-in, so JSZip genuinely fails to parse it.
      await setup("1password1pux", ClientType.Web);
      component().formGroup.controls.file.setValue(new File(["not a zip"], "export.1pux"));
      fixture.detectChanges();
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(continueSpy).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: "selectFile" }),
      );
      expect(dialogService.open).toHaveBeenCalledWith(
        ImportErrorDialogComponent,
        expect.objectContaining({ data: expect.objectContaining({ message: "errorReadingFile" }) }),
      );
    });

    it("shows the error dialog with errorReadingFile — not a 'select a file' toast — when a chosen file reads successfully but yields no usable content", async () => {
      // A successful-but-empty read must not be conflated with "no file chosen at all".
      await setup("lastpasscsv", ClientType.Web);
      component().formGroup.controls.file.setValue(
        new File(["<html><body><pre></pre></body></html>"], "export.html", { type: "text/html" }),
      );
      fixture.detectChanges();
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(continueSpy).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: "selectFile" }),
      );
      expect(dialogService.open).toHaveBeenCalledWith(
        ImportErrorDialogComponent,
        expect.objectContaining({ data: expect.objectContaining({ message: "errorReadingFile" }) }),
      );
    });

    it("emits continue when the real Continue button is clicked outside the direct-intro sub-step", async () => {
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.file.setValue(new File(["a,b"], "export.csv"));
      importService.getImporter.mockReturnValue({} as any);
      importService.import.mockResolvedValue(new ImportResult());
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      byId("importer-controls_button_continue").nativeElement.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(continueSpy).toHaveBeenCalledTimes(1);
    });

    it("also submits via the form's native submit event, not just a button click — e.g. pressing Enter in a field", async () => {
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.file.setValue(new File(["a,b"], "export.csv"));
      importService.getImporter.mockReturnValue({} as any);
      importService.import.mockResolvedValue(new ImportResult());
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      fixture.debugElement
        .query(By.css("form"))
        .nativeElement.dispatchEvent(new Event("submit", { cancelable: true }));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(continueSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("executing the import", () => {
    it("blocks the import and shows a toast when the personal ownership policy applies, without calling any import service", async () => {
      policyService.policyAppliesToUser$.mockReturnValue(of(true));
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.file.setValue(new File(["a,b"], "export.csv"));
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "personalOwnershipPolicyInEffectImports" }),
      );
      expect(importService.getImporter).not.toHaveBeenCalled();
      expect(continueSpy).not.toHaveBeenCalled();
    });

    it("picks up the policy check from a stream that only emits once, proving it's subscribed from construction, not cold-subscribed inside onContinue()", async () => {
      // A Subject never replays to a late subscriber — if onContinue() subscribed fresh here
      // instead of reading an already-warm signal, this emission would be missed entirely and
      // the real bug (Continue spins forever, since nothing ever emits again) would reproduce.
      const policyApplies$ = new Subject<boolean>();
      policyService.policyAppliesToUser$.mockReturnValue(policyApplies$);
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.file.setValue(new File(["a,b"], "export.csv"));

      policyApplies$.next(true);
      fixture.detectChanges();

      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);
      await component().onContinue();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "personalOwnershipPolicyInEffectImports" }),
      );
      expect(continueSpy).not.toHaveBeenCalled();
    });

    it("blocks submit() and disables Continue while the policy check hasn't resolved yet, rather than defaulting to 'not blocked'", async () => {
      const policyApplies$ = new Subject<boolean>();
      policyService.policyAppliesToUser$.mockReturnValue(policyApplies$);
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.file.setValue(new File(["a,b"], "export.csv"));
      fixture.detectChanges();

      expect(component().personalOwnershipPolicyPending()).toBe(true);
      expect(
        byId("importer-controls_button_continue").nativeElement.getAttribute("aria-disabled"),
      ).toBe("true");

      await component().submit();

      expect(importService.getImporter).not.toHaveBeenCalled();

      policyApplies$.next(false);
      fixture.detectChanges();

      expect(component().personalOwnershipPolicyPending()).toBe(false);
      expect(
        byId("importer-controls_button_continue").nativeElement.getAttribute("aria-disabled"),
      ).not.toBe("true");

      // Proves the gate actually unblocks, not just that the signal/attribute look right.
      importService.getImporter.mockReturnValue({} as any);
      importService.import.mockResolvedValue(new ImportResult());
      await component().submit();

      expect(importService.getImporter).toHaveBeenCalled();
    });

    it("fails closed, not open, for a null account at mount (no logged-in user to check a policy against)", async () => {
      // A null account is a recognized, handled state (not a thrown error) — blocking (fail
      // closed) is still the safe default for a security gate, with an honest "something is
      // unresolved" message rather than falsely blaming the org policy.
      accountService.activeAccount$ = of(null as unknown as Account);
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.file.setValue(new File(["a,b"], "export.csv"));
      fixture.detectChanges();

      expect(component().personalOwnershipPolicyPending()).toBe(false);

      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);
      await component().onContinue();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "errorOccurred" }),
      );
      expect(importService.getImporter).not.toHaveBeenCalled();
      expect(continueSpy).not.toHaveBeenCalled();
    });

    it("fails closed, with an honest message (not the policy message), when policyAppliesToUser$ itself errors", async () => {
      policyService.policyAppliesToUser$.mockReturnValue(throwError(() => new Error("boom")));
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.file.setValue(new File(["a,b"], "export.csv"));
      fixture.detectChanges();

      await component().onContinue();

      expect(logService.error).toHaveBeenCalledWith(
        "Error checking personal ownership policy:",
        expect.anything(),
      );
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "errorOccurred" }),
      );
      expect(importService.getImporter).not.toHaveBeenCalled();
    });

    it("recovers once a real account re-emits after going null mid-session, instead of staying blocked forever", async () => {
      // The realistic shape the fix targets: a logout/account-switch while mounted (account goes
      // null, then a real account follows) must not be a dead end — the old design's catchError
      // sat on the outer pipe, so once it fired, the subscription was gone for good and a later
      // valid account would never be seen again.
      const activeAccount$ = new Subject<Account>();
      accountService.activeAccount$ = activeAccount$;
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.file.setValue(new File(["a,b"], "export.csv"));

      activeAccount$.next({ id: "test-user-id" } as unknown as Account);
      fixture.detectChanges();
      expect(component().personalOwnershipPolicyPending()).toBe(false);

      activeAccount$.next(null as unknown as Account);
      fixture.detectChanges();

      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);
      await component().onContinue();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "errorOccurred" }),
      );
      expect(importService.getImporter).not.toHaveBeenCalled();
      expect(continueSpy).not.toHaveBeenCalled();

      // Login completes / account switch resolves: a real account re-emits.
      activeAccount$.next({ id: "test-user-id-2" } as unknown as Account);
      fixture.detectChanges();

      expect(component().personalOwnershipPolicyPending()).toBe(false);
      importService.getImporter.mockReturnValue({} as any);
      importService.import.mockResolvedValue(new ImportResult());
      await component().onContinue();

      expect(importService.getImporter).toHaveBeenCalled();
      expect(continueSpy).toHaveBeenCalled();
    });

    it("opens the generic error dialog and does not emit continue when the import throws", async () => {
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.file.setValue(new File(["a,b"], "export.csv"));
      importService.getImporter.mockReturnValue({} as any);
      importService.import.mockRejectedValue(new Error("server rejected the import"));
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(dialogService.open).toHaveBeenCalledWith(
        ImportErrorDialogComponent,
        expect.objectContaining({ data: expect.any(Error) }),
      );
      expect(continueSpy).not.toHaveBeenCalled();
    });

    it("opens the skipped-items dialog, not the success dialog, when the import partially succeeds", async () => {
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.file.setValue(new File(["a,b"], "export.csv"));
      importService.getImporter.mockReturnValue({} as any);
      const result = new ImportResult();
      result.errors = [{ id: "row-2", reason: "error" } as any];
      importService.import.mockResolvedValue(result);
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(dialogService.open).toHaveBeenCalledWith(
        ImportSkippedItemsDialogComponent,
        expect.objectContaining({ data: { errors: result.errors } }),
      );
      expect(continueSpy).toHaveBeenCalledTimes(1);
    });

    it("does not attempt an SDK import when the kdbx master password is empty, but does once it's entered", async () => {
      await setup("keepass2xml", ClientType.Web);
      component().formGroup.controls.file.setValue({
        name: "export.kdbx",
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      } as unknown as File);
      fixture.detectChanges();

      await component().submit();
      expect(importService.importWithSdk).not.toHaveBeenCalled();

      component().formGroup.controls.kdbxPassword.setValue("hunter2");
      importService.importWithSdk.mockResolvedValue({} as any);

      await component().submit();
      expect(importService.importWithSdk).toHaveBeenCalledWith(
        "keepasskdbx",
        expect.any(Uint8Array),
        { kind: "passwordWithKeyFile", password: "hunter2", keyFile: null },
        undefined,
        undefined,
        false,
      );
    });

    it("throws instead of silently cancelling when an SDK format declares an unrecognized credential kind", async () => {
      // A future SDK importer declaring an unhandled credential kind must fail loudly, not no-op.
      const realGetImportOption = importService.getImportOption.getMockImplementation();
      importService.getImportOption.mockImplementation((id) =>
        id === "keepasskdbx"
          ? buildOption({
              id: "keepasskdbx",
              name: "KeePass (kdbx)",
              acceptedFileTypes: ["kdbx"],
              pasteFormats: [],
              sdk: { fileTypes: ["kdbx"], credentialKind: "somethingNew" as CredentialKind },
            })
          : realGetImportOption?.(id),
      );
      await setup("keepass2xml", ClientType.Web);
      component().formGroup.controls.file.setValue({
        name: "export.kdbx",
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      } as unknown as File);
      component().formGroup.controls.kdbxPassword.setValue("hunter2");
      fixture.detectChanges();
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(dialogService.open).toHaveBeenCalledWith(
        ImportErrorDialogComponent,
        expect.anything(),
      );
      expect(continueSpy).not.toHaveBeenCalled();
    });

    it("runs a kdbx import through the SDK path, not the generic importer path", async () => {
      await setup("keepass2xml", ClientType.Web);
      component().formGroup.controls.file.setValue({
        name: "export.kdbx",
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      } as unknown as File);
      component().formGroup.controls.kdbxPassword.setValue("hunter2");
      importService.importWithSdk.mockResolvedValue({} as any);
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(importService.importWithSdk).toHaveBeenCalledWith(
        "keepasskdbx",
        expect.any(Uint8Array),
        { kind: "passwordWithKeyFile", password: "hunter2", keyFile: null },
        undefined,
        undefined,
        false,
      );
      expect(importService.getImporter).not.toHaveBeenCalled();
      expect(continueSpy).toHaveBeenCalledTimes(1);
      expect(dialogService.open).toHaveBeenCalledWith(
        ImportSuccessDialogComponent,
        expect.objectContaining({ data: { sdkSummary: {} } }),
      );
    });

    it("maps a kdbx SDK error through sdkErrorMessageKey instead of showing the raw SDK message", async () => {
      // kdbxWrongFileType, not invalidFilePassword — the wrong-password case is dedicated inline
      // behavior now, covered by its own test below; every other mapped SDK error still goes
      // through the generic dialog.
      await setup("keepass2xml", ClientType.Web);
      component().formGroup.controls.file.setValue({
        name: "export.kdbx",
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      } as unknown as File);
      component().formGroup.controls.kdbxPassword.setValue("some-password");
      importService.importWithSdk.mockRejectedValue(new Error("raw sdk error"));
      importService.sdkErrorMessageKey.mockReturnValue("kdbxWrongFileType");
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(importService.sdkErrorMessageKey).toHaveBeenCalledWith(
        "keepasskdbx",
        expect.any(Error),
      );
      expect(dialogService.open).toHaveBeenCalledWith(
        ImportErrorDialogComponent,
        expect.objectContaining({
          data: expect.objectContaining({ message: "kdbxWrongFileType" }),
        }),
      );
      expect(continueSpy).not.toHaveBeenCalled();
    });

    it("shows an inline error on the kdbx password field, not the generic dialog, when the kdbx password is wrong", async () => {
      await setup("keepass2xml", ClientType.Web);
      component().formGroup.controls.file.setValue({
        name: "export.kdbx",
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      } as unknown as File);
      component().formGroup.controls.kdbxPassword.setValue("wrong-password");
      importService.importWithSdk.mockRejectedValue(new Error("raw sdk error"));
      importService.sdkErrorMessageKey.mockReturnValue("invalidFilePassword");
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(
        component().formGroup.controls.kdbxPassword.getError("kdbxPasswordInvalid").message,
      ).toBe("kdbxPasswordInvalid");
      expect(dialogService.open).not.toHaveBeenCalledWith(
        ImportErrorDialogComponent,
        expect.anything(),
      );
      expect(continueSpy).not.toHaveBeenCalled();
    });

    it("opens the error dialog with errorReadingFile — not a 'select a file' toast — instead of submitting a zero-byte kdbx file to the SDK", async () => {
      await setup("keepass2xml", ClientType.Web);
      component().formGroup.controls.file.setValue({
        name: "export.kdbx",
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      } as unknown as File);
      component().formGroup.controls.kdbxPassword.setValue("hunter2");
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(importService.importWithSdk).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: "selectFile" }),
      );
      expect(dialogService.open).toHaveBeenCalledWith(
        ImportErrorDialogComponent,
        expect.objectContaining({ data: expect.objectContaining({ message: "errorReadingFile" }) }),
      );
      expect(continueSpy).not.toHaveBeenCalled();
    });

    it("throws instead of silently falling through to a manual import when a direct-eligible vendor has no wired-up handler", async () => {
      // A direct-eligible vendor with no wired-up handler must fail loudly, not dead-end silently.
      importService.getImportOption.mockImplementation((id) =>
        id === "dashlanecsv"
          ? buildOption({
              id: "dashlanecsv",
              name: "Dashlane (csv)",
              hasDirectImporter: true,
              isBrowser: false,
            })
          : undefined,
      );
      await setup("dashlanecsv", ClientType.Desktop);
      expect(component().primaryMode()).toBe("direct");
      component().continueFromIntro();
      fixture.detectChanges();
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(dialogService.open).toHaveBeenCalledWith(
        ImportErrorDialogComponent,
        expect.anything(),
      );
      expect(continueSpy).not.toHaveBeenCalled();
    });

    it("runs a real Keeper direct login and import when no records fail", async () => {
      await setup("keeper", ClientType.Desktop);
      component().continueFromIntro();
      fixture.detectChanges();
      component().formGroup.controls.keeperEmail.setValue("user@example.com");
      const result = new ImportResult();
      keeperDirectImportService.handleImport.mockResolvedValue({ result, errors: [] });
      importService.importImportResult.mockResolvedValue(result);
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(keeperDirectImportService.handleImport).toHaveBeenCalledWith(
        "user@example.com",
        expect.anything(),
        undefined,
      );
      expect(importService.importImportResult).toHaveBeenCalledWith(
        result,
        undefined,
        undefined,
        false,
      );
      expect(dialogService.open).toHaveBeenCalledWith(
        ImportSuccessDialogComponent,
        expect.objectContaining({ data: { importResult: result } }),
      );
      expect(continueSpy).toHaveBeenCalledTimes(1);
    });

    it("surfaces a Keeper login failure as an inline email field error, not the generic error dialog", async () => {
      await setup("keeper", ClientType.Desktop);
      component().continueFromIntro();
      fixture.detectChanges();
      component().formGroup.controls.keeperEmail.setValue("user@example.com");
      keeperDirectImportService.handleImport.mockRejectedValue(
        new KeeperAuthError(KeeperAuthErrorCode.MfaFailed, "mfa failed"),
      );
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(component().formGroup.controls.keeperEmail.errors).toEqual({
        errors: { message: "multifactorAuthenticationFailed" },
      });
      expect(dialogService.open).not.toHaveBeenCalledWith(
        ImportErrorDialogComponent,
        expect.anything(),
      );
      expect(continueSpy).not.toHaveBeenCalled();
    });

    it("does not attempt a Keeper login when the email field is genuinely empty", async () => {
      // updateValueAndValidity() clears the manual error but still re-runs real validators.
      await setup("keeper", ClientType.Desktop);
      component().continueFromIntro();
      fixture.detectChanges();
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().submit();

      expect(keeperDirectImportService.handleImport).not.toHaveBeenCalled();
      expect(component().formGroup.controls.keeperEmail.touched).toBe(true);
      expect(continueSpy).not.toHaveBeenCalled();
    });

    it("recovers on a retry after a Keeper login failure, instead of leaving submit() permanently blocked", async () => {
      // Without clearing the manual error up front, every later submit() would no-op forever.
      await setup("keeper", ClientType.Desktop);
      component().continueFromIntro();
      fixture.detectChanges();
      component().formGroup.controls.keeperEmail.setValue("user@example.com");
      keeperDirectImportService.handleImport.mockRejectedValueOnce(
        new KeeperAuthError(KeeperAuthErrorCode.MfaFailed, "mfa failed"),
      );
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().submit();
      expect(continueSpy).not.toHaveBeenCalled();

      const result = new ImportResult();
      keeperDirectImportService.handleImport.mockResolvedValueOnce({ result, errors: [] });
      importService.importImportResult.mockResolvedValue(result);

      await component().submit();

      expect(keeperDirectImportService.handleImport).toHaveBeenCalledTimes(2);
      expect(continueSpy).toHaveBeenCalledTimes(1);
    });

    it("does not import when the Keeper partial-import confirmation dialog is dismissed", async () => {
      await setup("keeper", ClientType.Desktop);
      component().continueFromIntro();
      fixture.detectChanges();
      component().formGroup.controls.keeperEmail.setValue("user@example.com");
      const result = new ImportResult();
      result.ciphers = [{} as any];
      keeperDirectImportService.handleImport.mockResolvedValue({
        result,
        errors: [{ id: "row-1", reason: "error" } as any],
      });
      dialogService.open.mockReturnValue({ closed: of(false) } as any);
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(importService.importImportResult).not.toHaveBeenCalled();
      expect(continueSpy).not.toHaveBeenCalled();
    });

    it("imports the confirmed partial result when the Keeper confirmation dialog is accepted", async () => {
      await setup("keeper", ClientType.Desktop);
      component().continueFromIntro();
      fixture.detectChanges();
      component().formGroup.controls.keeperEmail.setValue("user@example.com");
      const result = new ImportResult();
      result.ciphers = [{} as any];
      keeperDirectImportService.handleImport.mockResolvedValue({
        result,
        errors: [{ id: "row-1", reason: "error" } as any],
      });
      dialogService.open.mockReturnValue({ closed: of(true) } as any);
      importService.importImportResult.mockResolvedValue(result);
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(importService.importImportResult).toHaveBeenCalledWith(
        result,
        undefined,
        undefined,
        false,
      );
      expect(continueSpy).toHaveBeenCalledTimes(1);
    });

    it("runs a real LastPass direct login, then imports the resulting csv through the generic path", async () => {
      await setup("lastpasscsv", ClientType.Desktop);
      component().continueFromIntro();
      fixture.detectChanges();
      component().formGroup.controls.lastPassEmail.setValue("user@example.com");
      component().formGroup.controls.includeSharedFolders.setValue(true);
      lastPassDirectImportService.handleImport.mockResolvedValue("url,username,password\n");
      importService.getImporter.mockReturnValue({} as any);
      const result = new ImportResult();
      importService.import.mockResolvedValue(result);
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(lastPassDirectImportService.handleImport).toHaveBeenCalledWith(
        "user@example.com",
        true,
      );
      expect(importService.getImporter).toHaveBeenCalledWith(
        "lastpasscsv",
        expect.any(Function),
        undefined,
      );
      expect(importService.import).toHaveBeenCalledWith(
        {},
        "url,username,password\n",
        undefined,
        undefined,
        false,
      );
      expect(continueSpy).toHaveBeenCalledTimes(1);
    });

    it("surfaces a LastPass login failure as an inline email field error, not the generic error dialog", async () => {
      await setup("lastpasscsv", ClientType.Desktop);
      component().continueFromIntro();
      fixture.detectChanges();
      component().formGroup.controls.lastPassEmail.setValue("user@example.com");
      lastPassDirectImportService.handleImport.mockRejectedValue(new Error("Invalid password"));
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(component().formGroup.controls.lastPassEmail.errors).toEqual({
        errors: { message: "incorrectUsernameOrPassword" },
      });
      expect(continueSpy).not.toHaveBeenCalled();
    });

    it("recovers on a retry after a LastPass login failure, instead of leaving submit() permanently blocked", async () => {
      await setup("lastpasscsv", ClientType.Desktop);
      component().continueFromIntro();
      fixture.detectChanges();
      component().formGroup.controls.lastPassEmail.setValue("user@example.com");
      lastPassDirectImportService.handleImport.mockRejectedValueOnce(new Error("Invalid password"));
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().submit();
      expect(continueSpy).not.toHaveBeenCalled();

      lastPassDirectImportService.handleImport.mockResolvedValueOnce("url,username,password\n");
      importService.getImporter.mockReturnValue({} as any);
      importService.import.mockResolvedValue(new ImportResult());

      await component().submit();

      expect(lastPassDirectImportService.handleImport).toHaveBeenCalledTimes(2);
      expect(continueSpy).toHaveBeenCalledTimes(1);
    });

    it("does not fetch Chromium logins when no profile is selected, but does once one is", async () => {
      importMetadataService.metadata$.mockReturnValue(
        of<ImporterCapabilities>({ type: "chromecsv", loaders: [Loader.file, Loader.chromium] }),
      );
      await setup("chromecsv", ClientType.Desktop);

      await component().submit();
      expect(importMetadataService.getChromiumLogins).not.toHaveBeenCalled();

      component().formGroup.controls.profile.setValue("Default");
      importMetadataService.getChromiumLogins.mockResolvedValue([
        { login: { url: "https://example.com", username: "alice", password: "hunter2", note: "" } },
      ]);
      importService.getImporter.mockReturnValue({} as any);
      importService.import.mockResolvedValue(new ImportResult());

      await component().submit();
      expect(importMetadataService.getChromiumLogins).toHaveBeenCalledWith("chromecsv", "Default");
    });

    it("imports a Chromium profile's real logins through the generic csv path", async () => {
      importMetadataService.metadata$.mockReturnValue(
        of<ImporterCapabilities>({ type: "chromecsv", loaders: [Loader.file, Loader.chromium] }),
      );
      await setup("chromecsv", ClientType.Desktop);
      component().formGroup.controls.profile.setValue("Default");
      importMetadataService.getChromiumLogins.mockResolvedValue([
        { login: { url: "https://example.com", username: "alice", password: "hunter2", note: "" } },
      ]);
      importService.getImporter.mockReturnValue({} as any);
      const result = new ImportResult();
      importService.import.mockResolvedValue(result);
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(importMetadataService.getChromiumLogins).toHaveBeenCalledWith("chromecsv", "Default");
      expect(importService.getImporter).toHaveBeenCalledWith(
        "chromecsv",
        expect.any(Function),
        undefined,
      );
      expect(importService.import).toHaveBeenCalledWith(
        {},
        expect.stringContaining("example.com"),
        undefined,
        undefined,
        false,
      );
      expect(continueSpy).toHaveBeenCalledTimes(1);
    });

    it("opens the generic error dialog when the Chromium import returns no logins at all", async () => {
      importMetadataService.metadata$.mockReturnValue(
        of<ImporterCapabilities>({ type: "chromecsv", loaders: [Loader.file, Loader.chromium] }),
      );
      await setup("chromecsv", ClientType.Desktop);
      component().formGroup.controls.profile.setValue("Default");
      importMetadataService.getChromiumLogins.mockResolvedValue([]);
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await component().onContinue();

      expect(dialogService.open).toHaveBeenCalledWith(
        ImportErrorDialogComponent,
        expect.objectContaining({ data: expect.any(Error) }),
      );
      expect(continueSpy).not.toHaveBeenCalled();
    });
  });
});
