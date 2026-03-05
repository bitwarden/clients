// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import {
  AvatarModule,
  BadgeModule,
  ButtonModule,
  FormFieldModule,
  IconButtonModule,
  SelectModule,
  TableModule,
  TabsModule,
} from "@bitwarden/components";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { SelectItemView } from "@bitwarden/components/src/multi-select/models/select-item-view";

import { PreloadedEnglishI18nModule } from "../../../../../core/tests";

import { AccessSelectorComponent, PermissionMode } from "./access-selector.component";
import { AccessItemType, CollectionPermission } from "./access-selector.models";
import { UserTypePipe } from "./user-type.pipe";

/**
 * Helper class that makes it easier to test the AccessSelectorComponent by
 * exposing some protected methods/properties
 */
class TestableAccessSelectorComponent extends AccessSelectorComponent {
  selectItems(items: SelectItemView[]) {
    super.selectItems(items);
  }
  deselectItem(id: string) {
    this.selectionList.deselectItem(id);
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
}

describe("AccessSelectorComponent", () => {
  let component: TestableAccessSelectorComponent;
  let fixture: ComponentFixture<TestableAccessSelectorComponent>;

  beforeEach(() => {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    TestBed.configureTestingModule({
      imports: [
        ButtonModule,
        FormFieldModule,
        AvatarModule,
        BadgeModule,
        ReactiveFormsModule,
        FormsModule,
        TabsModule,
        TableModule,
        PreloadedEnglishI18nModule,
        JslibModule,
        IconButtonModule,
        SelectModule,
      ],
      declarations: [TestableAccessSelectorComponent, UserTypePipe],
      providers: [],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TestableAccessSelectorComponent);
    component = fixture.componentInstance;

    component.emptySelectionText = "Nothing selected";

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("item selection", () => {
    beforeEach(() => {
      component.items = [
        {
          id: "123",
          type: AccessItemType.Group,
          labelName: "Group 1",
          listName: "Group 1",
        },
      ];
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
      component.permissionMode = PermissionMode.Edit;

      // Act
      component.selectItems([{ id: "123" } as any]);

      // Assert
      expect(mockChange.mock.calls.length).toEqual(1);
      expect(mockChange.mock.lastCall[0]).toHaveProperty("[0].id", "123");
    });

    it("should emit value change when a row is modified", () => {
      // Arrange
      const mockChange = jest.fn();
      component.permissionMode = PermissionMode.Edit;
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
      component.permissionMode = PermissionMode.Edit;
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
      component.permissionMode = PermissionMode.Edit;

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
      component.permissionMode = PermissionMode.Hidden;

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
      component.items = [
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
      ];
      fixture.detectChanges();
    });

    test.each([true, false])("should show the role column when enabled", (columnEnabled) => {
      // Act
      component.showMemberRoles = columnEnabled;
      fixture.detectChanges();

      // Assert
      const colHeading = fixture.nativeElement.querySelector("#roleColHeading");
      expect(!!colHeading).toEqual(columnEnabled);
    });

    test.each([true, false])("should show the group column when enabled", (columnEnabled) => {
      // Act
      component.showGroupColumn = columnEnabled;
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
        component.permissionMode = mode;
        fixture.detectChanges();

        // Assert
        const colHeading = fixture.nativeElement.querySelector("#permissionColHeading");
        expect(!!colHeading).toEqual(shouldShowColumn);
      },
    );
  });
});
