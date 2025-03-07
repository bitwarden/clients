import { FormControl } from "@angular/forms";
import { lastValueFrom, of } from "rxjs";

import { Collection } from "@bitwarden/admin-console/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { freeOrgCollectionLimitValidator } from "./free-org-collection-limit.validator";

describe("freeOrgCollectionLimitValidator", () => {
  let i18nService: I18nService;

  beforeEach(() => {
    i18nService = {
      t: (key: string) => key,
    } as any;
  });

  it("returns null if organization is not found", async () => {
    const orgs: Organization[] = [];
    const validator = freeOrgCollectionLimitValidator(of(orgs), [], i18nService);
    const control = new FormControl("org-id");

    const result = validator(control);

    if (result instanceof Promise) {
      await expect(result).resolves.toBeNull();
    } else {
      const value = await lastValueFrom(result);
      expect(value).toBeNull();
    }
  });

  it("returns null if organization has not reached collection limit", async () => {
    const org = { id: "org-id", maxCollections: 2 } as Organization;
    const collections = [{ organizationId: "org-id" } as Collection];
    const validator = freeOrgCollectionLimitValidator(of([org]), collections, i18nService);
    const control = new FormControl("org-id");

    const result = validator(control);

    if (result instanceof Promise) {
      await expect(result).resolves.toBeNull();
    } else {
      const value = await lastValueFrom(result);
      expect(value).toBeNull();
    }
  });

  it("returns error if organization has reached collection limit", async () => {
    const org = { id: "org-id", maxCollections: 1 } as Organization;
    const collections = [{ organizationId: "org-id" } as Collection];
    const validator = freeOrgCollectionLimitValidator(of([org]), collections, i18nService);
    const control = new FormControl("org-id");

    const result = validator(control);

    if (result instanceof Promise) {
      await expect(result).resolves.toEqual({
        cannotCreateCollections: { message: "cannotCreateCollection" },
      });
    } else {
      result.subscribe((value) =>
        expect(value).toEqual({
          cannotCreateCollections: { message: "cannotCreateCollection" },
        }),
      );
    }
  });
});
