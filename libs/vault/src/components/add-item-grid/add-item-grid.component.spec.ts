import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";

import {
  NewItemTypesAnnouncementService,
  NewItemTypesBadges,
} from "../../services/new-item-types-announcement.service";
import { Vfo1TerminologyService } from "../../services/vfo1-terminology.service";

import { AddItemGridComponent, AddItemGridResult } from "./add-item-grid.component";

const userId = "user-id" as UserId;
const badges$ = new BehaviorSubject<NewItemTypesBadges>({ userId, types: [] });
const badge = (...types: CipherType[]) => badges$.next({ userId, types });
const newItemTypesAnnouncementMock = {
  badges$,
  dismissBadges: jest.fn(),
};

describe("AddItemGridComponent", () => {
  let component: AddItemGridComponent;
  let fixture: ComponentFixture<AddItemGridComponent>;

  const restricted$ = new BehaviorSubject<any[]>([]);
  const vfo1Enabled = signal(false);

  beforeEach(async () => {
    restricted$.next([]);
    vfo1Enabled.set(false);
    badge();
    newItemTypesAnnouncementMock.dismissBadges.mockClear();

    await TestBed.configureTestingModule({
      imports: [AddItemGridComponent, NoopAnimationsModule],
      providers: [
        { provide: NewItemTypesAnnouncementService, useValue: newItemTypesAnnouncementMock },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        {
          provide: RestrictedItemTypesService,
          useValue: { restricted$ },
        },
        {
          provide: Vfo1TerminologyService,
          useValue: { iconClass: (icon: string) => icon, enabled: vfo1Enabled },
        },
      ],
    }).compileComponents();
  });

  function createComponent(inputs: {
    canCreateCipher?: boolean;
    canCreateFolder: boolean;
    canCreateCollection: boolean;
    canCreateSshKey: boolean;
  }) {
    fixture = TestBed.createComponent(AddItemGridComponent);
    component = fixture.componentInstance;
    if (inputs.canCreateCipher !== undefined) {
      fixture.componentRef.setInput("canCreateCipher", inputs.canCreateCipher);
    }
    fixture.componentRef.setInput("canCreateFolder", inputs.canCreateFolder);
    fixture.componentRef.setInput("canCreateCollection", inputs.canCreateCollection);
    fixture.componentRef.setInput("canCreateSshKey", inputs.canCreateSshKey);
    fixture.detectChanges();
  }

  it("renders all cipher types when unrestricted and canCreateSshKey=true", () => {
    createComponent({
      canCreateFolder: false,
      canCreateCollection: false,
      canCreateSshKey: true,
    });

    const items = component["items"]();
    expect(items.length).toBe(8);
    expect(items.map((i) => i.labelKey)).toEqual(
      expect.arrayContaining([
        "typeLogin",
        "typeCard",
        "typeBankAccount",
        "typeIdentity",
        "typeDriversLicense",
        "typePassport",
        "typeSecureNote",
        "typeSshKey",
      ]),
    );
  });

  it("hides SSH key when canCreateSshKey=false", () => {
    createComponent({
      canCreateFolder: false,
      canCreateCollection: false,
      canCreateSshKey: false,
    });

    const items = component["items"]();
    expect(items.map((i) => i.labelKey)).not.toContain("typeSshKey");
  });

  it("hides all cipher types when canCreateCipher=false, e.g. because the organization is suspended", () => {
    createComponent({
      canCreateCipher: false,
      canCreateFolder: true,
      canCreateCollection: true,
      canCreateSshKey: true,
    });

    const items = component["items"]();
    expect(items.map((i) => i.labelKey)).not.toEqual(
      expect.arrayContaining(["typeLogin", "typeCard", "typeSshKey"]),
    );
    expect(items.map((i) => i.labelKey)).toEqual(expect.arrayContaining(["folder", "collection"]));
  });

  it("shows folder when canCreateFolder=true", () => {
    createComponent({
      canCreateFolder: true,
      canCreateCollection: false,
      canCreateSshKey: false,
    });

    const items = component["items"]();
    expect(items.map((i) => i.labelKey)).toContain("folder");
  });

  it("hides folder when canCreateFolder=false", () => {
    createComponent({
      canCreateFolder: false,
      canCreateCollection: false,
      canCreateSshKey: false,
    });

    const items = component["items"]();
    expect(items.map((i) => i.labelKey)).not.toContain("folder");
  });

  it("shows collection when canCreateCollection=true", () => {
    createComponent({
      canCreateFolder: false,
      canCreateCollection: true,
      canCreateSshKey: false,
    });

    const items = component["items"]();
    expect(items.map((i) => i.labelKey)).toContain("collection");
  });

  it("labels the collection tile as a shared folder when the VFO1 terminology flag is on", () => {
    vfo1Enabled.set(true);

    createComponent({
      canCreateFolder: false,
      canCreateCollection: true,
      canCreateSshKey: false,
    });

    const items = component["items"]();
    expect(items.map((i) => i.labelKey)).toContain("sharedFolder");
    expect(items.map((i) => i.labelKey)).not.toContain("collection");
  });

  it("hides collection when canCreateCollection=false", () => {
    createComponent({
      canCreateFolder: false,
      canCreateCollection: false,
      canCreateSshKey: false,
    });

    const items = component["items"]();
    expect(items.map((i) => i.labelKey)).not.toContain("collection");
  });

  it("excludes restricted cipher types", () => {
    createComponent({
      canCreateFolder: false,
      canCreateCollection: false,
      canCreateSshKey: true,
    });

    restricted$.next([{ cipherType: CipherType.Login, allowViewOrgIds: [] } as any]);
    fixture.detectChanges();

    const items = component["items"]();
    expect(items.map((i) => i.labelKey)).not.toContain("typeLogin");
  });

  it("emits itemSelected with cipher result when a cipher type is selected", () => {
    createComponent({
      canCreateFolder: false,
      canCreateCollection: false,
      canCreateSshKey: true,
    });

    const itemSelected = jest.fn();
    component.itemSelected.subscribe(itemSelected);

    const loginItem = component["items"]().find((i) => i.labelKey === "typeLogin");
    loginItem!.action();

    expect(itemSelected).toHaveBeenCalledWith({
      result: AddItemGridResult.Cipher,
      cipherType: CipherType.Login,
    });
  });

  it("emits itemSelected with folder result when folder is selected", () => {
    createComponent({
      canCreateFolder: true,
      canCreateCollection: false,
      canCreateSshKey: false,
    });

    const itemSelected = jest.fn();
    component.itemSelected.subscribe(itemSelected);

    const folderItem = component["items"]().find((i) => i.labelKey === "folder");
    folderItem!.action();

    expect(itemSelected).toHaveBeenCalledWith({ result: AddItemGridResult.Folder });
  });

  it("emits itemSelected with collection result when collection is selected", () => {
    createComponent({
      canCreateFolder: false,
      canCreateCollection: true,
      canCreateSshKey: false,
    });

    const itemSelected = jest.fn();
    component.itemSelected.subscribe(itemSelected);

    const collectionItem = component["items"]().find((i) => i.labelKey === "collection");
    collectionItem!.action();

    expect(itemSelected).toHaveBeenCalledWith({ result: AddItemGridResult.Collection });
  });

  describe("New badges", () => {
    const badged = () =>
      component["items"]()
        .filter((i) => i.badged)
        .map((i) => i.labelKey);

    it("badges the new item types and marks them seen", () => {
      badge(CipherType.BankAccount, CipherType.Passport);
      createComponent({
        canCreateFolder: false,
        canCreateCollection: false,
        canCreateSshKey: true,
      });

      expect(badged()).toEqual(["typeBankAccount", "typePassport"]);
      expect(newItemTypesAnnouncementMock.dismissBadges).toHaveBeenCalledTimes(1);
      expect(newItemTypesAnnouncementMock.dismissBadges).toHaveBeenCalledWith(userId);
    });

    it("keeps the badges for this view after they are marked seen", () => {
      badge(CipherType.BankAccount);
      createComponent({
        canCreateFolder: false,
        canCreateCollection: false,
        canCreateSshKey: true,
      });

      badge();
      fixture.detectChanges();

      expect(badged()).toEqual(["typeBankAccount"]);
    });

    it("leaves the badges unseen when nothing is badged", () => {
      createComponent({
        canCreateFolder: false,
        canCreateCollection: false,
        canCreateSshKey: true,
      });

      expect(badged()).toEqual([]);
      expect(newItemTypesAnnouncementMock.dismissBadges).not.toHaveBeenCalled();
    });

    it("leaves the badges unseen when ciphers can't be created", () => {
      badge(CipherType.BankAccount);
      createComponent({
        canCreateCipher: false,
        canCreateFolder: true,
        canCreateCollection: false,
        canCreateSshKey: false,
      });

      expect(newItemTypesAnnouncementMock.dismissBadges).not.toHaveBeenCalled();
    });
  });
});
