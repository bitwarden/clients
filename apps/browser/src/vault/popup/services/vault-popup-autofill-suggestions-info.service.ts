import { Injectable } from "@angular/core";
import { map, Observable } from "rxjs";

import {
  StateProvider,
  UserKeyDefinition,
  VAULT_SETTINGS_DISK,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

export type AutofillSuggestionsInfoState = {
  dismissed?: boolean;
  pingCompleted?: boolean;
};

const DEFAULT_STATE: AutofillSuggestionsInfoState = {
  dismissed: false,
  pingCompleted: false,
};

const AUTOFILL_SUGGESTIONS_INFO_KEY = new UserKeyDefinition<AutofillSuggestionsInfoState>(
  VAULT_SETTINGS_DISK,
  "autofillSuggestionsInfo",
  {
    deserializer: (obj) => obj,
    clearOn: [],
  },
);

@Injectable({
  providedIn: "root",
})
export class VaultPopupAutofillSuggestionsInfoService {
  constructor(private stateProvider: StateProvider) {}

  private stateForUser(userId: UserId) {
    return this.stateProvider.getUser(userId, AUTOFILL_SUGGESTIONS_INFO_KEY);
  }

  state$(userId: UserId): Observable<AutofillSuggestionsInfoState> {
    return this.stateForUser(userId).state$.pipe(map((state) => state ?? DEFAULT_STATE));
  }

  async markPingCompleted(userId: UserId): Promise<void> {
    await this.stateForUser(userId).update((current) => ({
      ...(current ?? DEFAULT_STATE),
      pingCompleted: true,
    }));
  }

  async markDismissed(userId: UserId): Promise<void> {
    await this.stateForUser(userId).update((current) => ({
      ...(current ?? DEFAULT_STATE),
      dismissed: true,
    }));
  }
}
