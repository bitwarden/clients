import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { VaultItemColumn, VaultItemColumnScope } from "@bitwarden/vault";

import { ControlledAccessVaultFilterService } from "../vault-filter-controlled-access/controlled-access-vault-filter.service";

import { ControlledAccessCellComponent } from "./controlled-access-cell.component";
import { controlledAccessColumn } from "./controlled-access-column";

describe("controlledAccessColumn", () => {
  let enabled$: BehaviorSubject<boolean>;
  let configService: { getFeatureFlag$: jest.Mock };
  let filterService: ReturnType<typeof mock<ControlledAccessVaultFilterService>>;
  let column: VaultItemColumn;

  const pamOrganization = { id: "org-pam", usePam: true } as Organization;
  const plainOrganization = { id: "org-plain", usePam: false } as Organization;

  const scope = (organizations: Organization[]): VaultItemColumnScope => ({
    vault: undefined,
    organizations,
  });

  beforeEach(() => {
    enabled$ = new BehaviorSubject(true);
    configService = { getFeatureFlag$: jest.fn(() => enabled$) };
    filterService = mock<ControlledAccessVaultFilterService>();
    column = controlledAccessColumn(
      { t: (key: string) => `t:${key}` } as I18nService,
      configService as unknown as ConfigService,
      filterService,
    );
  });

  it("keeps the column's existing ID, label, and cell", () => {
    expect(column.key).toBe("controlledAccess");
    expect(column.label).toBe("t:controlledAccess");
    expect(column.component).toBe(ControlledAccessCellComponent);
  });

  describe("visible$", () => {
    it("shows while the flag is on and an organization in scope uses PAM", async () => {
      expect(
        await firstValueFrom(column.visible$(scope([plainOrganization, pamOrganization]))),
      ).toBe(true);
      expect(configService.getFeatureFlag$).toHaveBeenCalledWith(FeatureFlag.Pam);
    });

    it("hides when no organization in scope uses PAM", async () => {
      expect(await firstValueFrom(column.visible$(scope([plainOrganization])))).toBe(false);
      expect(await firstValueFrom(column.visible$(scope([])))).toBe(false);
    });

    it("hides while the flag is off", async () => {
      enabled$.next(false);

      expect(await firstValueFrom(column.visible$(scope([pamOrganization])))).toBe(false);
    });

    it("follows the flag live", () => {
      const seen: boolean[] = [];
      const subscription = column.visible$(scope([pamOrganization])).subscribe((v) => seen.push(v));

      enabled$.next(false);
      subscription.unsubscribe();

      expect(seen).toEqual([true, false]);
    });
  });

  describe("sortRanks$", () => {
    it("delegates the same row array to the filter service, so its cache is shared", async () => {
      const ciphers = [{ id: "a" }, { id: "b" }] as CipherViewLike[];
      filterService.sortRanks$.mockReturnValue(of(new Map([["a", 0]])));

      const ranks = await firstValueFrom(column.sortRanks$!(ciphers));

      expect(filterService.sortRanks$.mock.calls[0][0]).toBe(ciphers);
      expect([...ranks]).toEqual([["a", 0]]);
    });
  });
});
