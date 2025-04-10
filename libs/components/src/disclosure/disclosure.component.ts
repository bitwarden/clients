// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  Component,
  EventEmitter,
  HostBinding,
  Input,
  Output,
  booleanAttribute,
} from "@angular/core";

let nextId = 0;

@Component({
  selector: "bit-disclosure",
  standalone: true,
  template: `<ng-content></ng-content>`,
})
export class DisclosureComponent {
  private _open: boolean;

  /** Emits the visibility of the disclosure content */
  @Output() openChange = new EventEmitter<boolean>();

  /**
   * Optionally init the disclosure in its opened state
   */
  @Input({ transform: booleanAttribute }) set open(isOpen: boolean) {
    this._open = isOpen;
    this.openChange.emit(isOpen);
  }

  @HostBinding("class") get classList() {
    return this.open ? "" : "tw-hidden";
  }

  @HostBinding("id") id = `bit-disclosure-${nextId++}`;

  get open(): boolean {
    return this._open;
  }
}
