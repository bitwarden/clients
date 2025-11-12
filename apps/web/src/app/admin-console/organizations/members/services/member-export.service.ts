import { Injectable } from "@angular/core";
import * as papa from "papaparse";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { OrganizationUserView } from "../../core/views/organization-user.view";

import { MemberExport } from "./member.export";

@Injectable({
  providedIn: "root",
})
export class MemberExportService {
  constructor(private i18nService: I18nService) {}

  getMemberExport(members: OrganizationUserView[]): string {
    const exportData = members.map((m) => new MemberExport(m, this.i18nService));

    const headers: { [key in keyof MemberExport]: string } = {
      email: "Email",
      name: "Name",
      status: "Status",
      role: "Role",
      twoStepLogin: "Two-step Login",
      accountRecovery: "Account Recovery",
      secretsManager: "Secrets Manager",
      groups: "Groups",
    };

    const mappedData = exportData.map((item) => {
      const mappedItem: { [key: string]: string } = {};
      for (const key in item) {
        if (headers[key as keyof MemberExport]) {
          mappedItem[headers[key as keyof MemberExport]] = String(item[key as keyof MemberExport]);
        }
      }
      return mappedItem;
    });

    return papa.unparse(mappedData);
  }

  getFileName(prefix: string = null, extension = "csv"): string {
    const now = new Date();
    const dateString =
      now.getFullYear() +
      "" +
      this.padNumber(now.getMonth() + 1, 2) +
      "" +
      this.padNumber(now.getDate(), 2) +
      this.padNumber(now.getHours(), 2) +
      "" +
      this.padNumber(now.getMinutes(), 2) +
      this.padNumber(now.getSeconds(), 2);

    return "bitwarden" + (prefix ? "_" + prefix : "") + "_export_" + dateString + "." + extension;
  }

  private padNumber(num: number, width: number, padCharacter = "0"): string {
    const numString = num.toString();
    return numString.length >= width
      ? numString
      : new Array(width - numString.length + 1).join(padCharacter) + numString;
  }
}
