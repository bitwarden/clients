import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { MenuTriggerForDirective } from "../menu";

import { ChipSelectComponent, ChipSelectOption } from "./chip-select.component";

const mockI18nService = {
  t: (key: string, ...args: string[]) => {
    if (key === "removeItem") {
      return `Remove ${args[0]}`;
    }
    if (key === "backTo") {
      return `Back to ${args[0]}`;
    }
    if (key === "viewItemsIn") {
      return `View items in ${args[0]}`;
    }
    return key;
  },
};

describe("ChipSelectComponent", () => {
  let component: ChipSelectComponent<string>;
  let fixture: ComponentFixture<TestAppComponent>;

  const testOptions: ChipSelectOption<string>[] = [
    { label: "Option 1", value: "opt1", icon: "bwi-folder" },
    { label: "Option 2", value: "opt2" },
    {
      label: "Parent Option",
      value: "parent",
      children: [
        { label: "Child 1", value: "child1" },
        { label: "Child 2", value: "child2" },
      ],
    },
  ];

  const getMenuTriggerDirective = () => {
    const buttonDebugElement = fixture.debugElement.query(By.directive(MenuTriggerForDirective));
    return buttonDebugElement?.injector.get(MenuTriggerForDirective);
  };

  const getBitMenuPanel = () => document.querySelector(".bit-menu-panel");

  const getChipButton = () =>
    fixture.debugElement.query(By.css("[data-fvw-target]"))?.nativeElement as HTMLButtonElement;

  const getClearButton = () =>
    fixture.debugElement.query(By.css('button[aria-label^="Remove"]'))
      ?.nativeElement as HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestAppComponent, NoopAnimationsModule],
      providers: [{ provide: I18nService, useValue: mockI18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(TestAppComponent);
    fixture.detectChanges();

    component = fixture.debugElement.query(By.directive(ChipSelectComponent)).componentInstance;

    fixture.detectChanges();
  });

  describe("User-Facing Behavior", () => {
    it("should display placeholder text when no option is selected", () => {
      expect(getChipButton().textContent).toContain("Select an option");
    });

    it("should display placeholder icon when no option is selected", () => {
      const icon = fixture.debugElement.query(By.css('i[aria-hidden="true"]'));
      expect(icon).toBeTruthy();
    });

    it("should disable chip button when disabled", () => {
      const testApp = fixture.componentInstance;
      testApp.disabled.set(true);
      fixture.detectChanges();

      expect(getChipButton().disabled).toBe(true);
    });

    it("should accept fullWidth input", () => {
      const testApp = fixture.componentInstance;
      testApp.fullWidth.set(true);
      fixture.detectChanges();

      expect(component.fullWidth()).toBe(true);
    });

    it("should update available options when they change", () => {
      const newOptions: ChipSelectOption<string>[] = [
        { label: "New Option 1", value: "new1" },
        { label: "New Option 2", value: "new2" },
      ];

      const testApp = fixture.componentInstance;
      testApp.options.set(newOptions);
      fixture.detectChanges();

      getChipButton().click();
      fixture.detectChanges();

      const menuItems = Array.from(document.querySelectorAll<HTMLButtonElement>("[bitMenuItem]"));
      expect(menuItems.some((el) => el.textContent?.includes("New Option 1"))).toBe(true);
      expect(menuItems.some((el) => el.textContent?.includes("New Option 2"))).toBe(true);
    });
  });

  describe("Form Integration Behavior", () => {
    it("should display selected option when form control value is set", () => {
      component.writeValue("opt1");
      fixture.detectChanges();

      const button = getChipButton();
      expect(button.textContent?.trim()).toContain("Option 1");
    });

    it("should find and display nested option when form control value is set", () => {
      component.writeValue("child1");
      fixture.detectChanges();

      const button = getChipButton();
      expect(button.textContent?.trim()).toContain("Child 1");
    });

    it("should clear selection when form control value is set to null", () => {
      component.writeValue("opt1");
      fixture.detectChanges();
      expect(getChipButton().textContent).toContain("Option 1");

      component.writeValue(null as any);
      fixture.detectChanges();
      expect(getChipButton().textContent).toContain("Select an option");
    });

    it("should disable chip when form control is disabled", () => {
      expect(getChipButton().disabled).toBe(false);

      component.setDisabledState(true);
      fixture.detectChanges();

      expect(getChipButton().disabled).toBe(true);
    });

    it("should respect both template and programmatic disabled states", () => {
      const testApp = fixture.componentInstance;
      testApp.disabled.set(true);
      fixture.detectChanges();
      expect(getChipButton().disabled).toBe(true);

      testApp.disabled.set(false);
      component.setDisabledState(true);
      fixture.detectChanges();
      expect(getChipButton().disabled).toBe(true);

      component.setDisabledState(false);
      fixture.detectChanges();
      expect(getChipButton().disabled).toBe(false);
    });

    it("should integrate with Angular reactive forms", () => {
      const formControl = new FormControl<string>("opt1");
      component.registerOnChange((value) => formControl.setValue(value));
      component.writeValue(formControl.value);
      fixture.detectChanges();

      expect(component["selectedOption"]?.value).toBe("opt1");
    });

    it("should update form value when option is selected", () => {
      const onChangeSpy = jest.fn();
      component.registerOnChange(onChangeSpy);

      component.writeValue("opt2");
      component["onChange"]({ label: "Option 2", value: "opt2" });

      expect(onChangeSpy).toHaveBeenCalledWith("opt2");
    });
  });

  describe("Menu Behavior", () => {
    it("should open menu when chip button is clicked", () => {
      const chipButton = getChipButton();
      chipButton.click();
      fixture.detectChanges();

      expect(getBitMenuPanel()).toBeTruthy();
    });

    it("should close menu when backdrop is clicked", () => {
      getChipButton().click();
      fixture.detectChanges();
      expect(getBitMenuPanel()).toBeTruthy();

      const backdrop = document.querySelector(".cdk-overlay-backdrop") as HTMLElement;
      backdrop.click();
      fixture.detectChanges();

      expect(getBitMenuPanel()).toBeFalsy();
    });

    it("should not open menu when disabled", () => {
      const testApp = fixture.componentInstance;
      testApp.disabled.set(true);
      fixture.detectChanges();

      getChipButton().click();
      fixture.detectChanges();

      expect(getBitMenuPanel()).toBeFalsy();
    });

    it("should focus first menu item when menu opens", async () => {
      const trigger = getMenuTriggerDirective();
      trigger.toggleMenu();
      fixture.detectChanges();
      await fixture.whenStable();

      const menu = component.menu();
      expect(menu?.keyManager?.activeItemIndex).toBe(0);
    });

    it("should not focus menu items during initialization (before menu opens)", () => {
      const menu = component.menu();
      expect(menu?.keyManager?.activeItemIndex).toBe(-1);
    });

    it("should calculate and set menu width on open", () => {
      getChipButton().click();
      fixture.detectChanges();

      expect(component["menuWidth"]).toBeGreaterThanOrEqual(0);
    });

    it("should reset menu width when menu closes", () => {
      getChipButton().click();
      fixture.detectChanges();

      component["menuWidth"] = 200;

      getMenuTriggerDirective().toggleMenu();
      fixture.detectChanges();

      expect(component["menuWidth"]).toBeNull();
    });
  });

  describe("Option Selection", () => {
    it("should select option and notify form control", () => {
      const onChangeSpy = jest.fn();
      component.registerOnChange(onChangeSpy);

      const option = testOptions[0];
      component["selectOption"](option, new MouseEvent("click"));

      expect(component["selectedOption"]).toEqual(option);
      expect(onChangeSpy).toHaveBeenCalledWith("opt1");
    });

    it("should display selected option label in chip button", () => {
      component.writeValue("opt1");
      fixture.detectChanges();

      const button = getChipButton();
      expect(button.textContent?.trim()).toContain("Option 1");
    });

    it("should show clear button when option is selected", () => {
      expect(getClearButton()).toBeFalsy();

      component.writeValue("opt1");
      fixture.detectChanges();

      expect(getClearButton()).toBeTruthy();
    });

    it("should clear selection when clear button is clicked", () => {
      const onChangeSpy = jest.fn();
      component.registerOnChange(onChangeSpy);

      component.writeValue("opt1");
      fixture.detectChanges();

      const clearButton = getClearButton();
      clearButton.click();
      fixture.detectChanges();

      expect(component["selectedOption"]).toBeNull();
      expect(onChangeSpy).toHaveBeenCalledWith(null);
    });

    it("should display placeholder when no option is selected", () => {
      expect(component["selectedOption"]).toBeFalsy();
      expect(getChipButton().textContent).toContain("Select an option");
    });

    it("should display option icon when selected", () => {
      component.writeValue("opt1");
      fixture.detectChanges();

      const icon = fixture.debugElement.query(By.css('i[aria-hidden="true"]'));
      expect(icon).toBeTruthy();
    });
  });

  describe("Nested Options Navigation", () => {
    it("should navigate to child options when parent is clicked", () => {
      getChipButton().click();
      fixture.detectChanges();

      const parentMenuItem = Array.from(
        document.querySelectorAll<HTMLButtonElement>("[bitMenuItem]"),
      ).find((el) => el.textContent?.includes("Parent Option"));

      expect(parentMenuItem).toBeTruthy();

      parentMenuItem?.click();
      fixture.detectChanges();

      expect(component["renderedOptions"]?.value).toBe("parent");
    });

    it("should show back navigation when in submenu", async () => {
      component.writeValue("child1");
      component["setOrResetRenderedOptions"]();
      fixture.detectChanges();

      getChipButton().click();
      fixture.detectChanges();
      await fixture.whenStable();

      const backButton = Array.from(
        document.querySelectorAll<HTMLButtonElement>("[bitMenuItem]"),
      ).find((el) => el.textContent?.includes("Back to"));

      expect(backButton).toBeTruthy();
    });

    it("should navigate back to parent menu", async () => {
      component.writeValue("child1");
      component["setOrResetRenderedOptions"]();
      fixture.detectChanges();

      getChipButton().click();
      fixture.detectChanges();
      await fixture.whenStable();

      const backButton = Array.from(
        document.querySelectorAll<HTMLButtonElement>("[bitMenuItem]"),
      ).find((el) => el.textContent?.includes("Back to"));

      expect(backButton).toBeTruthy();

      backButton?.dispatchEvent(new MouseEvent("click"));
      fixture.detectChanges();

      expect(component["renderedOptions"]?.value).toBeNull();
    });

    it("should update rendered options when selected option has children", () => {
      component.writeValue("parent");
      component["setOrResetRenderedOptions"]();

      expect(component["renderedOptions"]?.value).toBe("parent");
    });

    it("should show parent menu if selected option has no children", () => {
      component.writeValue("child1");
      component["setOrResetRenderedOptions"]();

      expect(component["renderedOptions"]?.value).toBe("parent");
    });
  });

  describe("Disabled State Behavior", () => {
    it("should disable clear button when disabled", () => {
      component.writeValue("opt1");
      fixture.detectChanges();

      const testApp = fixture.componentInstance;
      testApp.disabled.set(true);
      fixture.detectChanges();

      const clearButton = getClearButton();
      expect(clearButton.disabled).toBe(true);
    });
  });

  describe("Focus Management", () => {
    it("should track focus-visible-within state", () => {
      const chipButton = getChipButton();

      chipButton.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      fixture.detectChanges();

      expect(component["focusVisibleWithin"]()).toBe(false);
    });

    it("should clear focus-visible-within on focusout", () => {
      component["focusVisibleWithin"].set(true);

      const chipButton = getChipButton();
      chipButton.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      fixture.detectChanges();

      expect(component["focusVisibleWithin"]()).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty options array", () => {
      const testApp = fixture.componentInstance;
      testApp.options.set([]);
      fixture.detectChanges();

      expect(component.options()).toEqual([]);
      expect(component["rootTree"]?.children).toEqual([]);
    });

    it("should handle options without icons", () => {
      const testApp = fixture.componentInstance;
      testApp.options.set([{ label: "No Icon Option", value: "no-icon" }]);
      fixture.detectChanges();

      expect(component.options()).toEqual([{ label: "No Icon Option", value: "no-icon" }]);
    });

    it("should handle disabled options in menu", () => {
      const testApp = fixture.componentInstance;
      testApp.options.set([
        { label: "Enabled Option", value: "enabled" },
        { label: "Disabled Option", value: "disabled", disabled: true },
      ]);
      fixture.detectChanges();

      getChipButton().click();
      fixture.detectChanges();

      const disabledMenuItem = Array.from(
        document.querySelectorAll<HTMLButtonElement>("[bitMenuItem]"),
      ).find((el) => el.textContent?.includes("Disabled Option"));

      expect(disabledMenuItem?.disabled).toBe(true);
    });
  });
});

@Component({
  selector: "test-app",
  template: `
    <bit-chip-select
      placeholderText="Select an option"
      placeholderIcon="bwi-filter"
      [options]="options()"
      [disabled]="disabled()"
      [fullWidth]="fullWidth()"
    />
  `,
  imports: [ChipSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestAppComponent {
  readonly options = signal<ChipSelectOption<string>[]>([
    { label: "Option 1", value: "opt1", icon: "bwi-folder" },
    { label: "Option 2", value: "opt2" },
    {
      label: "Parent Option",
      value: "parent",
      children: [
        { label: "Child 1", value: "child1" },
        { label: "Child 2", value: "child2" },
      ],
    },
  ]);
  readonly disabled = signal(false);
  readonly fullWidth = signal(false);
}
