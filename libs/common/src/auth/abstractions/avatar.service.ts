import { Observable } from "rxjs";

import { UserId } from "../../types/guid";

export abstract class AvatarService {
  /**
   * An observable monitoring the active user's avatar color.
   * The observable updates when the avatar color changes.
   */
  abstract avatarColor$: Observable<string | null>;
  /**
   * Sets the avatar color of the active user
   *
   * @param color the color to set the avatar color to
   * @returns a promise that resolves when the avatar color is set
   */
  abstract setAvatarColor(color: string): Promise<void>;
  /**
   * Sets the avatar color for the given user, meant to be used via sync.
   *
   * @remarks This is meant to be used for getting an updated avatar color from
   *          the sync endpoint. If the user is changing their avatar color
   *          on device, you should instead call {@link setAvatarColor}.
   *
   * @param userId The user id for the user to set the avatar color for
   * @param color The color to set the avatar color to
   */
  abstract setSyncAvatarColor(userId: UserId, color: string): Promise<void>;
  /**
   * Gets the avatar color of the specified user.
   *
   * @remarks This is most useful for account switching where we show an
   *          avatar for each account. If you only need the active user's
   *          avatar color, use the avatarColor$ observable above instead.
   *
   * @param userId the userId of the user whose avatar color should be retreived
   * @return an Observable that emits a string of the avatar color of the specified user
   */
  abstract getUserAvatarColor$(userId: UserId): Observable<string | null>;
}
