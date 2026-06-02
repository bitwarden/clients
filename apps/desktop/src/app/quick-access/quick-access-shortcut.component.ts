import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from "@angular/forms";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  AsyncActionsModule,
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  IconButtonModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  DEFAULT_QUICK_ACCESS_SHORTCUT,
  isQuickAccessShortcutValid,
} from "../../platform/models/domain/quick-access-shortcut";

type QuickAccessShortcutDialogData = {
  currentShortcut?: string | null;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "quick-access-shortcut.component.html",
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CommonModule,
    DialogModule,
    FormFieldModule,
    IconButtonModule,
    I18nPipe,
    ReactiveFormsModule,
  ],
})
export class QuickAccessShortcutComponent {
  constructor(
    @Inject(DIALOG_DATA) private data: QuickAccessShortcutDialogData,
    private dialogRef: DialogRef<string>,
    private formBuilder: FormBuilder,
  ) {
    this.shortcut = this.data.currentShortcut ?? DEFAULT_QUICK_ACCESS_SHORTCUT;
  }

  private shortcut = DEFAULT_QUICK_ACCESS_SHORTCUT;

  setShortcutForm = this.formBuilder.group({
    shortcut: [
      this.data.currentShortcut ?? DEFAULT_QUICK_ACCESS_SHORTCUT,
      [Validators.required, this.shortcutCombinationValidator()],
    ],
  });

  submit = async () => {
    const shortcutFormControl = this.setShortcutForm.controls.shortcut;

    if (Utils.isNullOrWhitespace(shortcutFormControl.value) || shortcutFormControl.invalid) {
      return;
    }

    await this.dialogRef.close(shortcutFormControl.value);
  };

  static open(dialogService: DialogService, currentShortcut?: string | null) {
    return dialogService.open<string, QuickAccessShortcutDialogData>(QuickAccessShortcutComponent, {
      data: {
        currentShortcut,
      },
    });
  }

  onShortcutKeydown(event: KeyboardEvent): void {
    event.preventDefault();

    const shortcut = this.buildShortcutFromEvent(event);
    if (shortcut == null) {
      return;
    }

    this.shortcut = shortcut;
    this.setShortcutForm.controls.shortcut.setValue(shortcut);
    this.setShortcutForm.controls.shortcut.markAsDirty();
    this.setShortcutForm.controls.shortcut.updateValueAndValidity();
  }

  private buildShortcutFromEvent(event: KeyboardEvent): string | null {
    const key = event.key;
    if (key === "Control" || key === "Alt" || key === "Meta" || key === "Shift") {
      return null;
    }

    const baseKey = this.getBaseKey(key);
    if (baseKey == null) {
      return null;
    }

    const parts: string[] = [];
    if (event.ctrlKey) {
      parts.push("Control");
    }
    if (event.altKey) {
      parts.push("Alt");
    }
    if (event.metaKey) {
      parts.push("CommandOrControl");
    }
    if (event.shiftKey) {
      parts.push("Shift");
    }
    parts.push(baseKey);

    const shortcut = parts.join("+");
    return isQuickAccessShortcutValid(shortcut) ? shortcut : null;
  }

  private getBaseKey(key: string) {
    if (key === " " || key === "Spacebar") {
      return "Space";
    }

    if (/^[a-z]$/i.test(key)) {
      return key.toUpperCase();
    }

    return null;
  }

  private shortcutCombinationValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = (control.value ?? "").toString();
      if (value.length === 0) {
        return null;
      }

      return isQuickAccessShortcutValid(value) ? null : { invalidShortcut: true };
    };
  }
}
