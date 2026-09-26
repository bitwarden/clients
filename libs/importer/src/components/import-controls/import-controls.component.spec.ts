import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { ClientType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { Loader } from "../../metadata";
import { ImportOption, ImportType } from "../../models";
import {
  ImporterCapabilities,
  ImportMetadataServiceAbstraction,
  ImportServiceAbstraction,
} from "../../services";

import { ImportControlsComponent } from "./import-controls.component";

describe("ImportControlsComponent", () => {
  let fixture: ComponentFixture<ImportControlsComponent>;
  let importService: MockProxy<ImportServiceAbstraction>;
  let importMetadataService: MockProxy<ImportMetadataServiceAbstraction>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;

  const component = () => fixture.componentInstance as any;
  const byId = (id: string) => fixture.debugElement.query(By.css(`#${id}`));

  const setup = async (importType: ImportType, clientType: ClientType) => {
    platformUtilsService.getClientType.mockReturnValue(clientType);

    await TestBed.configureTestingModule({
      imports: [ImportControlsComponent],
      providers: [
        { provide: ImportServiceAbstraction, useValue: importService },
        { provide: ImportMetadataServiceAbstraction, useValue: importMetadataService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: I18nService, useValue: mock<I18nService>({ t: (key: string) => key }) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportControlsComponent);
    fixture.componentRef.setInput("importType", importType);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    importMetadataService = mock<ImportMetadataServiceAbstraction>();
    importMetadataService.init.mockResolvedValue(undefined);
    importMetadataService.metadata$.mockReturnValue(
      of<ImporterCapabilities>({ type: "chromecsv", loaders: [Loader.file] }),
    );
    platformUtilsService = mock<PlatformUtilsService>();

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
        providers: [
          { provide: ImportServiceAbstraction, useValue: importService },
          { provide: ImportMetadataServiceAbstraction, useValue: importMetadataService },
          { provide: PlatformUtilsService, useValue: platformUtilsService },
          { provide: I18nService, useValue: mock<I18nService>({ t: (key: string) => key }) },
        ],
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

    it("emits continue from a manual mode's Continue button", async () => {
      await setup("dashlanecsv", ClientType.Web);
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      component().onContinue();

      expect(continueSpy).toHaveBeenCalledTimes(1);
    });

    it("emits continue when the real Continue button is clicked outside the direct-intro sub-step", async () => {
      await setup("dashlanecsv", ClientType.Web);
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      byId("importer-controls_button_continue").nativeElement.click();

      expect(continueSpy).toHaveBeenCalledTimes(1);
    });

    it("also submits via the form's native submit event, not just a button click — e.g. pressing Enter in a field", async () => {
      await setup("dashlanecsv", ClientType.Web);
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
});
