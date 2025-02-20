import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { Jsonify } from "type-fest";

import {
  StateProvider,
  UserKeyDefinition,
  NEW_DEVICE_VERIFICATION_NOTICE,
  SingleUserState,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

// This service checks when to show New Device Verification Notice to Users
// It will be a two phase approach and the values below will work with two different feature flags
// If a user dismisses the notice, use "last_dismissal" to wait 7 days before re-prompting
// permanent_dismissal will be checked if the user should never see the notice again
export class NewDeviceVerificationNotice {
  last_dismissal: Date | null = null;
  permanent_dismissal: boolean | null = null;

  constructor(obj: Partial<NewDeviceVerificationNotice>) {
    if (obj == null) {
      return;
    }
    this.last_dismissal = obj.last_dismissal || null;
    this.permanent_dismissal = obj.permanent_dismissal || null;
  }

  static fromJSON(obj: Jsonify<NewDeviceVerificationNotice>) {
    return Object.assign(new NewDeviceVerificationNotice({}), obj);
  }
}

export const NEW_DEVICE_VERIFICATION_NOTICE_KEY =
  new UserKeyDefinition<NewDeviceVerificationNotice>(
    NEW_DEVICE_VERIFICATION_NOTICE,
    "noticeState",
    {
      deserializer: (obj: Jsonify<NewDeviceVerificationNotice>) =>
        NewDeviceVerificationNotice.fromJSON(obj),
      clearOn: [],
    },
  );

export const SKIP_NEW_DEVICE_VERIFICATION_NOTICE = new UserKeyDefinition<boolean>(
  NEW_DEVICE_VERIFICATION_NOTICE,
  "shouldSkip",
  {
    deserializer: (data: boolean) => data,
    clearOn: ["logout"],
  },
);

@Injectable()
export class NewDeviceVerificationNoticeService {
  constructor(private stateProvider: StateProvider) {}

  private noticeState(userId: UserId): SingleUserState<NewDeviceVerificationNotice> {
    return this.stateProvider.getUser(userId, NEW_DEVICE_VERIFICATION_NOTICE_KEY);
  }

  noticeState$(userId: UserId): Observable<NewDeviceVerificationNotice | null> {
    return this.noticeState(userId).state$;
  }

  async updateNewDeviceVerificationNoticeState(
    userId: UserId,
    newState: NewDeviceVerificationNotice,
  ): Promise<void> {
    await this.noticeState(userId).update(() => {
      return { ...newState };
    });
  }

  private skipState(userId: UserId): SingleUserState<boolean> {
    return this.stateProvider.getUser(userId, SKIP_NEW_DEVICE_VERIFICATION_NOTICE);
  }

  skipState$(userId: UserId): Observable<boolean | null> {
    return this.skipState(userId).state$;
  }

  async updateNewDeviceVerificationSkipNoticeState(
    userId: UserId,
    shouldSkip: boolean,
  ): Promise<void> {
    await this.skipState(userId).update(() => shouldSkip);
  }
}
