import {
  BehaviorSubject,
  first,
  firstValueFrom,
  forkJoin,
  from,
  map,
  Observable,
  of,
  Subject,
  switchMap,
  takeUntil,
  zip,
} from "rxjs";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import {
  PasswordHealthReportApplicationsRequest,
  PasswordHealthReportApplicationsResponse,
} from "../models/password-health";

import { CriticalAppsApiService } from "./critical-apps-api.service";

/* Retrieves and decrypts critical apps for a given organization
 *  Encrypts and saves data for a given organization
 */
export class CriticalAppsService {
  private orgId = new BehaviorSubject<OrganizationId | null>(null);
  private criticalAppsList = new BehaviorSubject<PasswordHealthReportApplicationsResponse[]>([]);
  private teardown = new Subject<void>();

  private fetchOrg$ = this.orgId
    .pipe(
      switchMap((orgId) => this.retrieveCriticalApps(orgId)),
      takeUntil(this.teardown),
    )
    .subscribe((apps) => this.criticalAppsList.next(apps));

  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private criticalAppsApiService: CriticalAppsApiService,
  ) {}

  // Get a list of critical apps for a given organization
  getAppsListForOrg(orgId: string): Observable<PasswordHealthReportApplicationsResponse[]> {
    return this.criticalAppsList
      .asObservable()
      .pipe(map((apps) => apps.filter((app) => app.organizationId === orgId)));
  }

  // Reset the critical apps list
  setAppsInListForOrg(apps: PasswordHealthReportApplicationsResponse[]) {
    this.criticalAppsList.next(apps);
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
    const updatedList = [...this.criticalAppsList.value];
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
    this.criticalAppsList.next(updatedList);
  }

  // Get the critical apps for a given organization
  setOrganizationId(orgId: OrganizationId) {
    this.orgId.next(orgId);
  }

  // Drop a critical app for a given organization
  // Only one app may be dropped at a time
  async dropCriticalApp(orgId: OrganizationId, selectedUrl: string) {
    const app = this.criticalAppsList.value.find(
      (f) => f.organizationId === orgId && f.uri === selectedUrl,
    );

    if (!app) {
      return;
    }

    await this.criticalAppsApiService.dropCriticalApp({
      organizationId: app.organizationId,
      passwordHealthReportApplicationIds: [app.id],
    });

    this.criticalAppsList.next(this.criticalAppsList.value.filter((f) => f.uri !== selectedUrl));
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
    return await firstValueFrom(this.criticalAppsList).then((criticalApps) => {
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
