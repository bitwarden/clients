import { CommonModule } from "@angular/common";
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  effect,
  inject,
  input,
  contentChild,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AbstractControl, StatusChangeEvent, TouchedChangeEvent, Validators } from "@angular/forms";
import { filter } from "rxjs";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitHintDirective } from "../form-control/hint.directive";
import { BitLabelComponent } from "../form-control/label.component";

import { BitErrorComponent } from "./error.component";
import { BitFieldContainerDirective, FieldContainerSize } from "./field-container.directive";
import { BitFormFieldControlDirective } from "./form-field-control.directive";
import { BitPrefixDirective } from "./prefix.directive";
import { BitSuffixDirective } from "./suffix.directive";

@Component({
  selector: "bit-form-field",
  templateUrl: "./form-field.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, BitErrorComponent, BitFieldContainerDirective, I18nPipe],
  host: {
    "[class]": "classList",
  },
})
export class BitFormFieldComponent {
  /**
   * The projected form control directive (`bitInput`, `bitSelect`, etc.).
   *
   * Optional so that wrapper components (e.g. `bit-file-upload`, `bit-file-dropzone`) can compose
   * `bit-form-field` for its label / hint / error chrome while owning their own control and
   * laying out a custom input. In that mode the wrapper passes its control via `control`, and the
   * field-container chrome is not rendered.
   */
  readonly input = contentChild(BitFormFieldControlDirective);
  readonly hint = contentChild(BitHintDirective);
  readonly label = contentChild(BitLabelComponent);

  readonly errorComponent = viewChild(BitErrorComponent);

  readonly disableMargin = input(false, { transform: booleanAttribute });

  readonly size = input<FieldContainerSize>("base");

  /**
   * The control driving this field in wrapper mode (no projected `BitFormFieldControlDirective`).
   * `required`, error state, and touched are derived from it, mirroring what the directive does
   * for standard controls. Ignored when a control directive is present.
   */
  readonly control = input<AbstractControl | null>();

  /** Label target for wrapper mode — the id of the wrapper's focusable element. */
  readonly labelForId = input<string>();

  private readonly destroyRef = inject(DestroyRef);

  private readonly prefixChildren = contentChildren(BitPrefixDirective);
  private readonly suffixChildren = contentChildren(BitSuffixDirective);

  // Bridges the wrapper-supplied control's status/touched RxJS events into the signal graph so
  // the computeds below re-evaluate. (The directive does this itself for standard controls.)
  private readonly controlEvent = signal<unknown>(null);

  protected readonly prefixHasChildren = computed(() => this.prefixChildren().length > 0);
  protected readonly suffixHasChildren = computed(() => this.suffixChildren().length > 0);

  /** Whether a projected control directive drives the field (standard usage). */
  protected readonly hasControl = computed(() => this.input() != null);

  protected readonly resolvedLabelForId = computed(
    () => this.input()?.labelForId() ?? this.labelForId() ?? "",
  );

  protected readonly required = computed(() => {
    const directive = this.input();
    if (directive) {
      return directive.required();
    }
    this.controlEvent();
    return this.control()?.hasValidator(Validators.required) ?? false;
  });

  /** Public so wrapper components can reflect the error state in their own custom-input chrome. */
  readonly hasError = computed(() => {
    const directive = this.input();
    if (directive) {
      return directive.hasError();
    }
    this.controlEvent();
    const control = this.control();
    return control != null && control.invalid && control.touched;
  });

  protected readonly error = computed<[string, any] | undefined>(() => {
    const directive = this.input();
    if (directive) {
      return directive.error;
    }
    this.controlEvent();
    const errors = this.control()?.errors;
    if (errors == null) {
      return undefined;
    }
    const key = Object.keys(errors)[0];
    return [key, errors[key]];
  });

  /**
   * Id of the element describing the control (error takes precedence over hint). Wrapper
   * components read this to wire `aria-describedby` on their own focusable input.
   */
  readonly describedById = computed<string | undefined>(() => {
    if (this.hasError()) {
      return this.errorComponent()?.id;
    }
    return this.hint()?.id;
  });

  protected get labelAndFieldContainerClasses(): string {
    return [
      "tw-flex",
      "tw-flex-col",
      "has-[input:disabled]:!tw-text-fg-inactive",
      "[&_bit-hint]:tw-m-0",
      "[&_bit-error]:tw-m-0",
      ...(this.readOnly ? [] : ["tw-gap-2"]),
    ].join(" ");
  }

  protected get contentContainerClasses(): string {
    return [
      "tw-size-full",
      "tw-min-w-0",
      "tw-relative",
      "[&>*]:tw-p-0",
      "[&>*::selection]:tw-bg-bg-brand-medium",
      "[&>*::selection]:tw-text-fg-heading",
      "has-[bit-select]:tw-p-0",
      "has-[bit-multi-select]:tw-p-0",
      "has-[textarea]:tw-pe-0",
      "has-[textarea]:!tw-py-3",
      ...(this.readOnly ? [] : ["tw-px-3"]),
    ].join(" ");
  }

  get classList() {
    return ["tw-block"].concat(this.disableMargin() ? [] : ["tw-mb-4", "bit-compact:tw-mb-3"]);
  }

  protected get readOnly(): boolean {
    return !!this.input()?.readOnly();
  }

  constructor() {
    // Wire the projected control's aria-describedby to the rendered error/hint. Wrapper
    // components (no projected control) read `describedById` directly instead.
    effect(() => {
      this.input()?.ariaDescribedBy.set(this.describedById());
    });

    // Wrapper mode: bridge the supplied control's status/touched changes into the signal graph.
    effect((onCleanup) => {
      const control = this.control();
      if (control == null) {
        return;
      }
      const subscription = control.events
        .pipe(
          filter((e) => e instanceof StatusChangeEvent || e instanceof TouchedChangeEvent),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe(() => this.controlEvent.set({}));
      onCleanup(() => subscription.unsubscribe());
    });
  }
}
