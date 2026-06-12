import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

// bit-dialog subscribes to IntersectionObserver, which jsdom does not provide.
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogRef, DIALOG_DATA } from "@bitwarden/components";

import { KillSwitchDialogComponent, KillSwitchDialogResult } from "./kill-switch-dialog.component";

describe("KillSwitchDialogComponent", () => {
  let dialogRef: MockProxy<DialogRef<KillSwitchDialogResult>>;
  let i18nService: MockProxy<I18nService>;

  async function setup(
    organizationName = "Acme Corp",
  ): Promise<ComponentFixture<KillSwitchDialogComponent>> {
    dialogRef = mock<DialogRef<KillSwitchDialogResult>>();
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [KillSwitchDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: { organizationName } },
        { provide: DialogRef, useValue: dialogRef },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(KillSwitchDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function getInput(fixture: ComponentFixture<KillSwitchDialogComponent>): HTMLInputElement {
    return fixture.nativeElement.querySelector("#kill-switch-dialog_input_confirm-org-name");
  }

  function getConfirmButton(
    fixture: ComponentFixture<KillSwitchDialogComponent>,
  ): HTMLButtonElement {
    return fixture.nativeElement.querySelector("#kill-switch-dialog_button_confirm");
  }

  function getCancelButton(
    fixture: ComponentFixture<KillSwitchDialogComponent>,
  ): HTMLButtonElement {
    return fixture.nativeElement.querySelector("#kill-switch-dialog_button_cancel");
  }

  describe("confirm button state", () => {
    // bitButton reflects its disabled state via `aria-disabled`, not the native `disabled` property.
    it("is disabled when the input is empty", async () => {
      const fixture = await setup();
      const button = getConfirmButton(fixture);
      expect(button.getAttribute("aria-disabled")).toBe("true");
    });

    it("is disabled when the typed value does not match the org name (case-sensitive)", async () => {
      const fixture = await setup("Acme Corp");
      const input = getInput(fixture);

      input.value = "acme corp";
      input.dispatchEvent(new Event("input"));
      fixture.detectChanges();
      await fixture.whenStable();

      const button = getConfirmButton(fixture);
      expect(button.getAttribute("aria-disabled")).toBe("true");
    });

    it("is disabled when the typed value is a prefix of the org name", async () => {
      const fixture = await setup("Acme Corp");
      const input = getInput(fixture);

      input.value = "Acme";
      input.dispatchEvent(new Event("input"));
      fixture.detectChanges();
      await fixture.whenStable();

      const button = getConfirmButton(fixture);
      expect(button.getAttribute("aria-disabled")).toBe("true");
    });

    it("is enabled when the typed value exactly matches the org name (case-sensitive)", async () => {
      const fixture = await setup("Acme Corp");
      const input = getInput(fixture);

      input.value = "Acme Corp";
      input.dispatchEvent(new Event("input"));
      fixture.detectChanges();
      await fixture.whenStable();

      const button = getConfirmButton(fixture);
      expect(button.getAttribute("aria-disabled")).not.toBe("true");
    });
  });

  describe("confirm()", () => {
    it("closes with Confirmed result when names match", async () => {
      const fixture = await setup("Acme Corp");
      const input = getInput(fixture);

      input.value = "Acme Corp";
      input.dispatchEvent(new Event("input"));
      fixture.detectChanges();

      getConfirmButton(fixture).click();
      await fixture.whenStable();

      expect(dialogRef.close).toHaveBeenCalledWith(KillSwitchDialogResult.Confirmed);
    });

    it("does not close when names do not match", async () => {
      const fixture = await setup("Acme Corp");
      const input = getInput(fixture);

      input.value = "wrong";
      input.dispatchEvent(new Event("input"));
      fixture.detectChanges();

      fixture.componentInstance["confirm"]();

      expect(dialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe("cancel()", () => {
    it("closes with Canceled result", async () => {
      const fixture = await setup("Acme Corp");

      getCancelButton(fixture).click();
      await fixture.whenStable();

      expect(dialogRef.close).toHaveBeenCalledWith(KillSwitchDialogResult.Canceled);
    });
  });
});
