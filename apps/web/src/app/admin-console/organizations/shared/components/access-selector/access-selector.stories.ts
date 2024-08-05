import { importProvidersFrom } from "@angular/core";
import { FormBuilder, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { action } from "@storybook/addon-actions";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import {
  AvatarModule,
  BadgeModule,
  ButtonModule,
  DialogModule,
  FormFieldModule,
  IconButtonModule,
  TableModule,
  TabsModule,
} from "@bitwarden/components";

import { PreloadedEnglishI18nModule } from "../../../../../core/tests";

import { AccessSelectorComponent } from "./access-selector.component";
import { AccessItemType, AccessItemView, CollectionPermission } from "./access-selector.models";
import { UserTypePipe } from "./user-type.pipe";

export default {
  title: "Web/Organizations/Access Selector",
  decorators: [
    moduleMetadata({
      declarations: [AccessSelectorComponent, UserTypePipe],
      imports: [
        DialogModule,
        ButtonModule,
        FormFieldModule,
        AvatarModule,
        BadgeModule,
        ReactiveFormsModule,
        FormsModule,
        TabsModule,
        TableModule,
        JslibModule,
        IconButtonModule,
      ],
      providers: [],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
  parameters: {},
  argTypes: {
    formObj: { table: { disable: true } },
  },
} as Meta;

// TODO: This is a workaround since this story does weird things.
type Story = StoryObj<any>;

const actionsData = {
  onValueChanged: action("onValueChanged"),
  onSubmit: action("onSubmit"),
};

/**
 * Factory to help build semi-realistic looking items
 * @param n - The number of items to build
 * @param type - Which type to build
 */
const itemsFactory = (n: number, type: AccessItemType) => {
  return [...Array(n)].map((_: unknown, id: number) => {
    const item: AccessItemView = {
      id: id.toString(),
      type: type,
    } as AccessItemView;

    switch (item.type) {
      case AccessItemType.Collection:
        item.labelName = item.listName = `Collection ${id}`;
        item.id = item.id + "c";
        item.parentGrouping = "Collection Parent Group " + ((id % 2) + 1);
        break;
      case AccessItemType.Group:
        item.labelName = item.listName = `Group ${id}`;
        item.id = item.id + "g";
        break;
      case AccessItemType.Member:
        item.id = item.id + "m";
        item.email = `member${id}@email.com`;
        item.status = id % 3 == 0 ? 0 : 2;
        item.labelName = item.status == 2 ? `Member ${id}` : item.email;
        item.listName = item.status == 2 ? `${item.labelName} (${item.email})` : item.email;
        item.role = id % 5;
        break;
    }

    return item;
  });
};

const sampleMembers = itemsFactory(10, AccessItemType.Member);
const sampleGroups = itemsFactory(6, AccessItemType.Group);

// TODO: These renders are badly handled but storybook has made it more difficult to use multiple renders in a single story.
const StandaloneAccessSelectorRender = (args: any) => ({
  props: {
    items: [],
    valueChanged: actionsData.onValueChanged,
    initialValue: [],
    ...args,
  },
  template: `
    <bit-access-selector
      (ngModelChange)="valueChanged($event)"
      [ngModel]="initialValue"
      [items]="items"
      [disabled]="disabled"
      [columnHeader]="columnHeader"
      [showGroupColumn]="showGroupColumn"
      [selectorLabelText]="selectorLabelText"
      [selectorHelpText]="selectorHelpText"
      [emptySelectionText]="emptySelectionText"
      [permissionMode]="permissionMode"
      [showMemberRoles]="showMemberRoles"
    ></bit-access-selector>
  `,
});

const DialogAccessSelectorRender = (args: any) => ({
  props: {
    items: [],
    valueChanged: actionsData.onValueChanged,
    initialValue: [],
    ...args,
  },
  template: `
    <bit-dialog [dialogSize]="dialogSize" [disablePadding]="disablePadding">
      <span bitDialogTitle>Access selector</span>
      <span bitDialogContent>
        <bit-access-selector
          (ngModelChange)="valueChanged($event)"
          [ngModel]="initialValue"
          [items]="items"
          [disabled]="disabled"
          [columnHeader]="columnHeader"
          [showGroupColumn]="showGroupColumn"
          [selectorLabelText]="selectorLabelText"
          [selectorHelpText]="selectorHelpText"
          [emptySelectionText]="emptySelectionText"
          [permissionMode]="permissionMode"
          [showMemberRoles]="showMemberRoles"
        ></bit-access-selector>
      </span>
      <ng-container bitDialogFooter>
        <button bitButton buttonType="primary">Save</button>
        <button bitButton buttonType="secondary">Cancel</button>
        <button
          class="tw-ml-auto"
          bitIconButton="bwi-trash"
          buttonType="danger"
          size="default"
          title="Delete"
          aria-label="Delete"></button>
      </ng-container>
    </bit-dialog>
  `,
});

const dialogAccessItems = itemsFactory(10, AccessItemType.Collection);

const memberCollectionAccessItems = itemsFactory(3, AccessItemType.Collection).concat([
  {
    id: "c1-group1",
    type: AccessItemType.Collection,
    labelName: "Collection 1",
    listName: "Collection 1",
    viaGroupName: "Group 1",
    readonlyPermission: CollectionPermission.View,
    readonly: true,
  },
  {
    id: "c1-group2",
    type: AccessItemType.Collection,
    labelName: "Collection 1",
    listName: "Collection 1",
    viaGroupName: "Group 2",
    readonlyPermission: CollectionPermission.ViewExceptPass,
    readonly: true,
  },
]);

export const Dialog: Story = {
  args: {
    permissionMode: "edit",
    showMemberRoles: false,
    showGroupColumn: true,
    columnHeader: "Collection",
    selectorLabelText: "Select Collections",
    selectorHelpText: "Some helper text describing what this does",
    emptySelectionText: "No collections added",
    disabled: false,
    initialValue: [] as any[],
    items: dialogAccessItems,
  },
  render: DialogAccessSelectorRender,
};

export const MemberCollectionAccess: Story = {
  args: {
    permissionMode: "edit",
    showMemberRoles: false,
    showGroupColumn: true,
    columnHeader: "Collection",
    selectorLabelText: "Select Collections",
    selectorHelpText: "Some helper text describing what this does",
    emptySelectionText: "No collections added",
    disabled: false,
    initialValue: [],
    items: memberCollectionAccessItems,
  },
  render: StandaloneAccessSelectorRender,
};

export const MemberGroupAccess: Story = {
  args: {
    permissionMode: "readonly",
    showMemberRoles: false,
    columnHeader: "Groups",
    selectorLabelText: "Select Groups",
    selectorHelpText: "Some helper text describing what this does",
    emptySelectionText: "No groups added",
    disabled: false,
    initialValue: [{ id: "3g" }, { id: "0g" }],
    items: itemsFactory(4, AccessItemType.Group).concat([
      {
        id: "admin",
        type: AccessItemType.Group,
        listName: "Admin Group",
        labelName: "Admin Group",
      },
    ]),
  },
  render: StandaloneAccessSelectorRender,
};

export const GroupMembersAccess: Story = {
  args: {
    permissionMode: "hidden",
    showMemberRoles: true,
    columnHeader: "Members",
    selectorLabelText: "Select Members",
    selectorHelpText: "Some helper text describing what this does",
    emptySelectionText: "No members added",
    disabled: false,
    initialValue: [{ id: "2m" }, { id: "0m" }],
    items: sampleMembers,
  },
  render: StandaloneAccessSelectorRender,
};

export const CollectionAccess: Story = {
  args: {
    permissionMode: "edit",
    showMemberRoles: false,
    columnHeader: "Groups/Members",
    selectorLabelText: "Select groups and members",
    selectorHelpText:
      "Permissions set for a member will replace permissions set by that member's group",
    emptySelectionText: "No members or groups added",
    disabled: false,
    initialValue: [
      { id: "3g", permission: CollectionPermission.EditExceptPass },
      { id: "0m", permission: CollectionPermission.View },
    ],
    items: sampleGroups.concat(sampleMembers).concat([
      {
        id: "admin-group",
        type: AccessItemType.Group,
        listName: "Admin Group",
        labelName: "Admin Group",
        readonly: true,
      },
      {
        id: "admin-member",
        type: AccessItemType.Member,
        listName: "Admin Member (admin@email.com)",
        labelName: "Admin Member",
        status: OrganizationUserStatusType.Confirmed,
        role: OrganizationUserType.Admin,
        email: "admin@email.com",
        readonly: true,
      },
    ]),
  },
  render: StandaloneAccessSelectorRender,
};

const fb = new FormBuilder();

const ReactiveFormAccessSelectorRender = (args: any) => ({
  props: {
    items: [],
    onSubmit: actionsData.onSubmit,
    ...args,
  },
  template: `
    <form [formGroup]="formObj" (ngSubmit)="onSubmit(formObj.controls.formItems.value)">
      <bit-access-selector
        formControlName="formItems"
        [items]="items"
        [columnHeader]="columnHeader"
        [selectorLabelText]="selectorLabelText"
        [selectorHelpText]="selectorHelpText"
        [emptySelectionText]="emptySelectionText"
        [permissionMode]="permissionMode"
        [showMemberRoles]="showMemberRoles"
      ></bit-access-selector>
      <button type="submit" bitButton buttonType="primary" class="tw-mt-5">Submit</button>
    </form>
`,
});

export const ReactiveForm: Story = {
  args: {
    formObj: fb.group({ formItems: [[{ id: "1g" }]] }),
    permissionMode: "edit",
    showMemberRoles: false,
    columnHeader: "Groups/Members",
    selectorLabelText: "Select groups and members",
    selectorHelpText:
      "Permissions set for a member will replace permissions set by that member's group",
    emptySelectionText: "No members or groups added",
    items: sampleGroups.concat(sampleMembers),
  },
  render: ReactiveFormAccessSelectorRender,
};
