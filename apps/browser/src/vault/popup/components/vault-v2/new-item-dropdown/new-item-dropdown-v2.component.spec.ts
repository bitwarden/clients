import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { ButtonModule, DialogService, MenuModule } from "@bitwarden/components";

import { AddEditQueryParams } from "../add-edit/add-edit-v2.component";
import { AddEditFolderDialogComponent } from "../add-edit-folder-dialog/add-edit-folder-dialog.component";

import { NewItemDropdownV2Component, NewItemInitialValues } from "./new-item-dropdown-v2.component";

describe("NewItemDropdownV2Component", () => {
  let component: NewItemDropdownV2Component;
  let fixture: ComponentFixture<NewItemDropdownV2Component>;
  const open = jest.fn();
  const navigate = jest.fn();

  beforeEach(async () => {
    open.mockClear();
    navigate.mockClear();

    await TestBed.configureTestingModule({
      imports: [NewItemDropdownV2Component, MenuModule, ButtonModule, JslibModule, CommonModule],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: Router, useValue: { navigate } },
      ],
    })
      .overrideProvider(DialogService, { useValue: { open } })
      .compileComponents();

    fixture = TestBed.createComponent(NewItemDropdownV2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("opens new folder dialog", () => {
    component.openFolderDialog();

    expect(open).toHaveBeenCalledWith(AddEditFolderDialogComponent);
  });

  describe("new item", () => {
    const emptyParams: AddEditQueryParams = {
      collectionId: undefined,
      organizationId: undefined,
      folderId: undefined,
    };

    beforeEach(() => {
      jest.spyOn(component, "newItemNavigate");
    });

    it("navigates to new login", () => {
      component.newItemNavigate(CipherType.Login);

      expect(navigate).toHaveBeenCalledWith(["/add-cipher"], {
        queryParams: { type: CipherType.Login.toString(), ...emptyParams },
      });
    });

    it("navigates to new card", () => {
      component.newItemNavigate(CipherType.Card);

      expect(navigate).toHaveBeenCalledWith(["/add-cipher"], {
        queryParams: { type: CipherType.Card.toString(), ...emptyParams },
      });
    });

    it("navigates to new identity", () => {
      component.newItemNavigate(CipherType.Identity);

      expect(navigate).toHaveBeenCalledWith(["/add-cipher"], {
        queryParams: { type: CipherType.Identity.toString(), ...emptyParams },
      });
    });

    it("navigates to new note", () => {
      component.newItemNavigate(CipherType.SecureNote);

      expect(navigate).toHaveBeenCalledWith(["/add-cipher"], {
        queryParams: { type: CipherType.SecureNote.toString(), ...emptyParams },
      });
    });

    it("includes initial values", () => {
      component.initialValues = {
        folderId: "222-333-444",
        organizationId: "444-555-666",
        collectionId: "777-888-999",
      } as NewItemInitialValues;

      component.newItemNavigate(CipherType.Login);

      expect(navigate).toHaveBeenCalledWith(["/add-cipher"], {
        queryParams: {
          type: CipherType.Login.toString(),
          folderId: "222-333-444",
          organizationId: "444-555-666",
          collectionId: "777-888-999",
        },
      });
    });
  });
});
