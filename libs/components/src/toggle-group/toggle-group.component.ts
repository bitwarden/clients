import {
  booleanAttribute,
  Component,
  EventEmitter,
  HostBinding,
  Output,
  input,
  model,
} from "@angular/core";

let nextId = 0;

@Component({
  selector: "bit-toggle-group",
  templateUrl: "./toggle-group.component.html",
})
export class ToggleGroupComponent<TValue = unknown> {
  private id = nextId++;
  name = `bit-toggle-group-${this.id}`;

  readonly fullWidth = input<boolean, unknown>(undefined, { transform: booleanAttribute });
  readonly selected = model<TValue>();
  @Output() selectedChange = new EventEmitter<TValue>();

  @HostBinding("attr.role") role = "radiogroup";
  @HostBinding("class")
  get classList() {
    return ["tw-flex"].concat(this.fullWidth() ? ["tw-w-full", "[&>*]:tw-flex-1"] : []);
  }

  onInputInteraction(value: TValue) {
    this.selected.set(value);
    this.selectedChange.emit(value);
  }
}
