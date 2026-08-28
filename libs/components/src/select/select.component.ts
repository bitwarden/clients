import { hasModifierKey } from "@angular/cdk/keycodes";
import { NgTemplateOutlet } from "@angular/common";
import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  contentChildren,
  output,
  computed,
  effect,
  inject,
  input,
  Signal,
  model,
  signal,
  untracked,
  viewChild,
} from "@angular/core";
import { ControlValueAccessor, NgControl, ReactiveFormsModule, FormsModule } from "@angular/forms";
import { NgSelectComponent, NgSelectModule } from "@ng-select/ng-select";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BitFormFieldControlDirective } from "../form-field";
import { IconComponent } from "../icon";
import {
  IconTileComponent,
  IconTileOptions,
  IconTileVariant,
  resolveIconTileColor,
  resolveIconTileVariant,
} from "../icon-tile";
import { TypographyDirective } from "../typography/typography.directive";

import { Option } from "./option";
import { OptionComponent } from "./option.component";

function sameIconTile(a: IconTileOptions | undefined, b: IconTileOptions | undefined): boolean {
  return (
    a === b ||
    (a != null &&
      b != null &&
      a.icon === b.icon &&
      a.variant === b.variant &&
      a.color === b.color &&
      a.emphasis === b.emphasis)
  );
}

function sameOptions<T>(a: Option<T>[] | undefined, b: Option<T>[]): boolean {
  if (a == null || a.length !== b.length) {
    return false;
  }
  return a.every(
    (prev, i) =>
      prev.icon === b[i].icon &&
      sameIconTile(prev.iconTile, b[i].iconTile) &&
      prev.value === b[i].value &&
      prev.label === b[i].label &&
      prev.description === b[i].description &&
      prev.disabled === b[i].disabled,
  );
}

@Component({
  selector: "bit-select",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "select.component.html",
  hostDirectives: [
    {
      directive: BitFormFieldControlDirective,
      inputs: ["required", "id"],
    },
  ],
  imports: [
    NgTemplateOutlet,
    NgSelectModule,
    ReactiveFormsModule,
    FormsModule,
    TypographyDirective,
    IconComponent,
    IconTileComponent,
  ],
  host: {
    class: "tw-block tw-w-full tw-h-full",
    "[id]": "formFieldControl.id()",
    "[attr.required]": "formFieldControl.required() || null",
    "[attr.disabled]": "disabled() || null",
  },
})
export class SelectComponent<T> implements ControlValueAccessor {
  private readonly i18nService = inject(I18nService);
  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  readonly formFieldControl = inject(BitFormFieldControlDirective);
  readonly labelForId = this.formFieldControl.labelForId;

  readonly select = viewChild.required(NgSelectComponent);

  /** Optional: Options can be provided using an array input or using `bit-option` */
  readonly items = model<Option<T>[] | undefined>();

  readonly placeholder = input(this.i18nService.t("selectPlaceholder"));
  readonly closed = output();

  protected readonly selectedValue = signal<T | undefined | null>(undefined);
  readonly selectedOption: Signal<Option<T> | null | undefined> = computed(() =>
    this.findSelectedOption(this.items(), this.selectedValue()),
  );
  protected readonly searchInputId = computed(() => `${this.formFieldControl.id()}-search`);

  /**Implemented as part of NG_VALUE_ACCESSOR */
  private readonly notifyOnChange = signal<((value?: T | null) => void) | undefined>(undefined);
  /**Implemented as part of NG_VALUE_ACCESSOR */
  private readonly notifyOnTouched = signal<(() => void) | undefined>(undefined);

  constructor() {
    if (this.ngControl != null) {
      this.ngControl.valueAccessor = this;
    }
    effect(() => this.formFieldControl.labelForId.set(this.searchInputId()));
    effect(() => {
      this.select()
        ?.searchInput()
        .nativeElement.setAttribute(
          "aria-describedby",
          this.formFieldControl.ariaDescribedBy() ?? "",
        );
    });
    afterRenderEffect({
      read: () => {
        const opts = this.options();
        if (opts.length === 0) {
          return;
        }
        const mapped = opts.map((option) => ({
          icon: option.icon(),
          iconTile: option.iconTile(),
          value: option.value(),
          label: option.label(),
          description: option.description(),
          disabled: option.disabled(),
        }));
        if (!sameOptions(untracked(this.items), mapped)) {
          this.items.set(mapped);
        }
      },
    });
  }

  private readonly options = contentChildren(OptionComponent);

  readonly disabledInput = input(false, { transform: booleanAttribute, alias: "disabled" });
  private readonly disabledFromCva = signal(false);

  /** Disabled either explicitly by the consumer or by the form control this is bound to. */
  readonly disabled = computed(() => this.disabledInput() || this.disabledFromCva());

  /**Implemented as part of NG_VALUE_ACCESSOR */
  writeValue(obj: T): void {
    this.selectedValue.set(obj);
  }

  /**Implemented as part of NG_VALUE_ACCESSOR */
  registerOnChange(fn: (value?: T | null) => void): void {
    this.notifyOnChange.set(fn);
  }

  /**Implemented as part of NG_VALUE_ACCESSOR */
  registerOnTouched(fn: any): void {
    this.notifyOnTouched.set(fn);
  }

  /**Implemented as part of NG_VALUE_ACCESSOR */
  setDisabledState(isDisabled: boolean): void {
    this.disabledFromCva.set(isDisabled);
  }

  /**Implemented as part of NG_VALUE_ACCESSOR */
  protected onChange(option: Option<T> | null) {
    this.selectedValue.set(option?.value);
    this.notifyOnChange()?.(option?.value);
  }

  /**Implemented as part of NG_VALUE_ACCESSOR */
  protected onBlur() {
    this.notifyOnTouched()?.();
  }

  protected tileVariant(option: Option<T>): IconTileVariant {
    return resolveIconTileVariant(option.iconTile, option.disabled);
  }

  protected tileColor(option: Option<T>): string | undefined {
    return resolveIconTileColor(option.iconTile, option.disabled);
  }

  private findSelectedOption(
    items: Option<T>[] | undefined,
    value: T | null | undefined,
  ): Option<T> | undefined {
    return items?.find((item) => item.value === value);
  }

  /**Emits the closed event. */
  protected onClose() {
    this.closed.emit();
  }

  /**
   * Prevent Escape key press from propagating to parent components
   * (for example, parent dialog should not close when Escape is pressed in the select)
   *
   * @returns true to keep default key behavior; false to prevent default key behavior
   *
   * Needs to be arrow function to retain `this` scope.
   */
  protected readonly onKeyDown = (event: KeyboardEvent) => {
    if (this.select().isOpen() && event.key === "Escape" && !hasModifierKey(event)) {
      event.stopPropagation();
    }

    return true;
  };
}
