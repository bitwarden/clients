import { Injectable } from "@angular/core";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";

import { MemberCipherDetailsApiService } from "./member-cipher-details-api.service";

export interface ApplicationHealthReport {
  details: ApplicationHealthReportDetail[];
  totalAtRiskMembers: number;
  totalMembers: number;
  totalAtRiskApps: number;
  totalApps: number;
}

interface ApplicationHealthReportDetail {
  application: string;
  atRiskPasswords: number;
  totalPasswords: number;
  atRiskMembers: number;
  totalMembers: number;
}

@Injectable()
export class PasswordHealthService {
  reportCiphers: CipherView[] = [];

  reportCipherIds: string[] = [];

  usedPasswords: string[] = [];

  applicationHealthReport: ApplicationHealthReportDetail[] = [];

  constructor(
    private passwordStrengthService: PasswordStrengthServiceAbstraction,
    private auditService: AuditService,
    private cipherService: CipherService,
    private memberCipherDetailsApiService: MemberCipherDetailsApiService,
  ) {}

  async generateReportDetails(organizationId: string): Promise<ApplicationHealthReport> {
    // Helper function to normalize hostnames to TLDs
    const hostnameToTLD = (uriView: LoginUriView): string => {
      const match = uriView.hostname.match(/([^.]+\.[^.]+)$/);
      return match ? match[1] : uriView.hostname;
    };

    const members = await this.memberCipherDetailsApiService.getMemberCipherDetails(organizationId);

    const ciphers = await this.cipherService.getAllFromApiForOrganization(organizationId);

    // Map to store application data
    const appDataMap = new Map<string, ApplicationHealthReportDetail>();

    // Map cipher IDs to ciphers
    const cipherMap = new Map<string, CipherView>(ciphers.map((cipher) => [cipher.id, cipher]));

    // Set to store at-risk member IDs
    const totalAtRiskMembers = new Set<string>();

    // Set to store at-risk app IDs
    const totalAtRiskApps = new Set<string>();

    // Set to store at-risk cipher IDs
    const atRiskCipherIds = new Set<string>();

    const reusedPasswords = this.getReusedPasswords(ciphers);

    // Determine at-risk ciphers
    for (const cipher of ciphers) {
      const isReused = reusedPasswords.has(cipher.login.password);
      const isWeak = this.isWeakPassword(cipher);
      const isExposed = await this.isExposedPassword(cipher);
      if (isWeak || isReused || isExposed) {
        atRiskCipherIds.add(cipher.id);
      }
    }

    // Group ciphers by application
    for (const cipher of ciphers) {
      const applications = new Set(cipher.login.uris.map(hostnameToTLD));

      for (const app of applications) {
        if (!appDataMap.has(app)) {
          appDataMap.set(app, {
            application: app,
            atRiskPasswords: 0,
            totalPasswords: 0,
            atRiskMembers: 0,
            totalMembers: 0,
          });
        }

        const appData = appDataMap.get(app)!;
        appData.totalPasswords += 1;

        if (atRiskCipherIds.has(cipher.id)) {
          appData.atRiskPasswords += 1;
        }
      }
    }

    // Associate members with applications
    for (const member of members) {
      const memberApps = new Set<string>();
      const atRiskApps = new Set<string>();

      for (const cipherId of member.cipherIds) {
        const cipher = cipherMap.get(cipherId);
        if (!cipher) {
          continue;
        }

        const applications = new Set(cipher.login.uris.map(hostnameToTLD));

        for (const app of applications) {
          memberApps.add(app);
          if (atRiskCipherIds.has(cipherId)) {
            atRiskApps.add(app);
          }
        }
      }

      for (const app of memberApps) {
        const appData = appDataMap.get(app);
        if (appData) {
          appData.totalMembers += 1;
        }
      }

      for (const app of atRiskApps) {
        const appData = appDataMap.get(app);
        if (appData) {
          if (!totalAtRiskMembers.has(member.userName)) {
            totalAtRiskMembers.add(member.userName);
          }
          if (!totalAtRiskApps.has(app)) {
            totalAtRiskApps.add(app);
          }
          appData.atRiskMembers += 1;
        }
      }
    }

    return {
      totalAtRiskMembers: totalAtRiskMembers.size,
      totalMembers: members.length,
      totalAtRiskApps: totalAtRiskApps.size,
      totalApps: appDataMap.size,
      details: Array.from(appDataMap.values()),
    };
  }

  getReusedPasswords(ciphers: CipherView[]): Set<string> {
    const seenPasswords = new Set<string>();
    const reusedPasswords = new Set<string>();

    for (const cipher of ciphers) {
      if (this.isValidPassword(cipher)) {
        const password = cipher.login.password;
        if (seenPasswords.has(password)) {
          reusedPasswords.add(password);
        } else {
          seenPasswords.add(password);
        }
      }
    }

    return reusedPasswords;
  }

  isValidPassword(cipher: CipherView) {
    const { type, login, isDeleted, viewPassword } = cipher;
    return (
      type === CipherType.Login &&
      login.password != null &&
      login.password !== "" &&
      !isDeleted &&
      viewPassword
    );
  }

  async isExposedPassword(cipher: CipherView) {
    if (!this.isValidPassword(cipher)) {
      return false;
    }

    const exposedCount = await this.auditService.passwordLeaked(cipher.login.password);
    return exposedCount > 0;
  }

  isWeakPassword(cipher: CipherView) {
    if (!this.isValidPassword(cipher)) {
      return false;
    }

    const { login } = cipher;

    const hasUserName = !Utils.isNullOrWhitespace(cipher.login.username);
    let userInput: string[] = [];
    if (hasUserName) {
      const atPosition = login.username.indexOf("@");
      if (atPosition > -1) {
        userInput = userInput
          .concat(
            login.username
              .substring(0, atPosition)
              .trim()
              .toLowerCase()
              .split(/[^A-Za-z0-9]/),
          )
          .filter((i) => i.length >= 3);
      } else {
        userInput = login.username
          .trim()
          .toLowerCase()
          .split(/[^A-Za-z0-9]/)
          .filter((i) => i.length >= 3);
      }
    }
    const { score } = this.passwordStrengthService.getPasswordStrength(
      login.password,
      null,
      userInput.length > 0 ? userInput : null,
    );

    return score != null && score <= 2;
  }
}
