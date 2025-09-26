import {
  BehaviorSubject,
  filter,
  first,
  firstValueFrom,
  forkJoin,
  map,
  Observable,
  of,
  switchMap,
  zip,
} from "rxjs";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import {
  PasswordHealthReportApplicationsRequest,
  PasswordHealthReportApplicationsResponse,
} from "../models/api-models.types";

import { CriticalAppsApiService } from "./critical-apps-api.service";

/* Retrieves and decrypts critical apps for a given organization
 *  Encrypts and saves data for a given organization
 */
export class CriticalAppsService {
  // -------------------------- Context state --------------------------
  // The organization ID of the organization the user is currently viewing
  private organizationId = new BehaviorSubject<OrganizationId | null>(null);
  private orgKey$ = new Observable<OrgKey>();

  // -------------------------- Data ------------------------------------
  private criticalAppsListSubject$ = new BehaviorSubject<
    PasswordHealthReportApplicationsResponse[]
  >([]);
  criticalAppsList$ = this.criticalAppsListSubject$.asObservable();

  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private criticalAppsApiService: CriticalAppsApiService,
  ) {}

  // Set context for the service for a specific organization
  loadOrganizationContext(orgId: OrganizationId, userId: UserId) {
    // Fetch the organization key for the user
    this.orgKey$ = this.keyService.orgKeys$(userId).pipe(
      filter((OrgKeys) => !!OrgKeys),
      map((organizationKeysById) => organizationKeysById[orgId as OrganizationId]),
    );

    // Store organization id for service context
    this.organizationId.next(orgId);

    // Setup the critical apps fetching for the organization
    if (orgId) {
      this.retrieveCriticalApps(orgId).subscribe({
        next: (result) => {
          this.criticalAppsListSubject$.next(result);
        },
        error: (error: unknown) => {
          throw error;
        },
      });
    }
  }

  // Get a list of critical apps for a given organization
  getAppsListForOrg(orgId: OrganizationId): Observable<PasswordHealthReportApplicationsResponse[]> {
    // [FIXME] Get organization id from context for all functions in this file
    if (orgId != this.organizationId.value) {
      throw new Error(
        `Organization ID mismatch: expected ${this.organizationId.value}, got ${orgId}`,
      );
    }

    return this.criticalAppsListSubject$
      .asObservable()
      .pipe(map((apps) => apps.filter((app) => app.organizationId === orgId)));
  }

  // Reset the critical apps list
  setAppsInListForOrg(apps: PasswordHealthReportApplicationsResponse[]) {
    this.criticalAppsListSubject$.next(apps);
  }

  // Save the selected critical apps for a given organization
  async setCriticalApps(orgId: OrganizationId, selectedUrls: string[]) {
    if (orgId != this.organizationId.value) {
      throw new Error("Organization ID mismatch");
    }

    const orgKey = await firstValueFrom(this.orgKey$);

    if (orgKey == null) {
      throw new Error("Organization key not found");
    }

    // only save records that are not already in the database
    const newEntries = await this.filterNewEntries(orgId as OrganizationId, selectedUrls);
    const criticalAppsRequests = await this.encryptNewEntries(
      this.organizationId.value as OrganizationId,
      orgKey,
      newEntries,
    );

    const dbResponse = await firstValueFrom(
      this.criticalAppsApiService.saveCriticalApps(criticalAppsRequests),
    );

    // add the new entries to the criticalAppsList
    const updatedList = [...this.criticalAppsListSubject$.value];
    for (const responseItem of dbResponse) {
      const decryptedUrl = await this.encryptService.decryptString(
        new EncString(responseItem.uri),
        orgKey,
      );
      if (!updatedList.some((f) => f.uri === decryptedUrl)) {
        updatedList.push({
          id: responseItem.id,
          organizationId: responseItem.organizationId,
          uri: decryptedUrl,
        } as PasswordHealthReportApplicationsResponse);
      }
    }
    this.criticalAppsListSubject$.next(updatedList);
  }

  // Drop a critical app for a given organization
  // Only one app may be dropped at a time
  async dropCriticalApp(orgId: OrganizationId, selectedUrl: string) {
    if (orgId != this.organizationId.value) {
      throw new Error("Organization ID mismatch");
    }

    const app = this.criticalAppsListSubject$.value.find(
      (f) => f.organizationId === orgId && f.uri === selectedUrl,
    );

    if (!app) {
      return;
    }

    await this.criticalAppsApiService.dropCriticalApp({
      organizationId: app.organizationId,
      passwordHealthReportApplicationIds: [app.id],
    });

    this.criticalAppsListSubject$.next(
      this.criticalAppsListSubject$.value.filter((f) => f.uri !== selectedUrl),
    );
  }

  private retrieveCriticalApps(
    orgId: OrganizationId | null,
  ): Observable<PasswordHealthReportApplicationsResponse[]> {
    if (orgId === null) {
      return of([]);
    }

    const result$ = zip(this.criticalAppsApiService.getCriticalApps(orgId), this.orgKey$).pipe(
      switchMap(([response, key]) => {
        if (key == null) {
          throw new Error("Organization key not found");
        }

        const results = response.map(async (r: PasswordHealthReportApplicationsResponse) => {
          const encrypted = new EncString(r.uri);
          const uri = await this.encryptService.decryptString(encrypted, key);
          return { id: r.id, organizationId: r.organizationId, uri: uri };
        });

        if (results.length === 0) {
          return of([]); // emits an empty array immediately
        }

        return forkJoin(results);
      }),
      first(),
    );

    return result$ as Observable<PasswordHealthReportApplicationsResponse[]>;
  }

  private async filterNewEntries(orgId: OrganizationId, selectedUrls: string[]): Promise<string[]> {
    return await firstValueFrom(this.criticalAppsListSubject$).then((criticalApps) => {
      const criticalAppsUri = criticalApps
        .filter((f) => f.organizationId === orgId)
        .map((f) => f.uri);
      return selectedUrls.filter((url) => !criticalAppsUri.includes(url));
    });
  }

  private async encryptNewEntries(
    orgId: OrganizationId,
    key: OrgKey,
    newEntries: string[],
  ): Promise<PasswordHealthReportApplicationsRequest[]> {
    const criticalAppsPromises = newEntries.map(async (url) => {
      const encryptedUrlName = await this.encryptService.encryptString(url, key);
      return {
        organizationId: orgId,
        url: encryptedUrlName?.encryptedString?.toString() ?? "",
      } as PasswordHealthReportApplicationsRequest;
    });

    return await Promise.all(criticalAppsPromises);
  }
}
