import { Pipe, PipeTransform } from "@angular/core";

import { AvatarIdentifiable, resolveAvatarId } from "../utils/resolve-avatar-id";

/** Resolves a member's `bit-avatar` id. See {@link resolveAvatarId}. */
@Pipe({
  name: "avatarId",
})
export class AvatarIdPipe implements PipeTransform {
  transform(user: AvatarIdentifiable): string {
    return resolveAvatarId(user);
  }
}
