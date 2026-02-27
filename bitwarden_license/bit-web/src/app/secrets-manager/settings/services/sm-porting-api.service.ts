// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { filter, firstValueFrom, map, Subject, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import { SecretsManagerImportError } from "../models/error/sm-import-error";
import { SecretsManagerImportRequest } from "../models/requests/sm-import.request";
import { SecretsManagerImportedProjectRequest } from "../models/requests/sm-imported-project.request";
import { SecretsManagerImportedSecretRequest } from "../models/requests/sm-imported-secret.request";
import { SecretsManagerExportResponse } from "../models/responses/sm-export.response";
import {
  SecretsManagerExport,
  SecretsManagerExportProject,
  SecretsManagerExportSecret,
} from "../models/sm-export";

@Injectable({
  providedIn: "root",
})
export class SecretsManagerPortingApiService {
  protected _imports = new Subject<SecretsManagerImportRequest>();
  imports$ = this._imports.asObservable();

  constructor(
    private apiService: ApiService,
    private encryptService: EncryptService,
    private keyService: KeyService,
    private accountService: AccountService,
  ) {}

  private getOrganizationKey$(organizationId: string) {
    return this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.keyService.orgKeys$(userId)),
      filter((orgKeys) => !!orgKeys),
      map((organizationKeysById) => organizationKeysById[organizationId as OrganizationId]),
    );
  }

  private async getOrganizationKey(organizationId: string): Promise<SymmetricCryptoKey> {
    return await firstValueFrom(this.getOrganizationKey$(organizationId));
  }

  async export(organizationId: string): Promise<string> {
    const response = await this.apiService.send(
      "GET",
      "/sm/" + organizationId + "/export",
      null,
      true,
      true,
    );

    return JSON.stringify(
      await this.decryptExport(organizationId, new SecretsManagerExportResponse(response)),
      null,
      "  ",
    );
  }

  async import(organizationId: string, fileContents: string): Promise<void> {
    let requestObject = {};

    try {
      requestObject = JSON.parse(fileContents);
      const requestBody = await this.encryptImport(organizationId, requestObject);

      await this.apiService.send(
        "POST",
        "/sm/" + organizationId + "/import",
        requestBody,
        true,
        true,
      );

      this._imports.next(requestBody);
    } catch (error) {
      const errorResponse = new ErrorResponse(error, 400);
      throw this.handleServerError(errorResponse, requestObject);
    }
  }

  private async encryptImport(
    organizationId: string,
    importData: any,
  ): Promise<SecretsManagerImportRequest> {
    const encryptedImport = new SecretsManagerImportRequest();

    try {
      const orgKey = await this.getOrganizationKey(organizationId);
      encryptedImport.projects = [];
      encryptedImport.secrets = [];

      encryptedImport.projects = await Promise.all(
        importData.projects.map(async (p: any) => {
          const project = new SecretsManagerImportedProjectRequest();
          project.id = p.id;
          project.name = await this.encryptService.encryptString(p.name, orgKey);
          return project;
        }),
      );

      encryptedImport.secrets = await Promise.all(
        importData.secrets.map(async (s: any) => {
          const secret = new SecretsManagerImportedSecretRequest();

          [secret.key, secret.value, secret.note] = await Promise.all([
            this.encryptService.encryptString(s.key, orgKey),
            this.encryptService.encryptString(s.value, orgKey),
            this.encryptService.encryptString(s.note, orgKey),
          ]);

          secret.id = s.id;
          secret.projectIds = s.projectIds;

          return secret;
        }),
      );
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return null;
    }

    return encryptedImport;
  }

  private async decryptExport(
    organizationId: string,
    exportData: SecretsManagerExportResponse,
  ): Promise<SecretsManagerExport> {
    const orgKey = await this.getOrganizationKey(organizationId);
    const decryptedExport = new SecretsManagerExport();
    decryptedExport.projects = [];
    decryptedExport.secrets = [];

    decryptedExport.projects = await Promise.all(
      exportData.projects.map(async (p) => {
        const project = new SecretsManagerExportProject();
        project.id = p.id;
        project.name = await this.encryptService.decryptString(new EncString(p.name), orgKey);
        return project;
      }),
    );

    decryptedExport.secrets = await Promise.all(
      exportData.secrets.map(async (s) => {
        const secret = new SecretsManagerExportSecret();

        [secret.key, secret.value, secret.note] = await Promise.all([
          this.encryptService.decryptString(new EncString(s.key), orgKey),
          this.encryptService.decryptString(new EncString(s.value), orgKey),
          this.encryptService.decryptString(new EncString(s.note), orgKey),
        ]);

        secret.id = s.id;
        secret.projectIds = s.projectIds;

        return secret;
      }),
    );

    return decryptedExport;
  }

  private handleServerError(
    errorResponse: ErrorResponse,
    importResult: any,
  ): SecretsManagerImportError {
    if (errorResponse.validationErrors == null) {
      return new SecretsManagerImportError(errorResponse.message);
    }

    const result = new SecretsManagerImportError();
    result.lines = [];

    Object.entries(errorResponse.validationErrors).forEach(([key, value], index) => {
      let item;
      let itemType;
      const id = Number(key.match(/[0-9]+/)[0]);

      switch (key.match(/^[$\\.]*(\w+)/)[1].toLowerCase()) {
        case "projects":
          item = importResult.projects[id];
          itemType = "Project";
          break;
        case "secrets":
          item = importResult.secrets[id];
          itemType = "Secret";
          break;
        default:
          return;
      }

      result.lines.push({
        id: id + 1,
        type: itemType === "Project" ? "Project" : "Secret",
        key: itemType === "Project" ? item.name : item.key,
        errorMessage: value.length > 0 ? value[0] : "",
      });
    });

    return result;
  }
}
