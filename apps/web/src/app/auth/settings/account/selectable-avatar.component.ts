// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { NgClass } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";

import { AvatarModule } from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "selectable-avatar",
  template: `<span
    [title]="title"
    (click)="onFire()"
    (keyup.enter)="onFire()"
    tabindex="0"
    [ngClass]="classList"
  >
    <bit-avatar
      appStopClick
      [text]="text"
      size="xlarge"
      [text]="text"
      [color]="color"
      [border]="false"
      [id]="id"
      [border]="border"
      [title]="title"
    >
    </bit-avatar>
  </span>`,
  imports: [NgClass, AvatarModule],
})
export class SelectableAvatarComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() id: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() text: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() title: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() color: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() border = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() selected = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() select = new EventEmitter<string>();

  onFire() {
    this.select.emit(this.color);
  }

  get classList() {
    return ["tw-rounded-full tw-inline-block"]
      .concat(["tw-cursor-pointer", "tw-outline", "tw-outline-solid", "tw-outline-offset-1"])
      .concat(
        this.selected
          ? ["tw-outline-[3px]", "tw-outline-primary-600"]
          : [
              "tw-outline-0",
              "hover:tw-outline-1",
              "hover:tw-outline-primary-300",
              "focus:tw-outline-2",
              "focus:tw-outline-primary-600",
            ],
      );
  }
}
