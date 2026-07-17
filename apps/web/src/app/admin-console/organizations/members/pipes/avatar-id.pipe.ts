import { Pipe, PipeTransform } from "@angular/core";

import { AvatarIdentifiable, resolveAvatarId } from "../utils/resolve-avatar-id";

/**
 * Resolves the identifier passed to `bit-avatar`'s `[id]` input so a member's avatar color is
 * consistent everywhere they're rendered. See {@link resolveAvatarId} for details.
 *
 * A pure pipe (the default) is used instead of a template function call so Angular only
 * re-evaluates it when the `user` reference changes, rather than on every change detection cycle.
 */
@Pipe({
  name: "avatarId",
})
export class AvatarIdPipe implements PipeTransform {
  transform(user: AvatarIdentifiable): string {
    return resolveAvatarId(user);
  }
}
