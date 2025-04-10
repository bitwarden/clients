import {
  booleanAttribute,
  Component,
  EventEmitter,
  HostBinding,
  Input,
  Output,
} from "@angular/core";

let nextId = 0;

@Component({
  selector: "bit-toggle-group",
  templateUrl: "./toggle-group.component.html",
  standalone: true,
})
export class ToggleGroupComponent<TValue = unknown> {
  private id = nextId++;
  name = `bit-toggle-group-${this.id}`;

  @Input({ transform: booleanAttribute }) fullWidth?: boolean;
  @Input() selected?: TValue;
  @Output() selectedChange = new EventEmitter<TValue>();

  @HostBinding("attr.role") role = "radiogroup";
  @HostBinding("class")
  get classList() {
    return ["tw-flex"].concat(this.fullWidth ? ["tw-w-full", "[&>*]:tw-flex-1"] : []);
  }

  onInputInteraction(value: TValue) {
    this.selected = value;
    this.selectedChange.emit(value);
  }
}
