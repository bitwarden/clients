import { Inject, Injectable } from "@angular/core";

// eslint-disable-next-line no-restricted-imports
import { mockCiphers } from "@bitwarden/bit-common/tools/reports/access-intelligence/services/ciphers.mock";
// eslint-disable-next-line no-restricted-imports
import { mockMemberCipherDetailsResponse } from "@bitwarden/bit-common/tools/reports/access-intelligence/services/member-cipher-details-response.mock";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { BadgeVariant } from "@bitwarden/components";

@Injectable()
export class PasswordHealthService {
  reportCiphers: CipherView[] = [];

  reportCipherIds: string[] = [];

  passwordStrengthMap = new Map<string, [string, BadgeVariant]>();

  passwordUseMap = new Map<string, number>();

  exposedPasswordMap = new Map<string, number>();

  totalMembersMap = new Map<string, number>();

  constructor(
    private passwordStrengthService: PasswordStrengthServiceAbstraction,
    private auditService: AuditService,
    private cipherService: CipherService,
    @Inject("organizationId") private organizationId: string,
  ) {}

  async generateReport() {
    let allCiphers = await this.cipherService.getAllFromApiForOrganization(this.organizationId);
    // TODO remove when actual user member data is available
    allCiphers = mockCiphers;
    allCiphers.forEach(async (cipher) => {
      this.findWeakPassword(cipher);
      this.findReusedPassword(cipher);
      await this.findExposedPassword(cipher);
    });

    // TODO - fetch actual user member when data is available
    mockMemberCipherDetailsResponse.data.forEach((user) => {
      user.cipherIds.forEach((cipherId: string) => {
        if (this.totalMembersMap.has(cipherId)) {
          this.totalMembersMap.set(cipherId, (this.totalMembersMap.get(cipherId) || 0) + 1);
        } else {
          this.totalMembersMap.set(cipherId, 1);
        }
      });
    });
  }

  async findExposedPassword(cipher: CipherView) {
    const { type, login, isDeleted, viewPassword, id } = cipher;
    if (
      type !== CipherType.Login ||
      login.password == null ||
      login.password === "" ||
      isDeleted ||
      !viewPassword
    ) {
      return;
    }

    const exposedCount = await this.auditService.passwordLeaked(login.password);
    if (exposedCount > 0) {
      this.exposedPasswordMap.set(id, exposedCount);
      this.checkForExistingCipher(cipher);
    }
  }

  findReusedPassword(cipher: CipherView) {
    const { type, login, isDeleted, viewPassword } = cipher;
    if (
      type !== CipherType.Login ||
      login.password == null ||
      login.password === "" ||
      isDeleted ||
      !viewPassword
    ) {
      return;
    }

    if (this.passwordUseMap.has(login.password)) {
      this.passwordUseMap.set(login.password, (this.passwordUseMap.get(login.password) || 0) + 1);
    } else {
      this.passwordUseMap.set(login.password, 1);
    }

    this.checkForExistingCipher(cipher);
  }

  findWeakPassword(cipher: CipherView): void {
    const { type, login, isDeleted, viewPassword } = cipher;
    if (
      type !== CipherType.Login ||
      login.password == null ||
      login.password === "" ||
      isDeleted ||
      !viewPassword
    ) {
      return;
    }

    const hasUserName = this.isUserNameNotEmpty(cipher);
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

    if (score != null && score <= 2) {
      this.passwordStrengthMap.set(cipher.id, this.scoreKey(score));
      this.checkForExistingCipher(cipher);
    }
  }

  private isUserNameNotEmpty(c: CipherView): boolean {
    return !Utils.isNullOrWhitespace(c.login.username);
  }

  private scoreKey(score: number): [string, BadgeVariant] {
    switch (score) {
      case 4:
        return ["strong", "success"];
      case 3:
        return ["good", "primary"];
      case 2:
        return ["weak", "warning"];
      default:
        return ["veryWeak", "danger"];
    }
  }

  private checkForExistingCipher(ciph: CipherView) {
    if (!this.reportCipherIds.includes(ciph.id)) {
      this.reportCipherIds.push(ciph.id);
      this.reportCiphers.push(ciph);
    }
  }

  groupCiphersByLoginUri(): CipherView[] {
    const cipherViews: CipherView[] = [];
    const cipherUris: string[] = [];
    const ciphers = this.reportCiphers;

    ciphers.forEach((ciph) => {
      const uris = ciph.login?.uris ?? [];
      uris.map((u: { uri: string }) => {
        const uri = Utils.getHostname(u.uri).replace("www.", "");
        if (!cipherUris.includes(uri)) {
          cipherUris.push(uri);
          cipherViews.push({ ...ciph, hostURI: uri } as CipherView & { hostURI: string });
        }
      });
    });

    return cipherViews;
  }
}
