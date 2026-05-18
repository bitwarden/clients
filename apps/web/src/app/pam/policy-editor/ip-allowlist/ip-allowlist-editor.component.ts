import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
} from "@angular/core";
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
} from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  AsyncActionsModule,
  ButtonModule,
  FormFieldModule,
  IconButtonModule,
} from "@bitwarden/components";

import { cidrValidator } from "./cidr.validator";

/** Cross-array validator: rejects if any two controls have the same trimmed value. */
function noDuplicateCidrsValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!(control instanceof FormArray)) {
      return null;
    }
    const values = (control.controls as FormControl<string>[]).map((c) => c.value.trim());
    const seen = new Set<string>();
    for (const v of values) {
      if (v === "") {
        continue;
      }
      if (seen.has(v)) {
        return { duplicateCidrs: true };
      }
      seen.add(v);
    }
    return null;
  };
}

/**
 * Editor for the `ip_allowlist` leasing policy.
 *
 * Presents a repeatable list of CIDR inputs. The parent
 * ({@link CollectionLeasingTabComponent}) binds [cidrs] on load and listens to
 * (cidrsChange) when the user mutates the list; the tab calls {@link validate}
 * before attempting a save and reads the value via {@link currentCidrs}.
 */
@Component({
  selector: "pam-ip-allowlist-editor",
  templateUrl: "./ip-allowlist-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    JslibModule,
    AsyncActionsModule,
    ButtonModule,
    FormFieldModule,
    IconButtonModule,
  ],
})
export class IpAllowlistEditorComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  /** Initial CIDR list supplied by the parent on load. */
  readonly cidrs = input<string[]>([]);

  /** Whether the form fields should be read-only. */
  readonly readonly = input<boolean>(false);

  /**
   * Emitted whenever the CIDR list changes so the parent can track the latest
   * value without polling.
   */
  readonly cidrsChange = output<string[]>();

  protected readonly cidrArray = this.fb.array<string>([], [noDuplicateCidrsValidator()]);

  get currentCidrs(): string[] {
    return (this.cidrArray.controls as FormControl<string>[]).map((c) => c.value.trim());
  }

  /** Returns `true` when the form is valid and ready to submit. */
  validate(): boolean {
    this.cidrArray.markAllAsTouched();
    this.cidrArray.updateValueAndValidity();
    return this.cidrArray.valid && this.cidrArray.length > 0;
  }

  ngOnInit(): void {
    const initial = this.cidrs();
    if (initial.length > 0) {
      for (const cidr of initial) {
        this.appendRow(cidr);
      }
    } else {
      this.appendRow("");
    }
  }

  protected addRow(): void {
    this.appendRow("");
    this.emitChange();
  }

  protected removeRow(index: number): void {
    this.cidrArray.removeAt(index);
    this.cidrArray.updateValueAndValidity();
    this.emitChange();
  }

  protected onRowChange(): void {
    this.cidrArray.updateValueAndValidity();
    this.emitChange();
  }

  private appendRow(value: string): void {
    this.cidrArray.push(
      this.fb.control(value, { nonNullable: true, validators: [cidrValidator()] }),
    );
  }

  private emitChange(): void {
    this.cidrsChange.emit(this.currentCidrs);
  }
}
