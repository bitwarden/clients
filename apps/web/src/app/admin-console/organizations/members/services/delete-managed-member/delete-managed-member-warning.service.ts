import { Injectable } from "@angular/core";
import { map } from "rxjs";

import {
  DELETE_MANAGED_USER_WARNING,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { DialogService } from "@bitwarden/components";

export const SHOW_WARNING_KEY = new UserKeyDefinition<string[]>(
  DELETE_MANAGED_USER_WARNING,
  "showDeleteManagedUserWarning",
  {
    deserializer: (b) => b,
    clearOn: [],
  },
);

@Injectable({ providedIn: "root" })
export class DeleteManagedMemberWarningService {
  private _acknowledged = this.stateProvider.getActive(SHOW_WARNING_KEY);
  private acknowledgedState$ = this._acknowledged.state$;

  constructor(
    private stateProvider: StateProvider,
    private dialogService: DialogService,
  ) {}

  async acknowledgeWarning(organizationId: string) {
    await this._acknowledged.update((state) => {
      if (!organizationId) {
        return state;
      }
      if (!state) {
        return [organizationId];
      } else if (!state.includes(organizationId)) {
        return [...state, organizationId];
      }
      return state;
    });
  }

  async showWarning() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: {
        key: "deleteManagedUserWarning",
      },
      content: {
        key: "deleteManagedUserWarningDesc",
      },
      type: "danger",
      icon: "bwi-exclamation-triangle",
      acceptButtonText: { key: "continue" },
      cancelButtonText: { key: "cancel" },
    });

    if (!confirmed) {
      return false;
    }

    return confirmed;
  }

  warningAcknowledged(organizationId: string) {
    return this.acknowledgedState$.pipe(
      map((acknowledgedIds) => acknowledgedIds?.includes(organizationId) ?? false),
    );
  }
}
