import { Injectable, inject } from "@angular/core";
import { Observable, map, of } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { GROUPS_TABLE_FILTERS_MEMORY, StateProvider, UserKeyDefinition } from "@bitwarden/state";

export type GroupsTableState = {
  /** Ids of the shared folders selected in the filter menu. */
  sharedFolders?: string[];
  /** The last search term typed into the table's search box. */
  search?: string;
  /** The sorted column's name, as declared on `bit-column`. */
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
};

type GroupsTableStateByOrg = Record<string, GroupsTableState>;

export const GROUPS_TABLE_STATE = new UserKeyDefinition<GroupsTableStateByOrg>(
  GROUPS_TABLE_FILTERS_MEMORY,
  "groupsTableState",
  {
    deserializer: (value) => value,
    clearOn: ["lock", "logout"],
  },
);

@Injectable({ providedIn: "root" })
export class GroupsV2TableStateService {
  private readonly stateProvider = inject(StateProvider, { optional: true });
  private readonly logService = inject(LogService, { optional: true });

  state$(organizationId: OrganizationId): Observable<GroupsTableState> {
    if (this.stateProvider == null) {
      return of({});
    }
    return this.stateProvider
      .getActive(GROUPS_TABLE_STATE)
      .state$.pipe(map((byOrg) => byOrg?.[organizationId] ?? {}));
  }

  async update(organizationId: OrganizationId, patch: Partial<GroupsTableState>): Promise<void> {
    if (this.stateProvider == null) {
      return Promise.resolve();
    }
    return this.stateProvider
      .getActive(GROUPS_TABLE_STATE)
      .update((byOrg): GroupsTableStateByOrg => ({
        ...byOrg,
        [organizationId]: { ...byOrg?.[organizationId], ...patch },
      }))
      .then((): void => undefined)
      .catch((e: unknown): void => this.logService?.error(e));
  }
}
