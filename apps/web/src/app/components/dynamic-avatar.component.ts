import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";

import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { AvatarSize } from "@bitwarden/components";

import { SharedModule } from "../shared";

@Component({
  selector: "dynamic-avatar",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [title]="title()">
    <bit-avatar
      appStopClick
      [text]="text()"
      [size]="size()"
      [color]="color$ | async"
      [id]="id()"
      [title]="title()"
    >
    </bit-avatar>
  </span>`,
})
export class DynamicAvatarComponent {
  readonly id = input<string>();
  readonly text = input<string>();
  readonly title = input<string>();
  readonly size = input<AvatarSize>("base");

  private readonly avatarService = inject(AvatarService);

  protected readonly color$ = this.avatarService.avatarColor$;
}
