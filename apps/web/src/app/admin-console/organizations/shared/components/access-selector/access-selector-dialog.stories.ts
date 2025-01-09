// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Meta, StoryObj } from "@storybook/angular";

import { AccessSelectorComponent, PermissionMode } from "./access-selector.component";
import { AccessItemType, AccessItemValue } from "./access-selector.models";
import { default as baseComponentDefinition } from "./access-selector.stories";
import { actionsData, itemsFactory } from "./storybook-utils";

/**
 * Displays the Access Selector in a dialog.
 */
export default {
  title: "Web/Organizations/Access Selector/Dialog",
  decorators: baseComponentDefinition.decorators,
} as Meta;

type Story = StoryObj<AccessSelectorComponent & { initialValue: AccessItemValue[] }>;

const render: Story["render"] = (args) => ({
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

export const Dialog: Story = {
  args: {
    permissionMode: PermissionMode.Edit,
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
  render,
};
