import { importProvidersFrom } from "@angular/core";
import { FormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  AvatarModule,
  BadgeModule,
  ButtonModule,
  DialogModule,
  FormFieldModule,
  IconButtonModule,
  SelectModule,
  TableModule,
  TabsModule,
} from "@bitwarden/components";

import { PreloadedEnglishI18nModule } from "../../../../../core/tests";

import { AccessSelectorComponent, PermissionMode } from "./access-selector.component";
import { AccessItemType, AccessItemValue, CollectionPermission } from "./access-selector.models";
import { actionsData, itemsFactory } from "./storybook-utils";

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
      imports: [
        AccessSelectorComponent,
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
        SelectModule,
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
      [columnHeader]="columnHeader"
      [showGroupColumn]="showGroupColumn"
      [selectorLabelText]="selectorLabelText"
      [selectorHelpText]="selectorHelpText"
      [emptySelectionText]="emptySelectionText"
      [permissionMode]="permissionMode"
      [showMemberRoles]="showMemberRoles"
      [hideMultiSelect]="hideMultiSelect"
      [hideTable]="hideTable"
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
    initialValue: [
      { id: "3g", type: AccessItemType.Group, permission: CollectionPermission.EditExceptPass },
      { id: "0m", type: AccessItemType.Member, permission: CollectionPermission.View },
      { id: "7m", type: AccessItemType.Member, permission: CollectionPermission.Manage },
    ],
    items: sampleGroups.concat(sampleMembers),
  },
  render,
};

/**
 * Hides the multi-select input so that new items cannot be added. Only the selected items table
 * is shown. Useful when the caller manages the selection externally.
 */
export const HideMultiSelect: Story = {
  args: {
    ...CollectionAccess.args,
    hideMultiSelect: true,
  },
  render,
};

/**
 * Hides the selected items table so only the multi-select input is shown. Used when the caller
 * wants inline selection without a separate table (e.g. the Groups tab in the invite dialog).
 */
export const HideTable: Story = {
  args: {
    ...MemberGroupAccess.args,
    hideTable: true,
  },
  render,
};

// TODO: currently the collection dialog duplicates the AccessItemValue.permission on the
// AccessItemView.readonlyPermission, this will be refactored to reduce this duplication:
// https://bitwarden.atlassian.net/browse/PM-11590
const disabledMembers = itemsFactory(3, AccessItemType.Member);
disabledMembers[0].readonlyPermission = CollectionPermission.Edit;
disabledMembers[1].readonlyPermission = CollectionPermission.Manage;
disabledMembers[2].readonlyPermission = CollectionPermission.View;

const disabledGroups = itemsFactory(2, AccessItemType.Group);
disabledGroups[0].readonlyPermission = CollectionPermission.ViewExceptPass;
disabledGroups[1].readonlyPermission = CollectionPermission.Edit;

/**
 * Displays the members and groups assigned to a collection when the control is in a disabled state.
 */
export const DisabledCollectionAccess: Story = {
  args: {
    ...CollectionAccess.args,
    items: disabledGroups.concat(disabledMembers),
    initialValue: [
      { id: "1m", type: AccessItemType.Member, permission: CollectionPermission.Manage },
      { id: "2m", type: AccessItemType.Member, permission: CollectionPermission.View },
      { id: "0g", type: AccessItemType.Group, permission: CollectionPermission.ViewExceptPass },
    ],
  },
  render: (args) => ({
    props: {
      ...args,
      formControl: new FormControl({ value: args["initialValue"], disabled: true }),
    },
    template: `
      <bit-access-selector
        [formControl]="formControl"
        [items]="items"
        [columnHeader]="columnHeader"
        [showGroupColumn]="showGroupColumn"
        [selectorLabelText]="selectorLabelText"
        [selectorHelpText]="selectorHelpText"
        [emptySelectionText]="emptySelectionText"
        [permissionMode]="permissionMode"
        [showMemberRoles]="showMemberRoles"
      ></bit-access-selector>
    `,
  }),
};

// PAM (Privileged Access Manager) story variants — exercise the require_lease column and
// surrounding flows. These stories are gated behind FeatureFlag.Pam at the application level;
// inside Storybook the column is rendered unconditionally for visual inspection.
const pamMembers = itemsFactory(4, AccessItemType.Member).map((m, i) => ({
  ...m,
  // First member starts with require_lease already on, others off
  initialRequireLease: i === 0,
}));

const pamRender: Story["render"] = (args) => ({
  props: {
    valueChanged: actionsData.onValueChanged,
    bulkApplied: () => {
      // eslint-disable-next-line no-console
      console.log("bulkRequireLeaseApplied");
    },
    ...args,
  },
  template: `
    <bit-access-selector
      (ngModelChange)="valueChanged($event)"
      (bulkRequireLeaseApplied)="bulkApplied()"
      [ngModel]="initialValue"
      [items]="items"
      [columnHeader]="columnHeader"
      [selectorLabelText]="selectorLabelText"
      [emptySelectionText]="emptySelectionText"
      [permissionMode]="permissionMode"
      [showMemberRoles]="showMemberRoles"
      [showRequireLeaseColumn]="showRequireLeaseColumn"
      [currentMemberId]="currentMemberId"
    ></bit-access-selector>
  `,
});

/**
 * Collection access list with the Privileged Access Manager `require_lease` column rendered
 * for every selected row. Use the bulk button at the top of the table to apply require_lease
 * to every current member; a confirmation dialog gates the change.
 */
export const PamRequireLeaseColumn: Story = {
  args: {
    permissionMode: PermissionMode.Edit,
    showMemberRoles: false,
    columnHeader: "Members",
    selectorLabelText: "Select members",
    emptySelectionText: "No members added",
    showRequireLeaseColumn: true,
    currentMemberId: null,
    initialValue: [
      {
        id: "0m",
        type: AccessItemType.Member,
        permission: CollectionPermission.Manage,
        requireLease: true,
      },
      {
        id: "1m",
        type: AccessItemType.Member,
        permission: CollectionPermission.Edit,
        requireLease: false,
      },
      {
        id: "2m",
        type: AccessItemType.Member,
        permission: CollectionPermission.View,
        requireLease: false,
      },
    ],
    items: pamMembers,
  },
  render: pamRender,
};

/**
 * Same as `PamRequireLeaseColumn`, but with the column hidden. Confirms the table layout
 * doesn't shift when the feature flag is off.
 */
export const PamRequireLeaseColumnHidden: Story = {
  args: {
    ...PamRequireLeaseColumn.args,
    showRequireLeaseColumn: false,
  },
  render: pamRender,
};

/**
 * Demonstrates the self-toggle confirmation. The "current user" is set to `0m`; turning on
 * `require_lease` for that row should surface a confirmation dialog explaining that the user
 * will need to lease their own access after this.
 */
export const PamSelfToggleConfirm: Story = {
  args: {
    ...PamRequireLeaseColumn.args,
    currentMemberId: "0m",
    initialValue: [
      {
        id: "0m",
        type: AccessItemType.Member,
        permission: CollectionPermission.Manage,
        requireLease: false,
      },
      {
        id: "1m",
        type: AccessItemType.Member,
        permission: CollectionPermission.Edit,
        requireLease: false,
      },
    ],
    items: pamMembers.map((m) => ({ ...m, initialRequireLease: false })),
  },
  render: pamRender,
};
