import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NG_VALUE_ACCESSOR } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import {
  AUTOTYPE_PAIRING_DATA_SCHEMA_VERSION,
  AutotypePairingPackagingType,
} from "@bitwarden/common/desktop-native/models/autotype-pairing-data";
import {
  DESKTOP_APP_URI_PREFIX,
  DesktopAutotypePairingUri,
} from "@bitwarden/common/desktop-native/models/desktop-autotype-pairing-uri";
import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogRef, DialogService } from "@bitwarden/components";

import { CipherFormHTTPAuthenticationService } from "../../services/cipher-form-http-authentication.service";

import { AdvancedUriOptionDialogComponent } from "./advanced-uri-option-dialog.component";
import { DesktopAppRow, UriOptionComponent } from "./uri-option.component";

function createPairingUri(name: string): string {
  return new DesktopAutotypePairingUri(DesktopAutotypePairingUri.CurrentVersion, {
    metadata: {
      schemaVersion: { ...AUTOTYPE_PAIRING_DATA_SCHEMA_VERSION },
      pairingTimestamp: 1793577600,
    },
    appData: { name, normalizedPath: `C:\\Program Files\\${name}\\${name}.exe` },
    clientData: { packagingType: AutotypePairingPackagingType.WindowsExe },
  }).toString();
}

