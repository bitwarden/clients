import { ComponentFixture, TestBed } from "@angular/core/testing";
import { of } from "rxjs";

import { DialogService, I18nMockService } from "@bitwarden/components";

import { ImportServiceAbstraction } from "../../services";
import { ImportErrorDialogComponent, ImportSuccessDialogComponent } from "../dialog";

import { ImportControlsComponent } from "./import-controls.component";

/** Guards decoratorsFor()/I18nMockService/importServiceStub against drifting from what the
 *  component's real execution paths resolve. Drives real submit(), not onContinue(). Tracks
 *  every missing i18n key and which dialog opened per case. */

// @storybook/angular is ESM-only (can't require() it here) — stub just enough to extract the
// real moduleMetadata() config.
jest.mock("@storybook/angular", () => ({
  moduleMetadata: (metadata: unknown) => (storyFn: () => unknown) => ({
    ...(storyFn() as object),
    moduleMetadata: metadata,
  }),
}));
jest.mock("storybook/actions", () => ({ action: () => () => {} }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const stories = require("./import-controls.stories");

const RAW_JS_ERROR_PATTERN = /is not a function|cannot read propert|nullinjector|undefined is not/i;

/** Extracts the story's full moduleMetadata and throws if it adds a decorator key this test
 *  doesn't forward. */
function moduleMetadataFor(story: { decorators: unknown[] }): {
  providers?: unknown[];
  imports?: unknown[];
} {
  if (story.decorators.length !== 1) {
    throw new Error(
      `Story has ${story.decorators.length} decorators; this test only knows how to forward one — update moduleMetadataFor().`,
    );
  }
  const applied = (story.decorators[0] as (storyFn: () => unknown) => Record<string, unknown>)(
    () => ({}),
  );
  const moduleMetadata = applied.moduleMetadata as Record<string, unknown> | undefined;
  if (moduleMetadata == null) {
    // A non-moduleMetadata decorator wouldn't produce this key — fail with a clear message.
    throw new Error(
      `Story's decorator produced [${Object.keys(applied).join(", ")}] but no moduleMetadata — update moduleMetadataFor().`,
    );
  }
  const forwarded = new Set(["providers", "imports"]);
  const unhandled = Object.keys(moduleMetadata).filter(
    (key) => forwarded.has(key) === false && moduleMetadata[key] != null,
  );
  if (unhandled.length > 0) {
    throw new Error(
      `Story moduleMetadata has keys this test doesn't forward: ${unhandled.join(", ")} — update moduleMetadataFor().`,
    );
  }
  return moduleMetadata;
}

function importTypeFromTemplate(template: string): string {
  const match = template.match(/\simportType="([^"]+)"/);
  if (match == null) {
    throw new Error("Story template has no importType binding — can't extract it for the test.");
  }
  return match[1];
}

describe("import-controls.stories i18n and DI coverage", () => {
  let missedKeys: string[];
  let openedDialogs: unknown[];
  let calledImportMethods: string[];

  beforeEach(() => {
    missedKeys = [];
    openedDialogs = [];
    calledImportMethods = [];
    jest.spyOn(I18nMockService.prototype, "t").mockImplementation(function (
      this: { lookupTable: Record<string, string | ((...args: unknown[]) => string)> },
      key: string,
      ...args: unknown[]
    ) {
      const value = this.lookupTable[key];
      if (value === undefined) {
        missedKeys.push(key);
        return `MISSING_KEY:${key}`;
      }
      return typeof value === "string" ? value : value(...args);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mount = async (story: {
    decorators: unknown[];
    render: (args: unknown) => { template: string };
  }) => {
    const importType = importTypeFromTemplate(story.render({}).template);
    const metadata = moduleMetadataFor(story);
    const providers = metadata.providers ?? [];

    // Spies on the real importServiceStub instance so each case can assert which path fired.
    const importServiceProvider = (providers as { provide: unknown; useValue?: any }[]).find(
      (p) => p.provide === ImportServiceAbstraction,
    );
    if (importServiceProvider?.useValue == null) {
      throw new Error("Story has no ImportServiceAbstraction provider — update this test.");
    }
    for (const method of ["import", "importWithSdk", "importImportResult"] as const) {
      const original = importServiceProvider.useValue[method];
      if (typeof original !== "function") {
        continue;
      }
      jest
        .spyOn(importServiceProvider.useValue, method)
        .mockImplementation((...args: unknown[]) => {
          calledImportMethods.push(method);
          return original(...args);
        });
    }

    await TestBed.configureTestingModule({
      imports: [ImportControlsComponent, ...((metadata.imports as any[]) ?? [])],
      providers,
    }).compileComponents();

    const dialogService = TestBed.inject(DialogService);
    jest.spyOn(dialogService, "open").mockImplementation((component: unknown, config?: any) => {
      openedDialogs.push(component);
      const message = config?.data?.message;
      // A broken stub throws a raw JS error — fail loudly, or it'd render as an invisible empty dialog.
      if (
        component === ImportErrorDialogComponent &&
        typeof message === "string" &&
        RAW_JS_ERROR_PATTERN.test(message)
      ) {
        throw new Error(`ImportErrorDialogComponent opened with a raw JS error: ${message}`);
      }
      return { closed: of(undefined) } as any;
    });

    const fixture: ComponentFixture<ImportControlsComponent> =
      TestBed.createComponent(ImportControlsComponent);
    fixture.componentRef.setInput("importType", importType);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  // Self-tests for the guards above, so a broken guard fails here, not silently in the cases below.
  describe("guard mechanisms themselves", () => {
    it("the raw-JS-error pattern matches real broken-stub messages", () => {
      expect(RAW_JS_ERROR_PATTERN.test("this.importService.getImporter is not a function")).toBe(
        true,
      );
      expect(RAW_JS_ERROR_PATTERN.test("Cannot read property 'foo' of undefined")).toBe(true);
    });

    it("the raw-JS-error pattern does not match real localized messages", () => {
      expect(RAW_JS_ERROR_PATTERN.test("Nothing was imported.")).toBe(false);
      expect(RAW_JS_ERROR_PATTERN.test("An error has occurred.")).toBe(false);
      expect(RAW_JS_ERROR_PATTERN.test("Invalid master password")).toBe(false);
    });
  });

  it("VendorDirect: advances to credentials, enters a valid email, then submits", async () => {
    const fixture = await mount(stories.VendorDirect);
    const component = fixture.componentInstance as any;

    component.continueFromIntro();
    fixture.detectChanges();
    component.formGroup.controls.keeperEmail.setValue("user@example.com");
    fixture.detectChanges();
    await component.submit();
    fixture.detectChanges();

    // The Keeper stub always rejects, surfacing as an inline field error, not a dialog.
    expect(openedDialogs).toEqual([]);
    expect(calledImportMethods).toEqual([]);
    expect(component.formGroup.controls.keeperEmail.invalid).toBe(true);
    expect(missedKeys).toEqual([]);
  });

  it("VendorDirect: submitting with an empty, untouched-until-now email exercises markAllAsTouched() safely", async () => {
    // onContinue() alone can't reach this — submit()'s own invalid-check runs first.
    const fixture = await mount(stories.VendorDirect);
    const component = fixture.componentInstance as any;

    component.continueFromIntro();
    fixture.detectChanges();
    await component.submit();
    fixture.detectChanges();

    // Pins the exit taken, so this can't silently stop exercising markAllAsTouched().
    expect(component.formGroup.invalid).toBe(true);
    expect(component.formGroup.controls.keeperEmail.touched).toBe(true);
    expect(openedDialogs).toEqual([]);
    expect(calledImportMethods).toEqual([]);
    expect(missedKeys).toEqual([]);
  });

  it("VendorDirectHiddenOnWeb: manual mode (Web can't reach direct), choose a file, submit", async () => {
    const fixture = await mount(stories.VendorDirectHiddenOnWeb);
    const component = fixture.componentInstance as any;

    expect(component.primaryMode()).toBe("manual");
    component.formGroup.controls.file.setValue(new File(["a,b"], "export.csv"));
    fixture.detectChanges();
    await component.submit();
    fixture.detectChanges();

    expect(openedDialogs).toEqual([ImportSuccessDialogComponent]);
    expect(calledImportMethods).toEqual(["import"]);
    expect(missedKeys).toEqual([]);
  });

  it("Chromium: selects a profile, then submits", async () => {
    const fixture = await mount(stories.Chromium);
    const component = fixture.componentInstance as any;

    component.formGroup.controls.profile.setValue("Default");
    fixture.detectChanges();
    await component.submit();
    fixture.detectChanges();

    // The stub always resolves zero logins, so this throws before the import call — correctly.
    expect(openedDialogs).toEqual([ImportErrorDialogComponent]);
    expect(calledImportMethods).toEqual([]);
    expect(missedKeys).toEqual([]);
  });

  it("ChromiumNoProfiles: mounts and shows the empty-profile-list error callout", async () => {
    await mount(stories.ChromiumNoProfiles);

    expect(openedDialogs).toEqual([]);
    expect(calledImportMethods).toEqual([]);
    expect(missedKeys).toEqual([]);
  });

  it("FileOnly: chooses a file, then submits", async () => {
    const fixture = await mount(stories.FileOnly);
    const component = fixture.componentInstance as any;

    component.formGroup.controls.file.setValue(new File(["a,b"], "export.csv"));
    fixture.detectChanges();
    await component.submit();
    fixture.detectChanges();

    expect(openedDialogs).toEqual([ImportSuccessDialogComponent]);
    expect(calledImportMethods).toEqual(["import"]);
    expect(missedKeys).toEqual([]);
  });

  it("VendorFormatGrouping: chooses an ambiguous .csv, resolves the disambiguation, then submits", async () => {
    const fixture = await mount(stories.VendorFormatGrouping);
    const component = fixture.componentInstance as any;

    component.formGroup.controls.file.setValue(new File(["a,b"], "export.csv"));
    fixture.detectChanges();
    expect(component.needsFormatDisambiguation()).toBe(true);
    component.formGroup.controls.formatChoice.setValue("1passwordwincsv");
    fixture.detectChanges();
    await component.submit();
    fixture.detectChanges();

    expect(openedDialogs).toEqual([ImportSuccessDialogComponent]);
    expect(calledImportMethods).toEqual(["import"]);
    expect(missedKeys).toEqual([]);
  });

  it("KdbxCredentials: chooses a .kdbx file, adds a key file, enters a password, then submits", async () => {
    const fixture = await mount(stories.KdbxCredentials);
    const component = fixture.componentInstance as any;

    component.formGroup.controls.file.setValue({
      name: "export.kdbx",
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    } as unknown as File);
    fixture.detectChanges();
    component.addKeyFile();
    fixture.detectChanges();
    component.formGroup.controls.kdbxPassword.setValue("hunter2");
    fixture.detectChanges();
    await component.submit();
    fixture.detectChanges();

    // Confirms the real SDK branch fired, not just that the same dialog happened to open.
    expect(openedDialogs).toEqual([ImportSuccessDialogComponent]);
    expect(calledImportMethods).toEqual(["importWithSdk"]);
    expect(missedKeys).toEqual([]);
  });

  it("KdbxCredentials: submitting with an empty, untouched-until-now password exercises markAllAsTouched() safely", async () => {
    const fixture = await mount(stories.KdbxCredentials);
    const component = fixture.componentInstance as any;

    component.formGroup.controls.file.setValue({
      name: "export.kdbx",
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    } as unknown as File);
    fixture.detectChanges();
    await component.submit();
    fixture.detectChanges();

    expect(component.formGroup.invalid).toBe(true);
    expect(component.formGroup.controls.kdbxPassword.touched).toBe(true);
    expect(openedDialogs).toEqual([]);
    expect(calledImportMethods).toEqual([]);
    expect(missedKeys).toEqual([]);
  });
});
