import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { Guid } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

@Injectable({
  providedIn: "root",
})
export class CriticalAppsApiService {
  private criticalAppsList = new BehaviorSubject<PasswordHealthReportApplicationsResponse[]>([]);

  constructor(
    private apiService: ApiService,
    private keyService: KeyService,
    private encryptService: EncryptService,
  ) {}

  get criticalApps$(): Observable<PasswordHealthReportApplicationsResponse[]> {
    return this.criticalAppsList.asObservable();
  }

  set criticalApps(value: PasswordHealthReportApplicationsResponse[]) {
    this.criticalAppsList.next(value);
  }

  async setCriticalApps(orgId: string, selectedUrls: string[]) {
    const key = await this.keyService.getOrgKey(orgId);

    // only save records that are not already in the database
    const newEntries = Array.from(selectedUrls).filter((url) => {
      return !this.criticalAppsList.value.some((r) => r.uri === url);
    });

    const criticalAppsPromises = newEntries.map(async (url) => {
      const encryptedUrlName = await this.encryptService.encrypt(url, key);
      return {
        organizationId: orgId,
        url: encryptedUrlName.encryptedString.toString(),
      } as PasswordHealthReportApplicationsRequest;
    });

    const criticalAppsRequests = await Promise.all(criticalAppsPromises);

    await this.apiService
      .send(
        "POST",
        "/reports/password-health-report-applications/",
        criticalAppsRequests,
        true,
        true,
      )
      .then((result: PasswordHealthReportApplicationsResponse[]) => {
        result.forEach(async (r) => {
          const decryptedUrl = await this.encryptService.decryptToUtf8(new EncString(r.uri), key);
          if (!this.criticalAppsList.value.some((f) => f.uri === decryptedUrl)) {
            this.criticalAppsList.value.push({
              id: r.id,
              organizationId: r.organizationId,
              uri: decryptedUrl,
            } as PasswordHealthReportApplicationsResponse);
          }
        });
      });
  }

  async getCriticalApps(orgId: string): Promise<PasswordHealthReportApplicationsResponse[]> {
    const response = await this.apiService.send(
      "GET",
      `/reports/password-health-report-applications/${orgId}`,
      null,
      true,
      true,
    );

    this.criticalAppsList.next([]);
    const key = await this.keyService.getOrgKey(orgId);

    await Promise.all(
      response.map(async (r: { id: any; organizationId: any; uri: any }) => {
        const decryptedUrl = await this.encryptService.decryptToUtf8(new EncString(r.uri), key);
        this.criticalAppsList.value.push({
          id: r.id,
          organizationId: r.organizationId,
          uri: decryptedUrl,
        } as PasswordHealthReportApplicationsResponse);
      }),
    );

    return this.criticalAppsList.value;
  }
}

export interface PasswordHealthReportApplicationsRequest {
  organizationId: Guid;
  url: string;
}

export interface PasswordHealthReportApplicationsResponse {
  id: Guid;
  organizationId: Guid;
  uri: string;
}
