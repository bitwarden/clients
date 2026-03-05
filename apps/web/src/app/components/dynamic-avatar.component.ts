// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input, OnDestroy } from "@angular/core";
import { Subject } from "rxjs";

import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";

import { SharedModule } from "../shared";

type SizeTypes = "xlarge" | "large" | "default" | "small" | "xsmall";
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "dynamic-avatar",
  imports: [SharedModule],
  template: `<span [title]="title">
    <bit-avatar
      appStopClick
      [text]="text"
      [size]="size"
      [color]="color$ | async"
      [border]="border"
      [id]="id"
      [title]="title"
    >
    </bit-avatar>
  </span>`,
})
export class DynamicAvatarComponent implements OnDestroy {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() border = false;
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
  @Input() size: SizeTypes = "default";
  private destroy$ = new Subject<void>();

  color$ = this.avatarService.avatarColor$;

  constructor(private avatarService: AvatarService) {
    if (this.text) {
      this.text = this.text.toUpperCase();
    }
  }

  async ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
