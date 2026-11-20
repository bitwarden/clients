import { CommonModule } from "@angular/common";
import { Component, effect, inject, input, output, untracked } from "@angular/core";
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  ValidatorFn,
  AbstractControl,
  ValidationErrors,
} from "@angular/forms";

import {
  autotypeGaShortcutFromText,
  isAutotypeGaShortcut,
} from "@bitwarden/common/desktop-native/models/autotype-ga-policy.data";
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
import { I18nPipe } from "@bitwarden/ui-common";

// Electron's "Super" is the Windows key on Windows and the Command key on macOS.
const DISPLAY_KEY_NAMES: Record<string, string> = {
  Control: "Ctrl",
  Super: "Win",
};

/** Formats stored keys for display, e.g. ["Control", "Alt", "L"] as "Ctrl + Alt + L". */
export function formatAutotypeShortcut(keys: readonly string[]): string {
  return keys.map((key) => DISPLAY_KEY_NAMES[key] ?? key).join(" + ");
}

function shortcutLetter(event: KeyboardEvent): string | null {
  return /^[a-z]$/i.test(event.key) ? event.key.toUpperCase() : null;
}

/** One or two of Ctrl, Alt, or Win, plus a letter. The command key is stored as Super. */
export function captureAutotypeShortcut(event: KeyboardEvent): string[] | null {
  const hasCtrl = event.ctrlKey;
  const hasAlt = event.altKey;
  const hasShift = event.shiftKey;
  const hasSuper = event.metaKey;

  if (!hasCtrl && !hasAlt && !hasSuper) {
    return null;
  }

  if (hasShift) {
    return null;
  }

  const letter = shortcutLetter(event);
  if (letter == null) {
    return null;
  }

  const keys: string[] = [];
  if (hasCtrl) {
    keys.push("Control");
  }
  if (hasAlt) {
    keys.push("Alt");
  }
  if (hasSuper) {
    keys.push("Super");
  }
  keys.push(letter);

  return isAutotypeGaShortcut(keys) ? keys : null;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-autotype-shortcut",
  templateUrl: "autotype-shortcut.component.html",
  imports: [
    DialogModule,
    CommonModule,
    I18nPipe,
    ButtonModule,
    IconButtonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    FormFieldModule,
  ],
})
export class AutotypeShortcutComponent {
  readonly inline = input(false);
  readonly shortcut = input<string[] | null>(null);
  readonly shortcutChange = output<string[] | null>();

  private readonly dialogRef = inject<DialogRef<string[]>>(DialogRef, { optional: true });
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18nService = inject(I18nService);

  private shortcutArray: string[] = [];

  setShortcutForm = this.formBuilder.group({
    shortcut: ["", [Validators.required, this.shortcutCombinationValidator()]],
  });

  constructor() {
    effect(() => {
      const shortcut = this.shortcut();
      const keys = isAutotypeGaShortcut(shortcut) ? shortcut : [];
      untracked(() => {
        this.shortcutArray = keys;
        this.setShortcutForm.controls.shortcut.setValue(
          keys.length > 0 ? formatAutotypeShortcut(keys) : "",
        );
      });
    });
  }

  submit = async () => {
    const shortcutFormControl = this.setShortcutForm.controls.shortcut;

    if (Utils.isNullOrWhitespace(shortcutFormControl.value) || shortcutFormControl.invalid) {
      return;
    }

    await this.dialogRef?.close(this.shortcutArray);
  };

  static open(dialogService: DialogService) {
    return dialogService.open<string[]>(AutotypeShortcutComponent);
  }

  onShortcutKeydown(event: KeyboardEvent): void {
    if (this.inline() && (event.key === "Tab" || event.key === "Escape")) {
      return;
    }

    event.preventDefault();

    if (this.inline() && event.key === "Backspace") {
      if (this.shortcutArray.length === 0) {
        return;
      }

      this.shortcutArray = [];
      this.setShortcutForm.controls.shortcut.setValue("");
      this.setShortcutForm.controls.shortcut.markAsDirty();
      this.setShortcutForm.controls.shortcut.updateValueAndValidity();
      this.shortcutChange.emit(null);
      return;
    }

    const keys = captureAutotypeShortcut(event);

    if (keys != null) {
      this.shortcutArray = keys;
      this.setShortcutForm.controls.shortcut.setValue(formatAutotypeShortcut(keys));
      this.setShortcutForm.controls.shortcut.markAsDirty();
      this.setShortcutForm.controls.shortcut.updateValueAndValidity();
      this.shortcutChange.emit(keys);
    }
  }

  /** Only keyboard capture may set the shortcut, so pasted or dropped text is ignored. */
  onShortcutTextInsert(event: Event): void {
    event.preventDefault();
  }

  private shortcutCombinationValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = (control.value ?? "").toString();
      if (value.length === 0) {
        return null; // handled by required
      }

      return autotypeGaShortcutFromText(value) != null
        ? null
        : { invalidShortcut: { message: this.i18nService.t("invalidShortcut") } };
    };
  }
}
