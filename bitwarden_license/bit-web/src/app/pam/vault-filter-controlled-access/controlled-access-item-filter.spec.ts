import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { controlledAccessItemFilter } from "./controlled-access-item-filter";
import { ControlledAccessVaultFilterService } from "./controlled-access-vault-filter.service";

describe("controlledAccessItemFilter", () => {
  const OPTIONS = [{ id: "privileged", name: "Privileged", icon: "bwi-key" as const }];

  function setup() {
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => `t:${key}`);
    const filterService = mock<ControlledAccessVaultFilterService>();
    Object.assign(filterService, { stateOptions$: of(OPTIONS) });
    return { filterService, filter: controlledAccessItemFilter(i18nService, filterService) };
  }

  it("keys the chip controlledAccess and labels it", () => {
    const { filter } = setup();

    expect(filter.key).toBe("controlledAccess");
    expect(filter.label).toBe("t:controlledAccess");
  });

  it("offers the service's state options", async () => {
    const { filter } = setup();

    expect(await firstValueFrom(filter.options$)).toEqual(OPTIONS);
  });

  it("reads matches from the service for the rows it is given", async () => {
    const { filter, filterService } = setup();
    const rows = [{ id: "cipher-1" } as unknown as CipherViewLike];
    const matches = new Map([["privileged", new Set(["cipher-1" as CipherId])]]);
    filterService.matches$.mockReturnValue(of(matches));

    expect(await firstValueFrom(filter.matches$(rows))).toBe(matches);
    expect(filterService.matches$).toHaveBeenCalledWith(rows);
  });
});
