import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import { AddItemGridComponent } from "../add-item-grid/add-item-grid.component";

import {
  AddItemDialogComponent,
  AddItemDialogData,
  AddItemDialogResult,
} from "./add-item-dialog.component";

describe("AddItemDialogComponent", () => {
  let fixture: ComponentFixture<AddItemDialogComponent>;
  let dialogData: AddItemDialogData;

  const close = jest.fn();
  const dialogRef = { close };
  const restricted$ = new BehaviorSubject<[]>([]);

  beforeEach(async () => {
    close.mockClear();
    restricted$.next([]);

    await TestBed.configureTestingModule({
      imports: [AddItemDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: DialogRef, useValue: dialogRef },
        { provide: DIALOG_DATA, useFactory: () => dialogData },
        {
          provide: RestrictedItemTypesService,
          useValue: { restricted$ },
        },
      ],
    }).compileComponents();
  });

  function createComponent(data: AddItemDialogData) {
    dialogData = data;
    fixture = TestBed.createComponent(AddItemDialogComponent);
    fixture.detectChanges();
  }

  function getGrid(): AddItemGridComponent {
    return fixture.debugElement.query(By.directive(AddItemGridComponent)).componentInstance;
  }

  it("closes with cipher result when a cipher type is selected", () => {
    createComponent({
      canCreateFolder: false,
      canCreateCollection: false,
      canCreateSshKey: true,
    });

    getGrid().itemSelected.emit({
      result: AddItemDialogResult.Cipher,
      cipherType: CipherType.Login,
    });

    expect(close).toHaveBeenCalledWith({
      result: AddItemDialogResult.Cipher,
      cipherType: CipherType.Login,
    });
  });

  it("closes with folder result when a folder is selected", () => {
    createComponent({
      canCreateFolder: true,
      canCreateCollection: false,
      canCreateSshKey: false,
    });

    getGrid().itemSelected.emit({ result: AddItemDialogResult.Folder });

    expect(close).toHaveBeenCalledWith({ result: AddItemDialogResult.Folder });
  });

  it("closes with collection result when a collection is selected", () => {
    createComponent({
      canCreateFolder: false,
      canCreateCollection: true,
      canCreateSshKey: false,
    });

    getGrid().itemSelected.emit({ result: AddItemDialogResult.Collection });

    expect(close).toHaveBeenCalledWith({ result: AddItemDialogResult.Collection });
  });
});
