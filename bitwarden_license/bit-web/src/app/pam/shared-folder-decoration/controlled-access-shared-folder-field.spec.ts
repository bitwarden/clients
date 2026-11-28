import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import {
  CollectionTypes,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { BitwardenIcon } from "@bitwarden/components";
import { SharedFolderOptionDecorator, Vfo1TerminologyService } from "@bitwarden/vault";

import { ControlledAccessSharedFolderField } from "./controlled-access-shared-folder-field";
import { ControlledAccessSharedFolderHintComponent } from "./controlled-access-shared-folder-hint.component";

describe("ControlledAccessSharedFolderField", () => {
  let enabled$: BehaviorSubject<boolean>;
  let configService: ReturnType<typeof mock<ConfigService>>;
  let vfo1: ReturnType<typeof mock<Vfo1TerminologyService>>;
  let field: ControlledAccessSharedFolderField;

  const pamOrg = { usePam: true } as Organization;

  function folder(
    hasEnabledAccessRule: boolean,
    type: CollectionView["type"] = CollectionTypes.SharedCollection,
  ): CollectionView {
    return { name: "Production", hasEnabledAccessRule, type } as CollectionView;
  }

  async function decorator(org = pamOrg): Promise<SharedFolderOptionDecorator | null> {
    return await firstValueFrom(field.decorator$(org));
  }

  beforeEach(() => {
    enabled$ = new BehaviorSubject<boolean>(true);
    configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(enabled$);
    vfo1 = mock<Vfo1TerminologyService>();
    vfo1.iconClass.mockImplementation((icon: BitwardenIcon) => icon);

    TestBed.configureTestingModule({
      providers: [
        ControlledAccessSharedFolderField,
        { provide: ConfigService, useValue: configService },
        { provide: Vfo1TerminologyService, useValue: vfo1 },
      ],
    });
    field = TestBed.inject(ControlledAccessSharedFolderField);
  });

  it("reads PAM's flag", async () => {
    await decorator();

    expect(configService.getFeatureFlag$).toHaveBeenCalledWith(FeatureFlag.Pam);
  });

  it("hints with the controlled access hint", () => {
    expect(field.hint).toBe(ControlledAccessSharedFolderHintComponent);
  });

  it("leaves the field plain while PAM's flag is off", async () => {
    enabled$.next(false);

    expect(await decorator()).toBeNull();
  });

  it("leaves the field plain for an organization without PAM", async () => {
    expect(await decorator({ usePam: false } as Organization)).toBeNull();
  });

  it("marks a folder under controlled access with the lock and leaves its name alone", async () => {
    const decorate = (await decorator())!;

    const decoration = decorate(folder(true));
    expect(decoration).toEqual({
      icon: "bwi-lock-encrypted",
      iconTile: { icon: "bwi-lock-encrypted", variant: "brand" },
    });
    expect(decoration).not.toHaveProperty("listName");
    expect(decoration).not.toHaveProperty("labelName");
  });

  it("gives any other shared folder the plain shared folder tile and leaves its name alone", async () => {
    const decorate = (await decorator())!;

    expect(decorate(folder(false))).toEqual({
      icon: "bwi-collection-shared",
      iconTile: { icon: "bwi-collection-shared", variant: "gray" },
    });
  });

  it("follows the shared folder terminology for the plain icon", async () => {
    vfo1.iconClass.mockReturnValue("bwi-shared-folder");
    const decorate = (await decorator())!;

    expect(decorate(folder(false))?.icon).toBe("bwi-shared-folder");
  });

  it("gives the member's default collection the user tile", async () => {
    const decorate = (await decorator())!;

    expect(decorate(folder(false, CollectionTypes.DefaultUserCollection))?.icon).toBe("bwi-user");
  });
});
