import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  ValidatorFn,
  AbstractControl,
  ValidationErrors,
} from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  IconButtonModule,
} from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "autotype-shortcut.component.html",
  imports: [
    DialogModule,
    CommonModule,
    JslibModule,
    ButtonModule,
    IconButtonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    FormFieldModule,
  ],
})
export class AutotypeShortcutComponent {
  constructor(
    private dialogRef: DialogRef,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
  ) {}

  private shortcutArray: string[] = [];

  setShortcutForm = this.formBuilder.group({
    shortcut: ["", [Validators.required, this.shortcutCombinationValidator()]],
    requireMasterPasswordOnClientRestart: true,
  });

  submit = async () => {
    const shortcutFormControl = this.setShortcutForm.controls.shortcut;

    if (Utils.isNullOrWhitespace(shortcutFormControl.value) || shortcutFormControl.invalid) {
      return;
    }

    this.dialogRef.close(this.shortcutArray);
  };

  static open(dialogService: DialogService) {
    return dialogService.open<string[]>(AutotypeShortcutComponent);
  }

  onShortcutKeydown(event: KeyboardEvent): void {
    event.preventDefault();

    const shortcut = this.buildShortcutFromEvent(event);

    if (shortcut != null) {
      this.setShortcutForm.controls.shortcut.setValue(shortcut);
      this.setShortcutForm.controls.shortcut.markAsDirty();
      this.setShortcutForm.controls.shortcut.updateValueAndValidity();
    }
  }

  // <https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent>
  private buildShortcutFromEvent(event: KeyboardEvent): string | null {
    const hasCtrl = event.ctrlKey;
    const hasAlt = event.altKey;
    const hasShift = event.shiftKey;
    const hasMeta = event.metaKey; // Windows key on Windows, Command on macOS

    // Require at least one valid modifier (Control, Alt, Meta)
    if (!hasCtrl && !hasAlt && !hasMeta) {
      return null;
    }

    const key = event.key;

    // disallow pure modifier keys themselves
    if (key === "Control" || key === "Alt" || key === "Meta") {
      return null;
    }

    // disallow shift modifier
    if (hasShift) {
      return null;
    }

    // require a single alphabetical letter as the base key
    const isAlphabetical = typeof key === "string" && /^[a-z]$/i.test(key);
    if (!isAlphabetical) {
      return null;
    }

    const parts: string[] = [];
    if (hasCtrl) {
      parts.push("Control");
    }
    if (hasAlt) {
      parts.push("Alt");
    }
    if (hasMeta) {
      parts.push("Meta");
    }
    parts.push(key.toUpperCase());

    this.shortcutArray = parts;

    // return parts.join("+").replace("Super", "Win");
    return parts.join("+");
  }

  private shortcutCombinationValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = (control.value ?? "").toString();
      if (value.length === 0) {
        return null; // handled by required
      }

      // Must include exactly 1-2 modifiers and end with a single letter
      // Valid examples: Ctrl+A, Command+B, Ctrl+Alt+X, Alt+Control+Q
      // Allow modifiers in any order, but only 1-2 modifiers total
      const pattern = /^(?=.*\b(Control|Alt|Meta)\b)(?:Control\+|Alt\+|Meta\+){1,2}[A-Z]$/i;
      return pattern.test(value)
        ? null
        : { invalidShortcut: { message: this.i18nService.t("invalidShortcut") } };
    };
  }
}
