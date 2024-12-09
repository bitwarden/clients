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
import { Opaque } from "type-fest";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

/* Retrieves and decrypts critical apps for a given organization
 *  Encrypts and saves data for a given organization
 */
export class CriticalAppsApiService {
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
    private apiService: ApiService,
    private keyService: KeyService,
    private encryptService: EncryptService,
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

    // only save records that are not already in the database
    const newEntries = await this.filterNewEntries(orgId as OrganizationId, selectedUrls);
    const criticalAppsRequests = await this.encryptNewEntries(
      orgId as OrganizationId,
      key,
      newEntries,
    );

    // save the new entries to the database
    const dbResponse = await this.apiService.send(
      "POST",
      "/reports/password-health-report-applications/",
      criticalAppsRequests,
      true,
      true,
    );

    // add the new entries to the criticalAppsList
    const updatedList = [...this.criticalAppsList.value];
    for (const responseItem of dbResponse) {
      const decryptedUrl = await this.encryptService.decryptToUtf8(
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

  private retrieveCriticalApps(
    orgId: OrganizationId | null,
  ): Observable<PasswordHealthReportApplicationsResponse[]> {
    if (orgId === null) {
      return of([]);
    }

    const result$ = zip(
      from(
        this.apiService.send(
          "GET",
          `/reports/password-health-report-applications/${orgId.toString()}`,
          null,
          true,
          true,
        ),
      ),
      from(this.keyService.getOrgKey(orgId)),
    ).pipe(
      switchMap(([response, key]) => {
        const results = response.map(async (r: PasswordHealthReportApplicationsResponse) => {
          const encrypted = new EncString(r.uri);
          const uri = await this.encryptService.decryptToUtf8(encrypted, key);
          return { id: r.id, organizationId: r.organizationId, uri: uri };
        });
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
      const encryptedUrlName = await this.encryptService.encrypt(url, key);
      return {
        organizationId: orgId,
        url: encryptedUrlName.encryptedString.toString(),
      } as PasswordHealthReportApplicationsRequest;
    });

    return await Promise.all(criticalAppsPromises);
  }
}

export interface PasswordHealthReportApplicationsRequest {
  organizationId: OrganizationId;
  url: string;
}

export interface PasswordHealthReportApplicationsResponse {
  id: PasswordHealthReportApplicationId;
  organizationId: OrganizationId;
  uri: string;
}

export type PasswordHealthReportApplicationId = Opaque<string, "PasswordHealthReportApplicationId">;
