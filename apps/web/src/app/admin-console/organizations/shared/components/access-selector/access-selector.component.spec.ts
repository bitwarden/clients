// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ComponentFixture, TestBed } from "@angular/core/testing";

import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { DialogService } from "@bitwarden/components";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { SelectItemView } from "@bitwarden/components/src/multi-select/models/select-item-view";

import { PreloadedEnglishI18nModule } from "../../../../../core/tests";

import { AccessSelectorComponent, PermissionMode } from "./access-selector.component";
import { AccessItemType, CollectionPermission } from "./access-selector.models";

/**
 * Helper class that makes it easier to test the AccessSelectorComponent by
 * exposing some protected methods/properties
 */
class TestableAccessSelectorComponent extends AccessSelectorComponent {
  selectItems(items: SelectItemView[]) {
    super.selectItems(items);
  }
  deselectItem(id: string) {
    super.deselectItem(id);
  }

  /**
   * Helper used to simulate a user selecting a new permission for a table row
   * @param index - "Row" index
   * @param perm - The new permission value
   */
  changeSelectedItemPerm(index: number, perm: CollectionPermission) {
    this.selectionList.formArray.at(index).patchValue({
      permission: perm,
    });
  }

  /** Test helper exposing the protected per-row require-lease handler. */
  onRequireLeaseChange(itemId: string, newValue: boolean) {
    return super.onRequireLeaseChange(itemId, newValue);
  }

  /** Test helper exposing the protected bulk-action handler. */
  bulkApplyRequireLease() {
    return super.bulkApplyRequireLease();
  }

  getFormValue() {
    return this.selectionList.formArray.value;
  }
}

