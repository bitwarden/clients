import { AbstractControl, FormControl, ValidationErrors } from "@angular/forms";
import { lastValueFrom, Observable, of } from "rxjs";

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
    const validator = freeOrgCollectionLimitValidator(of(orgs), of([]), i18nService);
    const control = new FormControl("org-id");

    const result: Observable<ValidationErrors> = validator(control) as Observable<ValidationErrors>;

    const value = await lastValueFrom(result);
    expect(value).toBeNull();
  });

  it("returns null if control is not an instance of FormControl", async () => {
    const validator = freeOrgCollectionLimitValidator(of([]), of([]), i18nService);
    const control = {} as AbstractControl;

    const result: Observable<ValidationErrors | null> = validator(
      control,
    ) as Observable<ValidationErrors>;

    const value = await lastValueFrom(result);
    expect(value).toBeNull();
  });

  it("returns null if control is not provided", async () => {
    const validator = freeOrgCollectionLimitValidator(of([]), of([]), i18nService);

    const result: Observable<ValidationErrors | null> = validator(
      undefined as any,
    ) as Observable<ValidationErrors>;

    const value = await lastValueFrom(result);
    expect(value).toBeNull();
  });

  it("returns null if organization has not reached collection limit (Observable)", async () => {
    const org = { id: "org-id", maxCollections: 2 } as Organization;
    const collections = [{ organizationId: "org-id" } as Collection];
    const validator = freeOrgCollectionLimitValidator(of([org]), of(collections), i18nService);
    const control = new FormControl("org-id");

    const result$ = validator(control) as Observable<ValidationErrors | null>;

    const value = await lastValueFrom(result$);
    expect(value).toBeNull();
  });

  it("returns error if organization has reached collection limit (Observable)", async () => {
    const org = { id: "org-id", maxCollections: 1 } as Organization;
    const collections = [{ organizationId: "org-id" } as Collection];
    const validator = freeOrgCollectionLimitValidator(of([org]), of(collections), i18nService);
    const control = new FormControl("org-id");

    const result$ = validator(control) as Observable<ValidationErrors | null>;

    const value = await lastValueFrom(result$);
    expect(value).toEqual({
      cannotCreateCollections: { message: "cannotCreateCollection" },
    });
  });
});
