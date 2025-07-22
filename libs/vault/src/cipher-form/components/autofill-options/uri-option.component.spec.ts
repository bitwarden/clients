import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NG_VALUE_ACCESSOR } from "@angular/forms";
import { of } from "rxjs";

import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogRef, DialogService } from "@bitwarden/components";

import { AdvancedUriOptionDialogComponent } from "./advanced-uri-option-dialog.component";
import { UriOptionComponent } from "./uri-option.component";

describe("UriOptionComponent", () => {
  let component: UriOptionComponent;
  let fixture: ComponentFixture<UriOptionComponent>;
  let dialogServiceMock: jest.Mocked<DialogService>;
  let dialogRefMock: jest.Mocked<DialogRef<boolean>>;

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

    await TestBed.configureTestingModule({
      imports: [UriOptionComponent],
      providers: [
        { provide: DialogService, useValue: dialogServiceMock },
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

    expect(component["uriMatchOptions"][0].label).toBe("defaultLabel baseDomain");
  });

  it("should update the default uri match strategy label", () => {
    component.defaultMatchDetection = UriMatchStrategy.Exact;
    fixture.detectChanges();

    expect(component["uriMatchOptions"][0].label).toBe("defaultLabel exact");

    component.defaultMatchDetection = UriMatchStrategy.StartsWith;
    fixture.detectChanges();

    expect(component["uriMatchOptions"][0].label).toBe("defaultLabel startsWith");
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

    it("should update the match detection button title when the toggle is clicked", () => {
      component.writeValue({ uri: "https://example.com", matchDetection: UriMatchStrategy.Exact });
      fixture.detectChanges();
      expect(getToggleMatchDetectionBtn().title).toBe("showMatchDetection https://example.com");
      getToggleMatchDetectionBtn().click();
      fixture.detectChanges();
      expect(getToggleMatchDetectionBtn().title).toBe("hideMatchDetection https://example.com");
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
  });
});