describe("UriOptionComponent", () => {
  let component: UriOptionComponent;
  let fixture: ComponentFixture<UriOptionComponent>;
  let dialogServiceMock: jest.Mocked<DialogService>;
  let dialogRefMock: jest.Mocked<DialogRef<boolean>>;
  let httpAuthenticationService: MockProxy<CipherFormHTTPAuthenticationService>;

  const getToggleMatchDetectionBtn = () =>
    fixture.nativeElement.querySelector(
      "button[data-testid='toggle-match-detection-button']",
    ) as HTMLButtonElement;

  const getMatchDetectionSelect = () =>
    fixture.nativeElement.querySelector(
      "bit-select[formControlName='matchDetection']",
    ) as HTMLSelectElement;

  const getRemoveButton = () =>
    fixture.nativeElement.querySelector(
      "button[data-testid='remove-uri-button']",
    ) as HTMLButtonElement;

  beforeEach(async () => {
    dialogServiceMock = {
      open: jest.fn().mockReturnValue(dialogRefMock),
    } as unknown as jest.Mocked<DialogService>;

    dialogRefMock = {
      close: jest.fn(),
      afterClosed: jest.fn().mockReturnValue(of(true)),
    } as unknown as jest.Mocked<DialogRef<boolean>>;

    httpAuthenticationService = mock<CipherFormHTTPAuthenticationService>();
    httpAuthenticationService.confirmDefaultMatchStrategy.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [UriOptionComponent],
      providers: [
        { provide: DialogService, useValue: dialogServiceMock },
        { provide: CipherFormHTTPAuthenticationService, useValue: httpAuthenticationService },
        {
          provide: I18nService,
          useValue: { t: (...keys: string[]) => keys.filter(Boolean).join(" ") },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UriOptionComponent);
    component = fixture.componentInstance;

    // Ensure the component provides the NG_VALUE_ACCESSOR token
    fixture.debugElement.injector.get(NG_VALUE_ACCESSOR);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should not update the default uri match strategy label when it is null", () => {
    component.defaultMatchDetection = null;
    fixture.detectChanges();

    expect(component["uriMatchOptions"][0].label).toBe("default");
  });

  it("should update the default uri match strategy label when it is domain", () => {
    component.defaultMatchDetection = UriMatchStrategy.Domain;
    fixture.detectChanges();

    expect(component["uriMatchOptions"][0].label).toBe("defaultLabelWithValue baseDomain");
  });

  it("should update the default uri match strategy label", () => {
    component.defaultMatchDetection = UriMatchStrategy.Exact;
    fixture.detectChanges();

    expect(component["uriMatchOptions"][0].label).toBe("defaultLabelWithValue exact");

    component.defaultMatchDetection = UriMatchStrategy.StartsWith;
    fixture.detectChanges();

    expect(component["uriMatchOptions"][0].label).toBe("defaultLabelWithValue startsWith");
  });

  it("should focus the uri input when focusInput is called", () => {
    fixture.detectChanges();
    jest.spyOn(component["inputElement"].nativeElement, "focus");
    component.focusInput();
    expect(component["inputElement"].nativeElement.focus).toHaveBeenCalled();
  });

  it("should emit change and touch events when the control value changes", () => {
    const changeFn = jest.fn();
    const touchFn = jest.fn();
    component.registerOnChange(changeFn);
    component.registerOnTouched(touchFn);
    fixture.detectChanges();

    expect(changeFn).not.toHaveBeenCalled();
    expect(touchFn).not.toHaveBeenCalled();

    component["uriForm"].patchValue({ uri: "https://example.com" });

    expect(changeFn).toHaveBeenCalled();
    expect(touchFn).toHaveBeenCalled();
  });

  it("should disable the uri form when disabled state is set", () => {
    fixture.detectChanges();

    expect(component["uriForm"].enabled).toBe(true);

    component.setDisabledState(true);

    expect(component["uriForm"].enabled).toBe(false);
  });

  it("should update form when `writeValue` is invoked", () => {
    expect(component["uriForm"].value).toEqual({ uri: null, matchDetection: null });

    component.writeValue({ uri: "example.com", matchDetection: UriMatchStrategy.Exact });

    expect(component["uriForm"].value).toEqual({
      uri: "example.com",
      matchDetection: UriMatchStrategy.Exact,
    });
  });

  describe("match detection", () => {
    it("should hide the match detection select by default", () => {
      fixture.detectChanges();
      expect(getMatchDetectionSelect()).toBeNull();
    });

    it("should show the match detection select when the toggle is clicked", () => {
      fixture.detectChanges();
      getToggleMatchDetectionBtn().click();
      fixture.detectChanges();
      expect(getMatchDetectionSelect()).not.toBeNull();
    });

    it("should update the match detection button aria-label when the toggle is clicked", () => {
      component.writeValue({ uri: "https://example.com", matchDetection: UriMatchStrategy.Exact });
      fixture.detectChanges();
      expect(getToggleMatchDetectionBtn().getAttribute("aria-label")).toBe(
        "showMatchDetectionNoPlaceholder",
      );
      getToggleMatchDetectionBtn().click();
      fixture.detectChanges();
      expect(getToggleMatchDetectionBtn().getAttribute("aria-label")).toBe(
        "hideMatchDetectionNoPlaceholder",
      );
    });
  });

  describe("remove button", () => {
    it("should show the remove button when canRemove is true", () => {
      component.canRemove = true;
      fixture.detectChanges();
      expect(getRemoveButton()).toBeTruthy();
    });

    it("should hide the remove button when canRemove is false", () => {
      component.canRemove = false;
      fixture.detectChanges();
      expect(getRemoveButton()).toBeFalsy();
    });

    it("should emit remove when the remove button is clicked", () => {
      jest.spyOn(component.remove, "emit");
      component.canRemove = true;
      fixture.detectChanges();
      getRemoveButton().click();
      expect(component.remove.emit).toHaveBeenCalled();
    });
  });

  // Autotype App Tests
  describe("uriLabel", () => {
    it("returns 'websiteUri' for a normal URL at index 0", () => {
      component.writeValue({ uri: "https://example.com", matchDetection: null });
      component.index = 0;

      expect(component["uriLabel"]).toBe("websiteUri");
    });

    it("returns 'websiteUriCount' for a normal URL at index greater than 0", () => {
      component.writeValue({ uri: "https://example.com", matchDetection: null });
      component.index = 1;

      expect(component["uriLabel"]).toBe("websiteUriCount 2");
    });

    it("returns 'websiteUri' for a desktop app row at index 0 when recognizeDesktopApps is false", () => {
      fixture.componentRef.setInput("desktopAppRow", DesktopAppRow.Saved);
      component.writeValue({ uri: DESKTOP_APP_URI_PREFIX, matchDetection: null });
      component.index = 0;
      fixture.componentRef.setInput("recognizeDesktopApps", false);

      expect(component["uriLabel"]).toBe("websiteUri");
    });

    it("returns 'websiteUriCount' for a desktop app row at index greater than 0 when recognizeDesktopApps is false", () => {
      fixture.componentRef.setInput("desktopAppRow", DesktopAppRow.Saved);
      component.writeValue({ uri: DESKTOP_APP_URI_PREFIX, matchDetection: null });
      component.index = 1;
      fixture.componentRef.setInput("recognizeDesktopApps", false);

      expect(component["uriLabel"]).toBe("websiteUriCount 2");
    });

    it("returns 'desktopApp' for a desktop app row at index 0 when recognizeDesktopApps is true", () => {
      fixture.componentRef.setInput("desktopAppRow", DesktopAppRow.Saved);
      component.writeValue({ uri: DESKTOP_APP_URI_PREFIX, matchDetection: null });
      component.index = 0;
      fixture.componentRef.setInput("recognizeDesktopApps", true);

      expect(component["uriLabel"]).toBe("desktopApp");
    });

    it("returns 'desktopAppCount' for a desktop app row at index greater than 0 when recognizeDesktopApps is true", () => {
      fixture.componentRef.setInput("desktopAppRow", DesktopAppRow.Saved);
      component.writeValue({ uri: DESKTOP_APP_URI_PREFIX, matchDetection: null });
      component.index = 1;
      fixture.componentRef.setInput("recognizeDesktopApps", true);

      expect(component["uriLabel"]).toBe("desktopAppCount 2");
    });

    it("returns 'websiteUri' for a desktopapp:// URI in a website row when recognizeDesktopApps is true", () => {
      component.writeValue({ uri: DESKTOP_APP_URI_PREFIX, matchDetection: null });
      component.index = 0;
      fixture.componentRef.setInput("recognizeDesktopApps", true);

      expect(component["uriLabel"]).toBe("websiteUri");
    });
  });

  describe("isAppUri", () => {
    it.each([DesktopAppRow.Saved, DesktopAppRow.New])(
      "returns true for a %p desktop app row with a desktopapp:// URI when recognizeDesktopApps is true",
      (desktopAppRow) => {
        fixture.componentRef.setInput("desktopAppRow", desktopAppRow);
        component.writeValue({ uri: DESKTOP_APP_URI_PREFIX, matchDetection: null });
        fixture.componentRef.setInput("recognizeDesktopApps", true);

        expect(component["isAppUri"]).toBe(true);
      },
    );

    it("returns false for a desktop app row when recognizeDesktopApps is false", () => {
      fixture.componentRef.setInput("desktopAppRow", DesktopAppRow.Saved);
      component.writeValue({ uri: DESKTOP_APP_URI_PREFIX, matchDetection: null });
      fixture.componentRef.setInput("recognizeDesktopApps", false);

      expect(component["isAppUri"]).toBe(false);
    });

    it("returns false for a desktopapp:// URI in a website row when recognizeDesktopApps is true", () => {
      component.writeValue({ uri: DESKTOP_APP_URI_PREFIX, matchDetection: null });
      fixture.componentRef.setInput("recognizeDesktopApps", true);

      expect(component["isAppUri"]).toBe(false);
    });

    it.each(["https://example.com", ""])(
      "returns false for a desktop app row with the non desktop app URI %p when recognizeDesktopApps is true",
      (uri) => {
        fixture.componentRef.setInput("desktopAppRow", DesktopAppRow.Saved);
        component.writeValue({ uri, matchDetection: null });
        fixture.componentRef.setInput("recognizeDesktopApps", true);

        expect(component["isAppUri"]).toBe(false);
      },
    );
  });

  describe("desktop app URIs", () => {
    const invalidPairingUri = "desktopapp://autotype?version=1.0.0&data=invalid";

    const getUriInput = () =>
      fixture.nativeElement.querySelector("input[formControlName='uri']") as HTMLInputElement;

    const getDesktopAppSelect = () =>
      fixture.nativeElement.querySelector(
        "bit-select[data-testid='desktop-app-select']",
      ) as HTMLElement;

    function renderUri(
      uri: string,
      recognizeDesktopApps: boolean,
      desktopAppRow: DesktopAppRow | null = DesktopAppRow.Saved,
    ) {
      fixture.componentRef.setInput("recognizeDesktopApps", recognizeDesktopApps);
      fixture.componentRef.setInput("desktopAppRow", desktopAppRow);
      component.writeValue({ uri, matchDetection: null });
      fixture.detectChanges();
    }

    it("renders a desktop app dropdown instead of a text input for a desktop app row", () => {
      renderUri(createPairingUri("Notepad"), true);

      expect(getDesktopAppSelect()).toBeTruthy();
      expect(getUriInput()).toBeFalsy();
    });

    it("renders a text input for a website URI", () => {
      renderUri("https://example.com", true, null);

      expect(getUriInput()).toBeTruthy();
      expect(getDesktopAppSelect()).toBeFalsy();
    });

    it("renders a text input for a desktop app row when recognizeDesktopApps is false", () => {
      renderUri(createPairingUri("Notepad"), false);

      expect(getUriInput()).toBeTruthy();
      expect(getDesktopAppSelect()).toBeFalsy();
    });

    it("renders a text input for a desktop app URI in a website row", () => {
      renderUri(createPairingUri("Notepad"), true, null);

      expect(getUriInput()).toBeTruthy();
      expect(getDesktopAppSelect()).toBeFalsy();
    });

    it("keeps the website row when a desktop app URI is typed into it", () => {
      component.index = 0;
      renderUri("", true, null);
      const uriInput = getUriInput();

      uriInput.value = DESKTOP_APP_URI_PREFIX;
      uriInput.dispatchEvent(new Event("input"));
      fixture.detectChanges();

      expect(component["uriForm"].value.uri).toBe(DESKTOP_APP_URI_PREFIX);
      expect(getUriInput()).toBe(uriInput);
      expect(getDesktopAppSelect()).toBeFalsy();
      expect(getToggleMatchDetectionBtn()).toBeTruthy();
      expect(component["uriLabel"]).toBe("websiteUri");
    });

    it("selects the saved desktop app in the dropdown, shown by its name", () => {
      fixture.autoDetectChanges();
      renderUri(createPairingUri("Notepad"), true);
      // bit-select reads its options in an after render effect, which needs an application tick
      TestBed.tick();

      expect(component["appSelect"]().selectedOption()?.label).toBe("Notepad");
    });

    it("selects an invalid pairing in the dropdown for a saved URI that isn't a valid pairing URI", () => {
      fixture.autoDetectChanges();
      renderUri(invalidPairingUri, true);
      // bit-select reads its options in an after render effect, which needs an application tick
      TestBed.tick();

      expect(component["appSelect"]().selectedOption()?.label).toBe("invalidAppPairing");
    });

    it("hides the match detection toggle for a desktop app row", () => {
      renderUri(DESKTOP_APP_URI_PREFIX, true, DesktopAppRow.New);

      expect(getToggleMatchDetectionBtn()).toBeFalsy();
    });

    it("shows the match detection toggle for a website URI", () => {
      renderUri("https://example.com", true, null);

      expect(getToggleMatchDetectionBtn()).toBeTruthy();
    });

    it("hides open match detection options when a desktop app row is shown as a desktop app", () => {
      renderUri(DESKTOP_APP_URI_PREFIX, false);
      getToggleMatchDetectionBtn().click();
      fixture.detectChanges();
      expect(getMatchDetectionSelect()).toBeTruthy();

      fixture.componentRef.setInput("recognizeDesktopApps", true);
      fixture.detectChanges();

      expect(getMatchDetectionSelect()).toBeFalsy();
    });

    it("shows the remove button for a desktop app row when canRemove is true", () => {
      component.canRemove = true;

      renderUri(DESKTOP_APP_URI_PREFIX, true, DesktopAppRow.New);

      expect(getRemoveButton()).toBeTruthy();
    });

    it("focuses the desktop app dropdown when focusing a desktop app row", () => {
      renderUri(DESKTOP_APP_URI_PREFIX, true, DesktopAppRow.New);
      const focusSpy = jest.spyOn(component["appSelect"]().select(), "focus");

      component.focusInput();

      expect(focusSpy).toHaveBeenCalled();
    });

    it("adds the app of a saved pairing URI to the options, labeled with the app name", () => {
      const pairingUri = createPairingUri("Notepad");
      fixture.componentRef.setInput("desktopAppRow", DesktopAppRow.Saved);

      component.writeValue({ uri: pairingUri, matchDetection: null });

      expect(component["appOptions"]()).toEqual([{ label: "Notepad", value: pairingUri }]);
    });

    it("adds the saved app to the options only once when the same URI is written again", () => {
      const pairingUri = createPairingUri("Notepad");
      fixture.componentRef.setInput("desktopAppRow", DesktopAppRow.Saved);

      component.writeValue({ uri: pairingUri, matchDetection: null });
      component.writeValue({ uri: pairingUri, matchDetection: null });

      expect(component["appOptions"]()).toHaveLength(1);
    });

    it.each([invalidPairingUri, DESKTOP_APP_URI_PREFIX])(
      "adds an invalid pairing to the options for the saved URI %p, which isn't a valid pairing URI",
      (uri) => {
        fixture.componentRef.setInput("desktopAppRow", DesktopAppRow.Saved);

        component.writeValue({ uri, matchDetection: null });

        expect(component["appOptions"]()).toEqual([{ label: "invalidAppPairing", value: uri }]);
      },
    );

    it("does not add an option for a new desktop app row", () => {
      fixture.componentRef.setInput("desktopAppRow", DesktopAppRow.New);

      component.writeValue({ uri: DESKTOP_APP_URI_PREFIX, matchDetection: null });

      expect(component["appOptions"]()).toEqual([]);
    });

    it.each([DESKTOP_APP_URI_PREFIX, invalidPairingUri, "https://example.com", ""])(
      "does not add an option for the URI %p in a website row",
      (uri) => {
        component.writeValue({ uri, matchDetection: null });

        expect(component["appOptions"]()).toEqual([]);
      },
    );

    it("does not add an option for a pairing URI in a website row", () => {
      component.writeValue({ uri: createPairingUri("Notepad"), matchDetection: null });

      expect(component["appOptions"]()).toEqual([]);
    });
  });

  describe("locked desktop app URIs", () => {
    const pairingUri = createPairingUri("Notepad");
    const invalidPairingUri = "desktopapp://autotype?version=1.0.0&data=invalid";

    const getUriControl = () => component["uriForm"].controls.uri;

    function renderUri(
      uri: string,
      {
        desktopAppRow = DesktopAppRow.Saved,
        recognizeDesktopApps = true,
      }: { desktopAppRow?: DesktopAppRow | null; recognizeDesktopApps?: boolean } = {},
    ) {
      fixture.componentRef.setInput("recognizeDesktopApps", recognizeDesktopApps);
      fixture.componentRef.setInput("desktopAppRow", desktopAppRow);
      component.writeValue({ uri, matchDetection: UriMatchStrategy.Never });
      fixture.detectChanges();
    }

    it("disables the dropdown of a desktop app saved on the cipher", () => {
      renderUri(pairingUri);

      expect(getUriControl().disabled).toBe(true);
      expect(component["appSelect"]().disabled()).toBe(true);
    });

    it("disables the dropdown of an invalid pairing saved on the cipher", () => {
      renderUri(invalidPairingUri);

      expect(getUriControl().disabled).toBe(true);
      expect(component["appSelect"]().disabled()).toBe(true);
    });

    it("keeps the remove button of a locked desktop app", () => {
      component.canRemove = true;

      renderUri(pairingUri);

      expect(getRemoveButton()).toBeTruthy();
    });

    it("does not disable a desktop app added by the user", () => {
      renderUri(pairingUri, { desktopAppRow: DesktopAppRow.New });

      expect(getUriControl().enabled).toBe(true);
    });

    it("does not disable a desktop app URI typed into a website row", () => {
      renderUri(pairingUri, { desktopAppRow: null });

      expect(getUriControl().enabled).toBe(true);
    });

    it("does not disable a saved desktop app when recognizeDesktopApps is false", () => {
      renderUri(pairingUri, { recognizeDesktopApps: false });

      expect(getUriControl().enabled).toBe(true);
    });

    it("locks a saved desktop app when desktop apps are recognized after it loads", () => {
      renderUri(pairingUri, { recognizeDesktopApps: false });

      fixture.componentRef.setInput("recognizeDesktopApps", true);
      fixture.detectChanges();

      expect(getUriControl().disabled).toBe(true);
    });

    it("keeps a locked desktop app disabled when the row is enabled", () => {
      renderUri(pairingUri);

      component.setDisabledState(true);
      component.setDisabledState(false);

      expect(getUriControl().disabled).toBe(true);
      expect(component["uriForm"].controls.matchDetection.enabled).toBe(true);
    });

    it("keeps a disabled row disabled when desktop apps are recognized", () => {
      renderUri(pairingUri, { desktopAppRow: DesktopAppRow.New, recognizeDesktopApps: false });
      component.setDisabledState(true);

      fixture.componentRef.setInput("recognizeDesktopApps", true);
      fixture.detectChanges();

      expect(getUriControl().disabled).toBe(true);
    });

    it("includes the URI of a locked desktop app when the row's value changes", () => {
      const onChange = jest.fn();
      component.registerOnChange(onChange);
      renderUri(pairingUri);

      component["uriForm"].controls.matchDetection.setValue(UriMatchStrategy.Exact);

      expect(onChange).toHaveBeenLastCalledWith({
        uri: pairingUri,
        matchDetection: UriMatchStrategy.Exact,
      });
    });
  });

  describe("advanced match strategy dialog", () => {
    function testDialogAction(action: "onContinue" | "onCancel", expected: number) {
      const openSpy = jest
        .spyOn(AdvancedUriOptionDialogComponent, "open")
        .mockReturnValue(dialogRefMock);

      component["uriForm"].controls.matchDetection.setValue(UriMatchStrategy.Domain);
      component["uriForm"].controls.matchDetection.setValue(UriMatchStrategy.StartsWith);

      const [, params] = openSpy.mock.calls[0] as [
        DialogService,
        {
          contentKey: string;
          onContinue: () => void;
          onCancel: () => void;
        },
      ];

      params[action]();

      expect(component["uriForm"].value.matchDetection).toBe(expected);
    }

    it("should apply the advanced match strategy when the user continues", () => {
      testDialogAction("onContinue", UriMatchStrategy.StartsWith);
    });

    it("should revert to the previous strategy when the user cancels", () => {
      testDialogAction("onCancel", UriMatchStrategy.Domain);
    });

    it("should warn when the first change after `writeValue` is to an advanced strategy", () => {
      const openSpy = jest
        .spyOn(AdvancedUriOptionDialogComponent, "open")
        .mockReturnValue(dialogRefMock);
      component.writeValue({ uri: "https://example.com", matchDetection: UriMatchStrategy.Exact });

      component["uriForm"].controls.matchDetection.setValue(UriMatchStrategy.StartsWith);

      expect(openSpy).toHaveBeenCalledTimes(1);
    });

    it("should notify the parent form of the restored strategy when the user cancels", () => {
      const onChange = jest.fn();
      component.registerOnChange(onChange);
      const openSpy = jest
        .spyOn(AdvancedUriOptionDialogComponent, "open")
        .mockReturnValue(dialogRefMock);
      component.writeValue({ uri: "https://example.com", matchDetection: UriMatchStrategy.Exact });

      component["uriForm"].controls.matchDetection.setValue(UriMatchStrategy.StartsWith);
      const [, params] = openSpy.mock.calls[0] as [DialogService, { onCancel: () => void }];
      params.onCancel();

      expect(component["uriForm"].controls.matchDetection.value).toBe(UriMatchStrategy.Exact);
      expect(onChange).toHaveBeenLastCalledWith({
        uri: "https://example.com",
        matchDetection: UriMatchStrategy.Exact,
      });
    });
  });

  describe("default match strategy confirmation", () => {
    let onChange: jest.Mock;

    beforeEach(() => {
      onChange = jest.fn();
      component.registerOnChange(onChange);
      component.writeValue({ uri: "https://example.com", matchDetection: UriMatchStrategy.Host });
    });

    it("asks to confirm when the strategy changes to the default", () => {
      component["uriForm"].controls.matchDetection.setValue(null);

      expect(httpAuthenticationService.confirmDefaultMatchStrategy).toHaveBeenCalledTimes(1);
    });

    it("does not ask to confirm when the strategy changes between explicit strategies", () => {
      component["uriForm"].controls.matchDetection.setValue(UriMatchStrategy.Exact);

      expect(httpAuthenticationService.confirmDefaultMatchStrategy).not.toHaveBeenCalled();
    });

    it("keeps the default strategy when the user confirms", async () => {
      component["uriForm"].controls.matchDetection.setValue(null);
      await fixture.whenStable();

      expect(component["uriForm"].controls.matchDetection.value).toBeNull();
    });

    it("restores the previous strategy when the user declines", async () => {
      httpAuthenticationService.confirmDefaultMatchStrategy.mockResolvedValue(false);

      component["uriForm"].controls.matchDetection.setValue(null);
      await fixture.whenStable();

      expect(component["uriForm"].controls.matchDetection.value).toBe(UriMatchStrategy.Host);
      expect(onChange).toHaveBeenLastCalledWith({
        uri: "https://example.com",
        matchDetection: UriMatchStrategy.Host,
      });
    });

    it("restores the original strategy when the user declines the default and then cancels an advanced strategy", async () => {
      httpAuthenticationService.confirmDefaultMatchStrategy.mockResolvedValue(false);
      const openSpy = jest
        .spyOn(AdvancedUriOptionDialogComponent, "open")
        .mockReturnValue(dialogRefMock);

      component["uriForm"].controls.matchDetection.setValue(null);
      // Let the declined confirmation settle before the next selection, as a separate user event would
      await new Promise((resolve) => setTimeout(resolve, 0));

      component["uriForm"].controls.matchDetection.setValue(UriMatchStrategy.StartsWith);
      const [, params] = openSpy.mock.calls[0] as [DialogService, { onCancel: () => void }];
      params.onCancel();
      await fixture.whenStable();

      expect(component["uriForm"].controls.matchDetection.value).toBe(UriMatchStrategy.Host);
      expect(httpAuthenticationService.confirmDefaultMatchStrategy).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith({
        uri: "https://example.com",
        matchDetection: UriMatchStrategy.Host,
      });
    });
  });
});
