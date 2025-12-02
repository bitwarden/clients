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

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-toggle-group",
  templateUrl: "./toggle-group.component.html",
})
export class ToggleGroupComponent<TValue = unknown> {
  private id = nextId++;
  name = `bit-toggle-group-${this.id}`;

  readonly fullWidth = input<boolean, unknown>(undefined, { transform: booleanAttribute });
  readonly selected = model<TValue>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
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