describe("AccessSelectorComponent", () => {
  let component: TestableAccessSelectorComponent;
  let fixture: ComponentFixture<TestableAccessSelectorComponent>;
  let dialogService: { openSimpleDialog: jest.Mock };

  beforeEach(() => {
    dialogService = { openSimpleDialog: jest.fn().mockResolvedValue(true) };
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    TestBed.configureTestingModule({
      imports: [PreloadedEnglishI18nModule, TestableAccessSelectorComponent],
      providers: [{ provide: DialogService, useValue: dialogService }],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TestableAccessSelectorComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput("emptySelectionText", "Nothing selected");

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("item selection", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("items", [
        {
          id: "123",
          type: AccessItemType.Group,
          labelName: "Group 1",
          listName: "Group 1",
        },
      ]);
      fixture.detectChanges();
    });

    it("should show the empty row when nothing is selected", () => {
      const emptyTableCell = fixture.nativeElement.querySelector("tbody tr td");
      expect(emptyTableCell?.textContent).toEqual("Nothing selected");
    });

    it("should show one row when one value is selected", () => {
      component.selectItems([{ id: "123" } as any]);
      fixture.detectChanges();
      const firstColSpan = fixture.nativeElement.querySelector("tbody tr td span");
      expect(firstColSpan.textContent).toEqual("Group 1");
    });

    it("should emit value change when a value is selected", () => {
      // Arrange
      const mockChange = jest.fn();
      component.registerOnChange(mockChange);
      fixture.componentRef.setInput("permissionMode", PermissionMode.Edit);

      // Act
      component.selectItems([{ id: "123" } as any]);

      // Assert
      expect(mockChange.mock.calls.length).toEqual(1);
      expect(mockChange.mock.lastCall[0]).toHaveProperty("[0].id", "123");
    });

    it("should emit value change when a row is modified", () => {
      // Arrange
      const mockChange = jest.fn();
      fixture.componentRef.setInput("permissionMode", PermissionMode.Edit);
      component.selectItems([{ id: "123" } as any]);
      component.registerOnChange(mockChange); // Register change listener after setup

      // Act
      component.changeSelectedItemPerm(0, CollectionPermission.Edit);

      // Assert
      expect(mockChange.mock.calls.length).toEqual(1);
      expect(mockChange.mock.lastCall[0]).toHaveProperty("[0].id", "123");
      expect(mockChange.mock.lastCall[0]).toHaveProperty(
        "[0].permission",
        CollectionPermission.Edit,
      );
    });

    it("should emit value change when a row is removed", () => {
      // Arrange
      const mockChange = jest.fn();
      fixture.componentRef.setInput("permissionMode", PermissionMode.Edit);
      component.selectItems([{ id: "123" } as any]);
      component.registerOnChange(mockChange); // Register change listener after setup

      // Act
      component.deselectItem("123");

      // Assert
      expect(mockChange.mock.calls.length).toEqual(1);
      expect(mockChange.mock.lastCall[0].length).toEqual(0);
    });

    it("should emit permission values when in edit mode", () => {
      // Arrange
      const mockChange = jest.fn();
      component.registerOnChange(mockChange);
      fixture.componentRef.setInput("permissionMode", PermissionMode.Edit);

      // Act
      component.selectItems([{ id: "123" } as any]);

      // Assert
      expect(mockChange.mock.calls.length).toEqual(1);
      expect(mockChange.mock.lastCall[0]).toHaveProperty("[0].id", "123");
      expect(mockChange.mock.lastCall[0]).toHaveProperty("[0].permission");
    });

    it("should not emit permission values when not in edit mode", () => {
      // Arrange
      const mockChange = jest.fn();
      component.registerOnChange(mockChange);
      fixture.componentRef.setInput("permissionMode", PermissionMode.Hidden);

      // Act
      component.selectItems([{ id: "123" } as any]);

      // Assert
      expect(mockChange.mock.calls.length).toEqual(1);
      expect(mockChange.mock.lastCall[0]).toHaveProperty("[0].id", "123");
      expect(mockChange.mock.lastCall[0]).not.toHaveProperty("[0].permission");
    });
  });

  describe("column rendering", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("items", [
        {
          id: "g1",
          type: AccessItemType.Group,
          labelName: "Group 1",
          listName: "Group 1",
        },
        {
          id: "m1",
          type: AccessItemType.Member,
          labelName: "Member 1",
          listName: "Member 1 (member1@email.com)",
          email: "member1@email.com",
          role: OrganizationUserType.User,
          status: OrganizationUserStatusType.Confirmed,
        },
      ]);
      fixture.detectChanges();
    });

    test.each([true, false])("should show the role column when enabled", (columnEnabled) => {
      // Act
      fixture.componentRef.setInput("showMemberRoles", columnEnabled);
      fixture.detectChanges();

      // Assert
      const colHeading = fixture.nativeElement.querySelector("#roleColHeading");
      expect(!!colHeading).toEqual(columnEnabled);
    });

    test.each([true, false])("should show the group column when enabled", (columnEnabled) => {
      // Act
      fixture.componentRef.setInput("showGroupColumn", columnEnabled);
      fixture.detectChanges();

      // Assert
      const colHeading = fixture.nativeElement.querySelector("#groupColHeading");
      expect(!!colHeading).toEqual(columnEnabled);
    });

    const permissionColumnCases = [
      [PermissionMode.Hidden, false],
      [PermissionMode.Edit, true],
      [PermissionMode.Readonly, true],
    ];

    test.each(permissionColumnCases)(
      "should show the permission column when enabled",
      (mode: PermissionMode, shouldShowColumn) => {
        // Act
        fixture.componentRef.setInput("permissionMode", mode);
        fixture.detectChanges();

        // Assert
        const colHeading = fixture.nativeElement.querySelector("#permissionColHeading");
        expect(!!colHeading).toEqual(shouldShowColumn);
      },
    );

    test.each([true, false])(
      "should show the require-lease column when enabled",
      (columnEnabled) => {
        fixture.componentRef.setInput("showRequireLeaseColumn", columnEnabled);
        fixture.detectChanges();

        const colHeading = fixture.nativeElement.querySelector("#requireLeaseColHeading");
        expect(!!colHeading).toEqual(columnEnabled);
      },
    );
  });

  describe("require_lease toggle", () => {
    const memberItem = {
      id: "m1",
      type: AccessItemType.Member,
      labelName: "Member 1",
      listName: "Member 1 (m1@example.com)",
      email: "m1@example.com",
      role: OrganizationUserType.User,
      status: OrganizationUserStatusType.Confirmed,
      initialRequireLease: false,
    };
    const memberItem2 = {
      id: "m2",
      type: AccessItemType.Member,
      labelName: "Member 2",
      listName: "Member 2 (m2@example.com)",
      email: "m2@example.com",
      role: OrganizationUserType.User,
      status: OrganizationUserStatusType.Confirmed,
      initialRequireLease: false,
    };

    beforeEach(() => {
      fixture.componentRef.setInput("items", [memberItem, memberItem2]);
      fixture.componentRef.setInput("showRequireLeaseColumn", true);
      fixture.componentRef.setInput("permissionMode", PermissionMode.Edit);
      fixture.detectChanges();
    });

    it("seeds the per-row requireLease control from initialRequireLease", () => {
      fixture.componentRef.setInput("items", [{ ...memberItem, initialRequireLease: true }]);
      fixture.detectChanges();
      component.selectItems([{ id: "m1" } as any]);
      expect(component.getFormValue()[0]).toHaveProperty("requireLease", true);
    });

    it("does not prompt for self-toggle when toggling another member", async () => {
      component.selectItems([{ id: "m1" } as any]);
      fixture.componentRef.setInput("currentMemberId", "self");

      await component.onRequireLeaseChange("m1", true);

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
    });

    it("prompts and keeps the toggle on when the user confirms self-toggle", async () => {
      component.selectItems([{ id: "m1" } as any]);
      fixture.componentRef.setInput("currentMemberId", "m1");
      // Simulate the user flipping the form control on
      component["selectionList"].formArray.at(0).patchValue({ requireLease: true });
      dialogService.openSimpleDialog.mockResolvedValueOnce(true);

      await component.onRequireLeaseChange("m1", true);

      expect(dialogService.openSimpleDialog).toHaveBeenCalledTimes(1);
      expect(component.getFormValue()[0]).toHaveProperty("requireLease", true);
    });

    it("reverts the toggle when the user cancels self-toggle", async () => {
      component.selectItems([{ id: "m1" } as any]);
      fixture.componentRef.setInput("currentMemberId", "m1");
      component["selectionList"].formArray.at(0).patchValue({ requireLease: true });
      dialogService.openSimpleDialog.mockResolvedValueOnce(false);

      await component.onRequireLeaseChange("m1", true);

      expect(component.getFormValue()[0]).toHaveProperty("requireLease", false);
    });

    it("does not prompt when self-toggling OFF", async () => {
      component.selectItems([{ id: "m1" } as any]);
      fixture.componentRef.setInput("currentMemberId", "m1");

      await component.onRequireLeaseChange("m1", false);

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
    });

    it("bulk applies requireLease to every selected row after confirmation", async () => {
      component.selectItems([{ id: "m1" } as any, { id: "m2" } as any]);
      dialogService.openSimpleDialog.mockResolvedValueOnce(true);

      const bulkEmitted = jest.fn();
      component.bulkRequireLeaseApplied.subscribe(bulkEmitted);
      const mockChange = jest.fn();
      component.registerOnChange(mockChange);

      await component.bulkApplyRequireLease();

      const values = component.getFormValue();
      expect(values.every((v: any) => v.requireLease === true)).toBe(true);
      expect(bulkEmitted).toHaveBeenCalledTimes(1);
      // Exactly one external change notification is emitted for the bulk apply
      expect(mockChange).toHaveBeenCalledTimes(1);
    });

    it("does not modify rows if the bulk action is cancelled", async () => {
      component.selectItems([{ id: "m1" } as any, { id: "m2" } as any]);
      dialogService.openSimpleDialog.mockResolvedValueOnce(false);

      await component.bulkApplyRequireLease();

      const values = component.getFormValue();
      expect(values.every((v: any) => v.requireLease === false)).toBe(true);
    });
  });
});
