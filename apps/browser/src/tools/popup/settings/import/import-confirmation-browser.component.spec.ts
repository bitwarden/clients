import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ActionsService } from "@bitwarden/common/platform/actions";

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

  const create = async (options: { withResult?: boolean } = {}) => {
    const { withResult = true } = options;
    confirmationState = new ImportConfirmationStateService();
    if (withResult) {
      confirmationState.set({
        summary: { total: 3, rows: [{ icon: "globe", labelKey: "typeLogin", count: 3 }] },
        fileName: "export.csv",
      });
    }

    await TestBed.configureTestingModule({
      imports: [ImportConfirmationBrowserComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: ActionsService, useValue: actionsService },
        { provide: ImportConfirmationStateService, useValue: confirmationState },
        {
          provide: I18nService,
          useValue: mock<I18nService>({
            t: (key: string, ...args: string[]) => [key, ...args].join(":"),
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportConfirmationBrowserComponent);
    fixture.detectChanges();
    await settle();
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

  it("leaves the summary showing, with the file tip, once the popup is open", async () => {
    isPopupOpen.mockResolvedValue(true);

    await create();

    expect(actionsService.openPopup).toHaveBeenCalledTimes(1);
    expect(text()).toContain("importSuccessful");
    expect(text()).toContain("importDeleteFileTip:export.csv");
    expect(text()).not.toContain("openingExtensionError");
    expect(button("import-confirmation_button_open-extension")).toBeNull();
  });

  it("keeps the summary and shows the Open extension button under it when the popup does not open", async () => {
    isPopupOpen.mockResolvedValue(false);

    await create();

    expect(text()).toContain("importSuccessful");
    expect(text()).toContain("importDeleteFileTip:export.csv");
    expect(button("import-confirmation_button_view-items")).not.toBeNull();
    expect(text()).toContain("openingExtensionError");
    expect(button("import-confirmation_button_open-extension")).not.toBeNull();
  });

  it("removes the fallback when the button opens the popup", async () => {
    isPopupOpen.mockResolvedValue(false);
    await create();
    isPopupOpen.mockResolvedValue(true);

    button("import-confirmation_button_open-extension")!.click();
    await settle();

    expect(actionsService.openPopup).toHaveBeenCalledTimes(2);
    expect(text()).toContain("importSuccessful");
    expect(text()).not.toContain("openingExtensionError");
    expect(button("import-confirmation_button_open-extension")).toBeNull();
  });

  it("keeps the summary and points at the toolbar icon when the button cannot open the popup either", async () => {
    isPopupOpen.mockResolvedValue(false);
    await create();

    button("import-confirmation_button_open-extension")!.click();
    await settle();

    expect(text()).toContain("importSuccessful");
    expect(text()).toContain("importDeleteFileTip:export.csv");
    expect(button("import-confirmation_button_view-items")).not.toBeNull();
    expect(text()).toContain("openingExtensionToolbarErrorPart1");
    expect(button("import-confirmation_button_open-extension")).toBeNull();
  });

  it("opens the vault from the View imported items button", async () => {
    isPopupOpen.mockResolvedValue(true);
    await create();

    button("import-confirmation_button_view-items")!.click();

    expect(router.navigate).toHaveBeenCalledWith(["/tabs/vault"]);
  });

  it("goes to the vault when there is no result to show", async () => {
    await create({ withResult: false });

    expect(router.navigate).toHaveBeenCalledWith(["/tabs/vault"]);
    expect(actionsService.openPopup).not.toHaveBeenCalled();
  });

  it("clears the result when the page is destroyed", async () => {
    isPopupOpen.mockResolvedValue(true);
    await create();

    fixture.destroy();

    expect(confirmationState.current()).toBeUndefined();
  });
});
