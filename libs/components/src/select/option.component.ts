import { Component, booleanAttribute, input } from "@angular/core";

import { MappedOptionComponent } from "./option";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-option",
  template: `<ng-template><ng-content></ng-content></ng-template>`,
})
export class OptionComponent<T = unknown> implements MappedOptionComponent<T> {
  readonly icon = input<string>();

  readonly value = input.required<T>();

  readonly label = input.required<string>();

  readonly disabled = input(undefined, { transform: booleanAttribute });
}
