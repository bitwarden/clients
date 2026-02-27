// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { ApiService } from "../../abstractions/api.service";
import { UpdateAvatarRequest } from "../../models/request/update-avatar.request";
import { AVATAR_DISK, StateProvider, UserKeyDefinition } from "../../platform/state";
import { UserId } from "../../types/guid";
import { AvatarService as AvatarServiceAbstraction } from "../abstractions/avatar.service";

const AVATAR_COLOR = new UserKeyDefinition<string>(AVATAR_DISK, "avatarColor", {
  deserializer: (value) => value,
  clearOn: [],
});

export class AvatarService implements AvatarServiceAbstraction {
  avatarColor$: Observable<string>;

  constructor(
    private apiService: ApiService,
    private stateProvider: StateProvider,
  ) {
    this.avatarColor$ = this.stateProvider.getActive(AVATAR_COLOR).state$;
  }

  async setAvatarColor(color: string): Promise<void> {
    const { avatarColor } = await this.apiService.putAvatar(new UpdateAvatarRequest(color));

    await this.stateProvider.setUserState(AVATAR_COLOR, avatarColor);
  }

  async setSyncAvatarColor(userId: UserId, color: string): Promise<void> {
    await this.stateProvider.getUser(userId, AVATAR_COLOR).update(() => color);
  }

  getUserAvatarColor$(userId: UserId): Observable<string | null> {
    return this.stateProvider.getUser(userId, AVATAR_COLOR).state$;
  }
}
