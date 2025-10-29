import { LiveAnnouncer } from "@angular/cdk/a11y";
import { CdkDragDrop, moveItemInArray } from "@angular/cdk/drag-drop";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { CipherFormContainer } from "../../cipher-form-container";

import { AutofillOptionsComponent } from "./autofill-options.component";

jest.mock("@angular/cdk/drag-drop", () => {
  const actual = jest.requireActual("@angular/cdk/drag-drop");
  return {
    ...actual,
    moveItemInArray: jest.fn(actual.moveItemInArray),
  };
});

describe("AutofillOptionsComponent", () => {
  let component: AutofillOptionsComponent;
  let fixture: ComponentFixture<AutofillOptionsComponent>;

  let cipherFormContainer: MockProxy<CipherFormContainer>;
  let liveAnnouncer: MockProxy<LiveAnnouncer>;
  let domainSettingsService: MockProxy<DomainSettingsService>;
  let autofillSettingsService: MockProxy<AutofillSettingsServiceAbstraction>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  const getInitialCipherView = jest.fn((): any => null);
  const formStatusChange$ = new BehaviorSubject<"enabled" | "disabled">("enabled");

  beforeEach(async () => {
    getInitialCipherView.mockClear();
    cipherFormContainer = mock<CipherFormContainer>({ getInitialCipherView, formStatusChange$ });
    liveAnnouncer = mock<LiveAnnouncer>();
    platformUtilsService = mock<PlatformUtilsService>();
    domainSettingsService = mock<DomainSettingsService>();
    domainSettingsService.resolvedDefaultUriMatchStrategy$ = new BehaviorSubject(null);

    autofillSettingsService = mock<AutofillSettingsServiceAbstraction>();
    autofillSettingsService.autofillOnPageLoadDefault$ = new BehaviorSubject(false);
    autofillSettingsService.autofillOnPageLoad$ = new BehaviorSubject(true);

    await TestBed.configureTestingModule({
      imports: [AutofillOptionsComponent],
      providers: [
        { provide: CipherFormContainer, useValue: cipherFormContainer },
        {
          provide: I18nService,
          useValue: { t: (...keys: string[]) => keys.filter(Boolean).join(" ") },
        },
        { provide: LiveAnnouncer, useValue: liveAnnouncer },
        { provide: DomainSettingsService, useValue: domainSettingsService },
        { provide: AutofillSettingsServiceAbstraction, useValue: autofillSettingsService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AutofillOptionsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("registers 'autoFillOptionsForm' form with CipherFormContainer", () => {
    fixture.detectChanges();
    expect(cipherFormContainer.registerChildForm).toHaveBeenCalledWith(
      "autoFillOptions",
      component.autofillOptionsForm,
    );
  });

  it("patches 'autoFillOptionsForm' changes to CipherFormContainer", () => {
    fixture.detectChanges();

    component.autofillOptionsForm.patchValue({
      uris: [{ uri: "https://example.com", matchDetection: UriMatchStrategy.Exact }],
      autofillOnPageLoad: true,
    });

    expect(cipherFormContainer.patchCipher).toHaveBeenCalled();
    const patchFn = cipherFormContainer.patchCipher.mock.lastCall[0];

    const updatedCipher = patchFn(new CipherView());

    const expectedUri = Object.assign(new LoginUriView(), {
      uri: "https://example.com",
      match: UriMatchStrategy.Exact,
    } as LoginUriView);

    expect(updatedCipher.login.uris).toEqual([expectedUri]);
    expect(updatedCipher.login.autofillOnPageLoad).toEqual(true);
  });

  it("disables 'autoFillOptionsForm' when in partial-edit mode", () => {
    cipherFormContainer.config.mode = "partial-edit";

    fixture.detectChanges();

    expect(component.autofillOptionsForm.disabled).toBe(true);
  });

  it("initializes 'autoFillOptionsForm' with original login view values", () => {
    const existingLogin = new LoginUriView();
    existingLogin.uri = "https://example.com";
    existingLogin.match = UriMatchStrategy.Exact;

    const cipher = new CipherView();
    cipher.login = {
      autofillOnPageLoad: true,
      uris: [existingLogin],
    } as LoginView;

    getInitialCipherView.mockReturnValueOnce(cipher);

    fixture.detectChanges();

    expect(component.autofillOptionsForm.value.uris).toEqual([
      { uri: "https://example.com", matchDetection: UriMatchStrategy.Exact },
    ]);
    expect(component.autofillOptionsForm.value.autofillOnPageLoad).toEqual(true);
  });

  it("initializes 'autoFillOptionsForm' with initialValues when creating a new cipher", () => {
    cipherFormContainer.config.initialValues = { loginUri: "https://example.com" };

    fixture.detectChanges();

    expect(component.autofillOptionsForm.value.uris).toEqual([
      { uri: "https://example.com", matchDetection: null },
    ]);
    expect(component.autofillOptionsForm.value.autofillOnPageLoad).toEqual(null);
  });

  it("initializes 'autoFillOptionsForm' with initialValues when editing an existing cipher", () => {
    cipherFormContainer.config.initialValues = { loginUri: "https://new-website.com" };
    const existingLogin = new LoginUriView();
    existingLogin.uri = "https://example.com";
    existingLogin.match = UriMatchStrategy.Exact;

    const cipher = new CipherView();
    cipher.login = {
      autofillOnPageLoad: true,
      uris: [existingLogin],
    } as LoginView;

    getInitialCipherView.mockReturnValueOnce(cipher);

    fixture.detectChanges();

    expect(component.autofillOptionsForm.value.uris).toEqual([
      { uri: "https://example.com", matchDetection: UriMatchStrategy.Exact },
      { uri: "https://new-website.com", matchDetection: null },
    ]);
    expect(component.autofillOptionsForm.value.autofillOnPageLoad).toEqual(true);
  });

  it("initializes 'autoFillOptionsForm' with initialValues without duplicating an existing URI", () => {
    cipherFormContainer.config.initialValues = { loginUri: "https://example.com" };
    const existingLogin = new LoginUriView();
    existingLogin.uri = "https://example.com";
    existingLogin.match = UriMatchStrategy.Exact;

    const cipher = new CipherView();
    cipher.login = {
      autofillOnPageLoad: true,
      uris: [existingLogin],
    } as LoginView;

    getInitialCipherView.mockReturnValueOnce(cipher);

    fixture.detectChanges();

    expect(component.autofillOptionsForm.value.uris).toEqual([
      { uri: "https://example.com", matchDetection: UriMatchStrategy.Exact },
    ]);
    expect(component.autofillOptionsForm.value.autofillOnPageLoad).toEqual(true);
  });

  it("initializes 'autoFillOptionsForm' with an empty URI when creating a new cipher", () => {
    cipherFormContainer.config.initialValues = null;

    fixture.detectChanges();

    expect(component.autofillOptionsForm.value.uris).toEqual([{ uri: null, matchDetection: null }]);
  });

  it("updates the default autofill on page load label", () => {
    fixture.detectChanges();
    expect(component["autofillOptions"][0].label).toEqual("defaultLabelWithValue no");

    (autofillSettingsService.autofillOnPageLoadDefault$ as BehaviorSubject<boolean>).next(true);
    fixture.detectChanges();

    expect(component["autofillOptions"][0].label).toEqual("defaultLabelWithValue yes");
  });

  it("hides the autofill on page load field when the setting is disabled", () => {
    fixture.detectChanges();
    let control = fixture.nativeElement.querySelector(
      "bit-select[formControlName='autofillOnPageLoad']",
    );
    expect(control).toBeTruthy();

    (autofillSettingsService.autofillOnPageLoad$ as BehaviorSubject<boolean>).next(false);

    fixture.detectChanges();
    control = fixture.nativeElement.querySelector(
      "bit-select[formControlName='autofillOnPageLoad']",
    );
    expect(control).toBeFalsy();
  });

  it("announces the addition of a new URI input", fakeAsync(() => {
    fixture.detectChanges();

    // Mock the liveAnnouncer implementation so we can resolve it manually
    let resolveAnnouncer: () => void;
    jest.spyOn(liveAnnouncer, "announce").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAnnouncer = resolve;
        }),
    );

    component.addUri(undefined, true);
    fixture.detectChanges();

    expect(liveAnnouncer.announce).toHaveBeenCalledWith("websiteAdded", "polite");

    // Spy on the last URI input's focusInput method to ensure it is called
    jest.spyOn(component["uriOptions"].last, "focusInput");
    resolveAnnouncer(); // Resolve the liveAnnouncer promise so that focusOnNewInput$ pipe can continue
    tick();

    expect(component["uriOptions"].last.focusInput).toHaveBeenCalled();
  }));

  it("removes URI input when remove() is called", () => {
    fixture.detectChanges();

    // Add second Uri
    component.addUri(undefined, true);

    fixture.detectChanges();

    // Remove first Uri
    component.removeUri(0);

    fixture.detectChanges();

    expect(component.autofillOptionsForm.value.uris.length).toEqual(1);
  });

  describe("Drag & Drop Functionality", () => {
    beforeEach(() => {
      // Prevent auto‑adding an empty URI by setting a non‑null initial value.
      // This overrides the call to initNewCipher.

      // Now clear any existing URIs (including the auto‑added one)
      component.autofillOptionsForm.controls.uris.clear();

      // Add exactly three URIs that we want to test reordering on.
      component.addUri({ uri: "https://first.com", matchDetection: null });
      component.addUri({ uri: "https://second.com", matchDetection: null });
      component.addUri({ uri: "https://third.com", matchDetection: null });
      fixture.detectChanges();
    });

    it("should reorder URI inputs on drop event", () => {
      // Simulate a drop event that moves the first URI (index 0) to the last position (index 2).
      const dropEvent: CdkDragDrop<HTMLDivElement> = {
        previousIndex: 0,
        currentIndex: 2,
        container: null,
        previousContainer: null,
        isPointerOverContainer: true,
        item: null,
        distance: { x: 0, y: 0 },
      } as any;

      component.onUriItemDrop(dropEvent);
      fixture.detectChanges();

      expect(moveItemInArray).toHaveBeenCalledWith(
        component.autofillOptionsForm.controls.uris.controls,
        0,
        2,
      );
    });

    it("should reorder URI input via keyboard ArrowUp", async () => {
      // Clear and add exactly two URIs.
      component.autofillOptionsForm.controls.uris.clear();
      component.addUri({ uri: "https://first.com", matchDetection: null });
      component.addUri({ uri: "https://second.com", matchDetection: null });
      fixture.detectChanges();

      // Simulate pressing ArrowUp on the second URI (index 1)
      const keyEvent = {
        key: "ArrowUp",
        preventDefault: jest.fn(),
        target: document.createElement("button"),
      } as unknown as KeyboardEvent;

      // Force requestAnimationFrame to run synchronously
      jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
        cb(new Date().getTime());
        return 0;
      });
      (liveAnnouncer.announce as jest.Mock).mockResolvedValue(null);

      await component.onUriItemKeydown(keyEvent, 1);
      fixture.detectChanges();

      expect(moveItemInArray).toHaveBeenCalledWith(
        component.autofillOptionsForm.controls.uris.controls,
        1,
        0,
      );
      expect(liveAnnouncer.announce).toHaveBeenCalledWith(
        "reorderFieldUp websiteUri 1 2",
        "assertive",
      );
    });

    it("should reorder URI input via keyboard ArrowDown", async () => {
      // Clear and add exactly three URIs.
      component.autofillOptionsForm.controls.uris.clear();
      component.addUri({ uri: "https://first.com", matchDetection: null });
      component.addUri({ uri: "https://second.com", matchDetection: null });
      component.addUri({ uri: "https://third.com", matchDetection: null });
      fixture.detectChanges();

      // Simulate pressing ArrowDown on the second URI (index 1)
      const keyEvent = {
        key: "ArrowDown",
        preventDefault: jest.fn(),
        target: document.createElement("button"),
      } as unknown as KeyboardEvent;

      jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
        cb(new Date().getTime());
        return 0;
      });
      (liveAnnouncer.announce as jest.Mock).mockResolvedValue(null);

      await component.onUriItemKeydown(keyEvent, 1);

      expect(moveItemInArray).toHaveBeenCalledWith(
        component.autofillOptionsForm.controls.uris.controls,
        1,
        2,
      );
      expect(liveAnnouncer.announce).toHaveBeenCalledWith(
        "reorderFieldDown websiteUri 3 3",
        "assertive",
      );
    });
  });
});
