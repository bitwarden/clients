import { importProvidersFrom } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { JslibModule } from "@bitwarden/angular/jslib.module";
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

import { AccessSelectorComponent, PermissionMode } from "./access-selector.component";
import { AccessItemType, AccessItemValue, CollectionPermission } from "./access-selector.models";
import { actionsData, itemsFactory } from "./storybook-utils";
import { UserTypePipe } from "./user-type.pipe";

/**
 * The Access Selector is used to view and edit:
 * - member and group access to collections
 * - members assigned to groups
 *
 * It is highly configurable in order to display these relationships from each perspective. For example, you can
 * manage member-group relationships from the perspective of a particular member (showing all their groups) or a
 * particular group (showing all its members).
 */
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
} as Meta;

type Story = StoryObj<AccessSelectorComponent & { initialValue: AccessItemValue[] }>;

const sampleMembers = itemsFactory(10, AccessItemType.Member);
const sampleGroups = itemsFactory(6, AccessItemType.Group);

const render: Story["render"] = (args) => ({
  props: {
    valueChanged: actionsData.onValueChanged,
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

const memberCollectionAccessItems = itemsFactory(5, AccessItemType.Collection).concat([
  // These represent collection access via a group
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

// Simulate the current user not having permission to change access to this collection
// TODO: currently the member dialog duplicates the AccessItemValue.permission on the
// AccessItemView.readonlyPermission, this will be refactored to reduce this duplication:
// https://bitwarden.atlassian.net/browse/PM-11590
memberCollectionAccessItems[4].readonly = true;
memberCollectionAccessItems[4].readonlyPermission = CollectionPermission.Manage;

/**
 * Displays a member's collection access.
 *
 * This is currently used in the **Member dialog -> Collections tab**. Note that it includes collection access that the
 * member has via a group.
 *
 * This is also used in the **Groups dialog -> Collections tab** to show a group's collection access and in this
 * case the Group column is hidden.
 */
export const MemberCollectionAccess: Story = {
  args: {
    permissionMode: PermissionMode.Edit,
    showMemberRoles: false,
    showGroupColumn: true,
    columnHeader: "Collection",
    selectorLabelText: "Select Collections",
    selectorHelpText: "Some helper text describing what this does",
    emptySelectionText: "No collections added",
    disabled: false,
    initialValue: [
      {
        id: "4c",
        type: AccessItemType.Collection,
        permission: CollectionPermission.Manage,
      },
      {
        id: "2c",
        type: AccessItemType.Collection,
        permission: CollectionPermission.Edit,
      },
    ],
    items: memberCollectionAccessItems,
  },
  render,
};

/**
 * Displays the groups a member is assigned to.
 *
 * This is currently used in the **Member dialog -> Groups tab**.
 */
export const MemberGroupAccess: Story = {
  args: {
    permissionMode: PermissionMode.Hidden,
    showMemberRoles: false,
    columnHeader: "Groups",
    selectorLabelText: "Select Groups",
    selectorHelpText: "Some helper text describing what this does",
    emptySelectionText: "No groups added",
    disabled: false,
    initialValue: [
      { id: "3g", type: AccessItemType.Group },
      { id: "0g", type: AccessItemType.Group },
    ],
    items: itemsFactory(4, AccessItemType.Group).concat([
      {
        id: "admin",
        type: AccessItemType.Group,
        listName: "Admin Group",
        labelName: "Admin Group",
      },
    ]),
  },
  render,
};

/**
 * Displays the members assigned to a group.
 *
 * This is currently used in the **Group dialog -> Members tab**.
 */
export const GroupMembersAccess: Story = {
  args: {
    permissionMode: PermissionMode.Hidden,
    showMemberRoles: true,
    columnHeader: "Members",
    selectorLabelText: "Select Members",
    selectorHelpText: "Some helper text describing what this does",
    emptySelectionText: "No members added",
    disabled: false,
    initialValue: [
      { id: "2m", type: AccessItemType.Member },
      { id: "0m", type: AccessItemType.Member },
    ],
    items: sampleMembers,
  },
  render,
};

/**
 * Displays the members and groups assigned to a collection.
 *
 * This is currently used in the **Collection dialog -> Access tab**.
 */
export const CollectionAccess: Story = {
  args: {
    permissionMode: PermissionMode.Edit,
    showMemberRoles: false,
    columnHeader: "Groups/Members",
    selectorLabelText: "Select groups and members",
    selectorHelpText:
      "Permissions set for a member will replace permissions set by that member's group",
    emptySelectionText: "No members or groups added",
    disabled: false,
    initialValue: [
      { id: "3g", type: AccessItemType.Group, permission: CollectionPermission.EditExceptPass },
      { id: "0m", type: AccessItemType.Member, permission: CollectionPermission.View },
      { id: "7m", type: AccessItemType.Member, permission: CollectionPermission.Manage },
    ],
    items: sampleGroups.concat(sampleMembers),
  },
  render,
};

// TODO: currently the collection dialog duplicates the AccessItemValue.permission on the
// AccessItemView.readonlyPermission, this will be refactored to reduce this duplication:
// https://bitwarden.atlassian.net/browse/PM-11590
const disabledMembers = itemsFactory(3, AccessItemType.Member);
disabledMembers[1].readonlyPermission = CollectionPermission.Manage;
disabledMembers[2].readonlyPermission = CollectionPermission.View;

const disabledGroups = itemsFactory(2, AccessItemType.Group);
disabledGroups[0].readonlyPermission = CollectionPermission.ViewExceptPass;

/**
 * Displays the members and groups assigned to a collection when the control is in a disabled state.
 */
export const DisabledCollectionAccess: Story = {
  args: {
    ...CollectionAccess.args,
    disabled: true,
    items: disabledGroups.concat(disabledMembers),
    initialValue: [
      { id: "1m", type: AccessItemType.Member, permission: CollectionPermission.Manage },
      { id: "2m", type: AccessItemType.Member, permission: CollectionPermission.View },
      { id: "0g", type: AccessItemType.Group, permission: CollectionPermission.ViewExceptPass },
    ],
  },
  render,
};
