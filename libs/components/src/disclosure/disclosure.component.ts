import {
  Component,
  EventEmitter,
  HostBinding,
  Input,
  Output,
  booleanAttribute,
} from "@angular/core";

let nextId = 0;

/**
  * The `bit-disclosure` component is used in tandem with the `bitDisclosureTriggerFor` directive to create an accessible content area whose visibility is controlled by a trigger button.

  * To compose a disclosure and trigger:

  * 1. Create a trigger component (see "Supported Trigger Components" section below)
  * 2. Create a `bit-disclosure`
  * 3. Set a template reference on the `bit-disclosure`
  * 4. Use the `bitDisclosureTriggerFor` directive on the trigger component, and pass it the `bit-disclosure` template reference
  * 5. Set the `open` property on the `bit-disclosure` to init the disclosure as either currently expanded or currently collapsed. The disclosure will default to `false`, meaning it defaults to being hidden.
  *
  * @example
  *
  * ```html
  * <button
  *   type="button"
  *   bitIconButton="bwi-sliders"
  *   [buttonType]="'muted'"
  *   [bitDisclosureTriggerFor]="disclosureRef"
  *   [label]="'Settings' | i18n"
  * ></button>
  * <bit-disclosure #disclosureRef open>click button to hide this content</bit-disclosure>
  * ```
  *
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-disclosure",
  template: `<ng-content></ng-content>`,
})
export class DisclosureComponent {
  /** Emits the visibility of the disclosure content */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() openChange = new EventEmitter<boolean>();

  private _open?: boolean;
  /**
   * Optionally init the disclosure in its opened state
   */
  // TODO: Skipped for signal migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ transform: booleanAttribute }) set open(isOpen: boolean) {
    this._open = isOpen;
    this.openChange.emit(isOpen);
  }
  get open(): boolean {
    return !!this._open;
  }

  @HostBinding("class") get classList() {
    return this.open ? "" : "tw-hidden";
  }

  @HostBinding("id") id = `bit-disclosure-${nextId++}`;
}
