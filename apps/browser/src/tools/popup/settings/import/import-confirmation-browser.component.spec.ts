import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ActionsService } from "@bitwarden/common/platform/actions";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { GlobalStateProvider } from "@bitwarden/state";

import { BrowserApi } from "../../../../platform/browser/browser-api";

import { ImportConfirmationBrowserComponent } from "./import-confirmation-browser.component";
import { ImportConfirmationStateService } from "./import-confirmation-state.service";

describe("ImportConfirmationBrowserComponent", () => {
  let fixture: ComponentFixture<ImportConfirmationBrowserComponent>;
  let router: MockProxy<Router>;
  let actionsService: MockProxy<ActionsService>;
  let confirmationState: ImportConfirmationStateService;
  let isPopupOpen: jest.SpyInstance<Promise<boolean>>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? "";
  const button = (id: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(`#${id}`);

  // Lets the poll's timers and promises run to completion.
  const settle = async () => {
    await jest.runAllTimersAsync();
    fixture.detectChanges();
  };

  const create = async (options: { total?: number | null; settled?: boolean } = {}) => {
    const { total = 3, settled = true } = options;

    await TestBed.configureTestingModule({
      imports: [ImportConfirmationBrowserComponent],
      providers: [
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
        { provide: Router, useValue: router },
        { provide: ActionsService, useValue: actionsService },
        {
          provide: I18nService,
          useValue: mock<I18nService>({
            t: (key: string, ...args: (string | number)[]) => [key, ...args].join(":"),
          }),
        },
      ],
    }).compileComponents();

    confirmationState = TestBed.inject(ImportConfirmationStateService);
    if (total != null) {
      await confirmationState.set({
        summary: { total, rows: [] },
        importedFile: { name: "a.csv" },
      });
    }

    fixture = TestBed.createComponent(ImportConfirmationBrowserComponent);
    fixture.detectChanges();
    if (settled) {
      await settle();
    }
  };

  beforeEach(() => {
    jest.useFakeTimers();
    router = mock<Router>();
    router.navigate.mockResolvedValue(true);
    actionsService = mock<ActionsService>();
    actionsService.openPopup.mockResolvedValue(undefined);
    isPopupOpen = jest.spyOn(BrowserApi, "isPopupOpen");
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("while it opens the popup", () => {
    beforeEach(() => {
      isPopupOpen.mockResolvedValue(false);
    });

    it("shows the spinner card with how many items were imported", async () => {
      await create({ total: 74, settled: false });

      expect(text()).toContain("importingItemsTitle:74");
      expect(text()).toContain("openingExtensionSubtitle");
      expect(fixture.nativeElement.querySelector("bit-spinner")).not.toBeNull();
    });

    it("uses the singular title for one item", async () => {
      await create({ total: 1, settled: false });

      expect(text()).toContain("importingItemsTitleSingular");
      expect(text()).not.toContain("importingItemsTitle:");
    });
  });

  it("shows the celebration card once the popup is open, with no summary or vault button", async () => {
    isPopupOpen.mockResolvedValue(true);

    await create();

    expect(actionsService.openPopup).toHaveBeenCalledTimes(1);
    expect(text()).toContain("openedExtensionTitle");
    expect(text()).not.toContain("somethingWentWrong");
    expect(text()).not.toContain("importSuccessful");
    expect(text()).not.toContain("viewImportedItems");
    expect(fixture.nativeElement.querySelector("bit-spinner")).toBeNull();
  });

  it("shows Something went wrong with the Open extension button when the popup does not open", async () => {
    isPopupOpen.mockResolvedValue(false);

    await create();

    expect(text()).toContain("somethingWentWrong");
    expect(text()).toContain("openingExtensionError");
    expect(button("import-confirmation_button_open-extension")).not.toBeNull();
    expect(text()).not.toContain("openedExtensionTitle");
  });

  it("shows the celebration card when the button opens the popup", async () => {
    isPopupOpen.mockResolvedValue(false);
    await create();
    isPopupOpen.mockResolvedValue(true);

    button("import-confirmation_button_open-extension")!.click();
    await settle();

    expect(actionsService.openPopup).toHaveBeenCalledTimes(2);
    expect(text()).toContain("openedExtensionTitle");
    expect(button("import-confirmation_button_open-extension")).toBeNull();
  });

  it("points at the toolbar icon when the button cannot open the popup either", async () => {
    isPopupOpen.mockResolvedValue(false);
    await create();

    button("import-confirmation_button_open-extension")!.click();
    await settle();

    expect(text()).toContain("somethingWentWrong");
    expect(text()).toContain("openingExtensionToolbarErrorPart1");
    expect(text()).toContain("openingExtensionToolbarErrorPart2");
    expect(button("import-confirmation_button_open-extension")).toBeNull();
  });

  it("goes to the vault when there is no result to show", async () => {
    await create({ total: null });

    expect(router.navigate).toHaveBeenCalledWith(["/tabs/vault"]);
    expect(actionsService.openPopup).not.toHaveBeenCalled();
  });

  it("drops its own copy of the result when destroyed, and leaves the popup's", async () => {
    isPopupOpen.mockResolvedValue(true);
    await create();

    fixture.destroy();

    expect(confirmationState.current()).toBeUndefined();
  });
});
