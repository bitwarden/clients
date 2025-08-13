import {
  BehaviorSubject,
  first,
  firstValueFrom,
  forkJoin,
  from,
  Observable,
  of,
  switchMap,
  zip,
} from "rxjs";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { OrganizationId } from "@bitwarden/common/types/guid";
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
  // The organization ID of the organization the user is currently viewing
  private organizationId = new BehaviorSubject<OrganizationId | null>(null);
  organizationId$ = this.organizationId.asObservable();

  private criticalAppsListSubject = new BehaviorSubject<PasswordHealthReportApplicationsResponse[]>(
    [],
  );
  criticalAppsList$ = this.criticalAppsListSubject.asObservable();

  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private criticalAppsApiService: CriticalAppsApiService,
  ) {}

  async initialize(organizationId: OrganizationId) {
    this.organizationId.next(organizationId);
    if (organizationId) {
      this.retrieveCriticalApps(organizationId).subscribe({
        next: (result) => {
          this.criticalAppsListSubject.next(result);
        },
        error: (error: unknown) => {
          throw error;
        },
      });
    }
  }

  // Reset the critical apps list
  setAppsInListForOrg(apps: PasswordHealthReportApplicationsResponse[]) {
    this.criticalAppsListSubject.next(apps);
  }

  // Save the selected critical apps for a given organization
  async setCriticalApps(orgId: string, selectedUrls: string[]) {
    const key = await this.keyService.getOrgKey(orgId);
    if (key == null) {
      throw new Error("Organization key not found");
    }

    // only save records that are not already in the database
    const newEntries = await this.filterNewEntries(orgId as OrganizationId, selectedUrls);
    const criticalAppsRequests = await this.encryptNewEntries(
      orgId as OrganizationId,
      key,
      newEntries,
    );

    const dbResponse = await firstValueFrom(
      this.criticalAppsApiService.saveCriticalApps(criticalAppsRequests),
    );

    // add the new entries to the criticalAppsList
    const updatedList = [...this.criticalAppsListSubject.value];
    for (const responseItem of dbResponse) {
      const decryptedUrl = await this.encryptService.decryptString(
        new EncString(responseItem.uri),
        key,
      );
      if (!updatedList.some((f) => f.uri === decryptedUrl)) {
        updatedList.push({
          id: responseItem.id,
          organizationId: responseItem.organizationId,
          uri: decryptedUrl,
        } as PasswordHealthReportApplicationsResponse);
      }
    }

    this.criticalAppsListSubject.next(updatedList);
  }

  // Get the critical apps for a given organization
  setOrganizationId(orgId: OrganizationId) {
    this.organizationId.next(orgId);
  }

  // Drop a critical app for a given organization
  // Only one app may be dropped at a time
  async dropCriticalApp(orgId: OrganizationId, selectedUrl: string) {
    const app = this.criticalAppsListSubject.value.find(
      (f) => f.organizationId === orgId && f.uri === selectedUrl,
    );

    if (!app) {
      return;
    }

    await this.criticalAppsApiService.dropCriticalApp({
      organizationId: app.organizationId,
      passwordHealthReportApplicationIds: [app.id],
    });

    this.criticalAppsListSubject.next(
      this.criticalAppsListSubject.value.filter((f) => f.uri !== selectedUrl),
    );
  }

  private retrieveCriticalApps(
    orgId: OrganizationId | null,
  ): Observable<PasswordHealthReportApplicationsResponse[]> {
    if (orgId === null) {
      return of([]);
    }

    const result$ = zip(
      this.criticalAppsApiService.getCriticalApps(orgId),
      from(this.keyService.getOrgKey(orgId)),
    ).pipe(
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
    return await firstValueFrom(this.criticalAppsListSubject).then((criticalApps) => {
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
