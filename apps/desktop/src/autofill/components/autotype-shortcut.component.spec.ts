import { AbstractControl, FormBuilder, ValidationErrors } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { AutotypeShortcutComponent } from "./autotype-shortcut.component";

describe("AutotypeShortcutComponent", () => {
  let component: AutotypeShortcutComponent;
  let validator: (control: AbstractControl) => ValidationErrors | null;
  let formBuilder: MockProxy<FormBuilder>;
  let i18nService: MockProxy<I18nService>;

  beforeEach(() => {
    formBuilder = mock<FormBuilder>();
    i18nService = mock<I18nService>();
    i18nService.t.mockReturnValue("Invalid shortcut");
    component = new AutotypeShortcutComponent(null as any, formBuilder, i18nService);
    validator = component["shortcutCombinationValidator"]();
  });

  describe("shortcutCombinationValidator", () => {
    const createControl = (value: string | null): AbstractControl =>
      ({
        value,
      }) as AbstractControl;

    describe("valid shortcuts", () => {
      it("should accept single modifier with letter", () => {
        const validShortcuts = [
          "Control+A",
          "Alt+B",
          "Win+D",
          "control+e", // case insensitive
          "ALT+F",
          "WIN+H",
        ];

        validShortcuts.forEach((shortcut) => {
          const control = createControl(shortcut);
          const result = validator(control);
          expect(result).toBeNull();
        });
      });

      it("should accept two modifiers with letter", () => {
        const validShortcuts = ["Control+Alt+A", "Control+Win+C", "Alt+Win+D", "Alt+Win+E"];

        validShortcuts.forEach((shortcut) => {
          const control = createControl(shortcut);
          const result = validator(control);
          expect(result).toBeNull();
        });
      });

      it("should accept modifiers in different orders", () => {
        const validShortcuts = ["Alt+Control+A", "Win+Control+B", "Win+Alt+C"];

        validShortcuts.forEach((shortcut) => {
          const control = createControl(shortcut);
          const result = validator(control);
          expect(result).toBeNull();
        });
      });
    });

    describe("invalid shortcuts", () => {
      it("should reject shortcuts without modifiers", () => {
        const invalidShortcuts = ["A", "B", "Z", "1", "9"];

        invalidShortcuts.forEach((shortcut) => {
          const control = createControl(shortcut);
          const result = validator(control);
          expect(result).toEqual({ invalidShortcut: { message: "Invalid shortcut" } });
        });
      });

      it("should reject shortcuts with invalid base keys", () => {
        const invalidShortcuts = [
          "Control+1",
          "Alt+2",
          "Win+4",
          "Control+!",
          "Alt+@",
          "Alt+#",
          "Win+$",
          "Control+Space",
          "Alt+Enter",
          "Control+Tab",
          "Win+Escape",
        ];

        invalidShortcuts.forEach((shortcut) => {
          const control = createControl(shortcut);
          const result = validator(control);
          expect(result).toEqual({ invalidShortcut: { message: "Invalid shortcut" } });
        });
      });

      it("should reject shortcuts with only modifiers", () => {
        const invalidShortcuts = [
          "Control",
          "Alt",
          "Win",
          "Control+Alt",
          "Control+Win",
          "Control+Alt+Win",
        ];

        invalidShortcuts.forEach((shortcut) => {
          const control = createControl(shortcut);
          const result = validator(control);
          expect(result).toEqual({ invalidShortcut: { message: "Invalid shortcut" } });
        });
      });

      it("should reject shortcuts with invalid modifier names", () => {
        const invalidShortcuts = ["Ctrl+A", "Command+A", "Super+A", "Meta+A", "Cmd+A", "Invalid+A"];

        invalidShortcuts.forEach((shortcut) => {
          const control = createControl(shortcut);
          const result = validator(control);
          expect(result).toEqual({ invalidShortcut: { message: "Invalid shortcut" } });
        });
      });

      it("should reject shortcuts with multiple base keys", () => {
        const invalidShortcuts = ["Control+A+B", "Alt+Ctrl+Win"];

        invalidShortcuts.forEach((shortcut) => {
          const control = createControl(shortcut);
          const result = validator(control);
          expect(result).toEqual({ invalidShortcut: { message: "Invalid shortcut" } });
        });
      });

      it("should reject shortcuts with more than two modifiers", () => {
        const invalidShortcuts = [
          "Control+Alt+Win+A",
          "Control+Alt+Win+B",
          "Control+Alt+Win+C",
          "Alt+Control+Win+D",
        ];

        invalidShortcuts.forEach((shortcut) => {
          const control = createControl(shortcut);
          const result = validator(control);
          expect(result).toEqual({ invalidShortcut: { message: "Invalid shortcut" } });
        });
      });

      it("should reject shortcuts with extra characters", () => {
        const invalidShortcuts = [
          "Control+A+",
          "+Control+A",
          "Control++A",
          "Control+A+Extra",
          "Control A",
          "Control-A",
          "Control.A",
        ];

        invalidShortcuts.forEach((shortcut) => {
          const control = createControl(shortcut);
          const result = validator(control);
          expect(result).toEqual({ invalidShortcut: { message: "Invalid shortcut" } });
        });
      });

      it("should reject empty or whitespace shortcuts", () => {
        // Empty string is handled by required validator
        const controlEmpty = createControl("");
        expect(validator(controlEmpty)).toBeNull();

        // Whitespace strings are invalid shortcuts
        const whitespaceShortcuts = [" ", "  ", "\t", "\n"];

        whitespaceShortcuts.forEach((shortcut) => {
          const control = createControl(shortcut);
          const result = validator(control);
          expect(result).toEqual({ invalidShortcut: { message: "Invalid shortcut" } });
        });
      });
    });

    describe("edge cases", () => {
      it("should handle null and undefined values", () => {
        const controlNull = createControl(null);
        const controlUndefined = createControl(undefined as any);

        expect(validator(controlNull)).toBeNull();
        expect(validator(controlUndefined)).toBeNull();
      });

      it("should handle non-string values", () => {
        const controlNumber = createControl(123 as any);
        const controlObject = createControl({} as any);
        const controlArray = createControl([] as any);

        expect(validator(controlNumber)).toEqual({
          invalidShortcut: { message: "Invalid shortcut" },
        });
        expect(validator(controlObject)).toEqual({
          invalidShortcut: { message: "Invalid shortcut" },
        });
        // Empty array becomes empty string when converted to string, which is handled by required validator
        expect(validator(controlArray)).toBeNull();
      });

      it("should handle very long strings", () => {
        const longString = "Control+Alt+Win+A".repeat(100);
        const control = createControl(longString);
        const result = validator(control);
        expect(result).toEqual({ invalidShortcut: { message: "Invalid shortcut" } });
      });
    });

    describe("modifier combinations", () => {
      it("should accept all possible single modifier combinations", () => {
        const modifiers = ["Control", "Alt", "Win"];

        modifiers.forEach((modifier) => {
          const control = createControl(`${modifier}+A`);
          const result = validator(control);
          expect(result).toBeNull();
        });
      });

      it("should accept all possible two-modifier combinations", () => {
        const combinations = ["Control+Alt+A", "Control+Win+A", "Alt+Win+A"];

        combinations.forEach((shortcut) => {
          const control = createControl(shortcut);
          const result = validator(control);
          expect(result).toBeNull();
        });
      });

      it("should reject all three-modifier combinations", () => {
        const combinations = ["Control+Alt+Win+A", "Alt+Control+Win+A", "Win+Alt+Control+A"];

        combinations.forEach((shortcut) => {
          const control = createControl(shortcut);
          const result = validator(control);
          expect(result).toEqual({ invalidShortcut: { message: "Invalid shortcut" } });
        });
      });
    });
  });
});
