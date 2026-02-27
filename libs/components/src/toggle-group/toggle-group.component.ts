import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
} from "@angular/core";

let nextId = 0;

@Component({
  selector: "bit-toggle-group",
  templateUrl: "./toggle-group.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: "radiogroup",
    "[class]": "classlist()",
  },
})
export class ToggleGroupComponent<TValue = unknown> {
  private readonly id = nextId++;

  readonly name = `bit-toggle-group-${this.id}`;

  /**
   * Whether the toggle group should take up the full width of its container.
   * When true, each toggle button will be equally sized to fill the available space.
   */
  readonly fullWidth = input<boolean, unknown>(undefined, { transform: booleanAttribute });

  /**
   * The selected value in the toggle group.
   */
  readonly selected = model<TValue>();

  protected readonly classlist = computed(() =>
    ["tw-flex"].concat(this.fullWidth() ? ["tw-w-full", "[&>*]:tw-flex-1"] : []),
  );

  onInputInteraction(value: TValue) {
    this.selected.set(value);
  }
}
