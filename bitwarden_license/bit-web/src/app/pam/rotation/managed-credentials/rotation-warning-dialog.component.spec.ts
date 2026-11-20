import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef, I18nMockService } from "@bitwarden/components";

import {
  RotationWarningDialogComponent,
  RotationWarningDialogParams,
} from "./rotation-warning-dialog.component";

describe("RotationWarningDialogComponent", () => {
  let fixture: ComponentFixture<RotationWarningDialogComponent>;
  const close = jest.fn();

  const params: RotationWarningDialogParams = {
    titleKey: "pamRotationConfigRotateNow",
    contentKey: "pamRotationConfigRotateNowConfirmContent",
    acceptButtonKey: "pamRotationConfigRotateNow",
  };

  function button(name: "accept" | "cancel"): HTMLButtonElement {
    return fixture.nativeElement.querySelector(
      `[data-testid="rotation-warning-dialog_button_${name}"]`,
    );
  }

  beforeEach(async () => {
    close.mockReset();
    await TestBed.configureTestingModule({
      imports: [RotationWarningDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: { close } },
        {
          provide: I18nService,
          useValue: new I18nMockService({
            pamRotationConfigRotateNow: "Rotate now",
            pamRotationConfigRotateNowConfirmContent:
              "Rotating this credential will also sign out anyone still using the current password.",
            cancel: "Cancel",
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RotationWarningDialogComponent);
    fixture.detectChanges();
  });

  it("shows the title, the body text, and the action's own button label", () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain("Rotate now");
    expect(text).toContain(
      "Rotating this credential will also sign out anyone still using the current password.",
    );
    expect(button("accept").textContent.trim()).toBe("Rotate now");
    expect(button("cancel").textContent.trim()).toBe("Cancel");
  });

  it("uses the warning icon in the fg-warning color", () => {
    const icon = fixture.nativeElement.querySelector("bit-icon[bitDialogIcon]");
    expect(icon.getAttribute("name")).toBe("bwi-exclamation-triangle");
    expect(icon.classList).toContain("tw-text-fg-warning");
  });

  it("styles the confirm button as a warning, not the primary blue", () => {
    expect(button("accept").getAttribute("buttontype")).toBe("warning");
  });

  it("closes with true when confirmed", () => {
    button("accept").click();
    expect(close).toHaveBeenCalledWith(true);
  });

  it("does not confirm when canceled", () => {
    button("cancel").click();
    expect(close).not.toHaveBeenCalledWith(true);
  });
});
