import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";

import { AddItemGridComponent, AddItemGridResult } from "./add-item-grid.component";

describe("AddItemGridComponent", () => {
  let component: AddItemGridComponent;
  let fixture: ComponentFixture<AddItemGridComponent>;

  const restricted$ = new BehaviorSubject<any[]>([]);

  beforeEach(async () => {
    restricted$.next([]);

    await TestBed.configureTestingModule({
      imports: [AddItemGridComponent, NoopAnimationsModule],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        {
          provide: RestrictedItemTypesService,
          useValue: { restricted$ },
        },
      ],
    }).compileComponents();
  });

  function createComponent(inputs: {
    canCreateFolder: boolean;
    canCreateCollection: boolean;
    canCreateSshKey: boolean;
  }) {
    fixture = TestBed.createComponent(AddItemGridComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("canCreateFolder", inputs.canCreateFolder);
    fixture.componentRef.setInput("canCreateCollection", inputs.canCreateCollection);
    fixture.componentRef.setInput("canCreateSshKey", inputs.canCreateSshKey);
    fixture.detectChanges();
  }

  it("renders all 5 cipher types when unrestricted and canCreateSshKey=true", () => {
    createComponent({
      canCreateFolder: false,
      canCreateCollection: false,
      canCreateSshKey: true,
    });

    const items = component["items"]();
    expect(items.length).toBe(6);
    expect(items.map((i) => i.labelKey)).toEqual(
      expect.arrayContaining([
        "typeLogin",
        "typeCard",
        "typeBankAccount",
        "typeIdentity",
        "typeNote",
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
});
