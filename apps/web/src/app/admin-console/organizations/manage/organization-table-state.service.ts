import { Injectable, inject } from "@angular/core";
import { map, Observable, of } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import {
  ORGANIZATION_TABLE_FILTERS_MEMORY,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/state";

/** A table's filter/sort/search view. */
export type TableViewState = {
  /** Ids of the shared folders selected in the filter menu. */
  sharedFolders?: string[];
  /** The last search term typed into the table's search box. */
  search?: string;
  /** The sorted column's name, as declared on `bit-column`. */
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
};

type OrganizationTables = {
  groups?: TableViewState;
  members?: TableViewState;
};

type OrganizationTablesByOrg = Record<string, OrganizationTables>;

export const ORGANIZATION_TABLE_STATE = new UserKeyDefinition<OrganizationTablesByOrg>(
  ORGANIZATION_TABLE_FILTERS_MEMORY,
  "organizationTableState",
  {
    deserializer: (value) => value,
    clearOn: ["lock", "logout"],
  },
);

@Injectable({ providedIn: "root" })
export class OrganizationTableStateService {
  private readonly stateProvider = inject(StateProvider, { optional: true });
  private readonly logService = inject(LogService, { optional: true });

  state$(
    userId: UserId,
    organizationId: OrganizationId,
    table: keyof OrganizationTables,
  ): Observable<TableViewState> {
    if (this.stateProvider == null) {
      return of({});
    }
    return this.stateProvider
      .getUser(userId, ORGANIZATION_TABLE_STATE)
      .state$.pipe(map((byOrg) => byOrg?.[organizationId]?.[table] ?? {}));
  }

  async save(
    userId: UserId,
    organizationId: OrganizationId,
    table: keyof OrganizationTables,
    state: TableViewState,
  ): Promise<void> {
    if (this.stateProvider == null) {
      return;
    }
    await this.stateProvider
      .getUser(userId, ORGANIZATION_TABLE_STATE)
      .update((byOrg): OrganizationTablesByOrg => ({
        ...byOrg,
        [organizationId]: { ...byOrg?.[organizationId], [table]: state },
      }))
      .catch((e: unknown): void => this.logService?.error(e));
  }
}
