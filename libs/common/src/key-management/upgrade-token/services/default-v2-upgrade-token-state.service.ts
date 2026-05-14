import { Observable } from "rxjs";

import { V2UpgradeToken } from "@bitwarden/sdk-internal";

import { assertNonNullish } from "../../../auth/utils";
import { StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { V2UpgradeTokenStateService } from "../abstractions/v2-upgrade-token-state.service.abstraction";
import { V2_UPGRADE_TOKEN } from "../v2-upgrade-token.state";

export class DefaultV2UpgradeTokenStateService implements V2UpgradeTokenStateService {
  constructor(private readonly stateProvider: StateProvider) {}

  v2UpgradeToken$(userId: UserId): Observable<V2UpgradeToken | null> {
    assertNonNullish(userId, "userId");

    return this.stateProvider.getUser(userId, V2_UPGRADE_TOKEN).state$;
  }

  async setV2UpgradeToken(token: V2UpgradeToken, userId: UserId): Promise<void> {
    assertNonNullish(token, "token");
    assertNonNullish(userId, "userId");

    await this.stateProvider.getUser(userId, V2_UPGRADE_TOKEN).update(() => token);
  }

  async clearV2UpgradeToken(userId: UserId): Promise<void> {
    assertNonNullish(userId, "userId");

    await this.stateProvider.getUser(userId, V2_UPGRADE_TOKEN).update(() => null, {
      shouldUpdate: (previousValue) => previousValue !== null,
    });
  }
}
