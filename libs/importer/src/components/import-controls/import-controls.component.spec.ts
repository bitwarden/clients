import { LiveAnnouncer } from "@angular/cdk/a11y";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { map, of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ClientType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";

import { KeeperAuthError, KeeperAuthErrorCode } from "../../importers/keeper/access";
import { Loader } from "../../metadata";
import { CredentialKind, ImportOption, ImportResult, ImportType } from "../../models";
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
      bravecsv: buildOption({
        id: "bravecsv",
        name: "Brave",
        isBrowser: true,
        hasDirectImporter: true,
        instructionKey: "importChromiumAliasPreamble",
        instructionLink: "https://bitwarden.com/help/import-from-chrome/",
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

    it("does not need disambiguation for a vendor with no extension collision", async () => {
      await setup("dashlanecsv", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.csv" } as File);
      fixture.detectChanges();

      expect(component().needsFormatDisambiguation()).toBe(false);
      expect(component().resolvedFormat()).toBe("dashlanecsv");
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

    it("clears a stale format choice when a new file is chosen", async () => {
      await setup("1password1pux", ClientType.Web);
      component().formGroup.controls.file.setValue({ name: "export.csv" } as File);
      component().formGroup.controls.formatChoice.setValue("1passwordmaccsv");

      component().formGroup.controls.file.setValue({ name: "export.1pux" } as File);
      fixture.detectChanges();

      expect(component().formGroup.controls.formatChoice.value).toBeNull();
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
      it("offers every paste-capable format once content is present, for a vendor with no collision", async () => {
        await setup("dashlanecsv", ClientType.Web);
        component().formGroup.controls.method.setValue("paste");
        component().formGroup.controls.fileContents.setValue('{"some": "json"}');
        fixture.detectChanges();

        expect(
          component()
            .candidateFormats()
            .map((o: ImportOption) => o.id),
        ).toEqual(["dashlanecsv", "dashlanejson"]);
        expect(component().needsFormatDisambiguation()).toBe(true);
      });

      it("does not default to the first label in the list — requires an explicit choice", async () => {
        await setup("dashlanecsv", ClientType.Web);
        component().formGroup.controls.method.setValue("paste");
        component().formGroup.controls.fileContents.setValue('{"some": "json"}');
        fixture.detectChanges();

        expect(component().resolvedFormat()).toBeUndefined();

        component().formGroup.controls.formatChoice.setValue("dashlanejson");
        fixture.detectChanges();

        expect(component().resolvedFormat()).toBe("dashlanejson");
      });

      it("shows no candidates until content is actually present", async () => {
        await setup("dashlanecsv", ClientType.Web);
        component().formGroup.controls.method.setValue("paste");
        fixture.detectChanges();

        expect(component().candidateFormats()).toEqual([]);
      });
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

    it("does not emit continue — and shows a 'select a file' toast, not 'select a format' — when Continue is clicked with nothing to import", async () => {
      // resolvedFormat() is undefined here for a different reason than a format collision.
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

      expect(importService.sdkErrorMessageKey).toHaveBeenCalledWith(
        "keepasskdbx",
        expect.any(Error),
      );
      expect(dialogService.open).toHaveBeenCalledWith(
        ImportErrorDialogComponent,
        expect.objectContaining({
          data: expect.objectContaining({ message: "invalidFilePassword" }),
        }),
      );
      expect(continueSpy).not.toHaveBeenCalled();
    });

    it("shows a 'select a file' toast instead of submitting a zero-byte kdbx file to the SDK", async () => {
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
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", message: "selectFile" }),
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
