import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  ValidatorFn,
  AbstractControl,
  ValidationErrors,
} from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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
export class AutotypeShortcutComponent implements OnInit {
  constructor(
    private accountService: AccountService,
    private dialogRef: DialogRef,
    private formBuilder: FormBuilder,
  ) {}

  private shortcutArray: string[] = [];

  ngOnInit(): void {
    // set form value from state
  }

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

  private buildShortcutFromEvent(event: KeyboardEvent): string | null {
    const hasCtrl = event.ctrlKey;
    const hasAlt = event.altKey;
    const hasShift = event.shiftKey;
    const hasMeta = event.metaKey; // Windows key on Windows, Command on macOS

    // Require at least one modifier (Control, Alt, Shift, or Super)
    if (!hasCtrl && !hasAlt && !hasShift && !hasMeta) {
      return null;
    }

    const key = event.key;

    // Ignore pure modifier keys themselves
    if (key === "Control" || key === "Alt" || key === "Shift" || key === "Meta") {
      return null;
    }

    // Accept a single alphanumeric letter or number as the base key
    const isAlphaNumeric = typeof key === "string" && /^[a-zA-Z]$/.test(key);
    if (!isAlphaNumeric) {
      return null;
    }

    const parts: string[] = [];
    if (hasCtrl) {
      parts.push("Control");
    }
    if (hasAlt) {
      parts.push("Alt");
    }
    if (hasShift) {
      parts.push("Shift");
    }
    if (hasMeta) {
      parts.push("Super");
    }
    parts.push(key.toUpperCase());

    this.shortcutArray = parts;

    return parts.join("+");
  }

  private shortcutCombinationValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = (control.value ?? "").toString();
      if (value.length === 0) {
        return null; // handled by required
      }

      // Must include at least one modifier and end with a single alphanumeric
      // Valid examples: Ctrl+A, Alt+5, Shift+Z, Ctrl+Alt+7, Ctrl+Shift+X, Alt+Shift+Q
      const pattern =
        /^(?=.*\b(Control|Alt|Shift|Super)\b)(?:Control\+)?(?:Alt\+)?(?:Shift\+)?(?:Super\+)?[A-Z]$/i;
      return pattern.test(value) ? null : { invalidShortcut: true };
    };
  }
}
