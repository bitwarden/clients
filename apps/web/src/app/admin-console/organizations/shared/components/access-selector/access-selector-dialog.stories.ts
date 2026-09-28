import { Meta, StoryObj } from "@storybook/angular";

import { AccessSelectorComponent, PermissionMode } from "./access-selector.component";
import { AccessItemType, AccessItemValue } from "./access-selector.models";
import { default as baseComponentDefinition } from "./access-selector.stories";
import { actionsData, itemsFactory } from "./storybook-utils";

/**
 * Displays the Access Selector in a dialog.
 */
export default {
  title: "Admin Console/Organizations/Access Selector/Dialog",
  decorators: baseComponentDefinition.decorators,
} as Meta;

type Story = StoryObj<AccessSelectorComponent & { initialValue: AccessItemValue[] }>;

const render: Story["render"] = (args) => ({
  props: {
    valueChanged: actionsData.onValueChanged,
    ...args,
    items: args.items ?? [],
    initialValue: args.initialValue ?? [],
  },
  template: `
    <bit-dialog disableAnimations>
      <span bitDialogTitle>Access selector</span>
      <span bitDialogContent>
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
        ></bit-access-selector>
      </span>
      <ng-container bitDialogFooter>
        <button bitButton buttonType="primary">Save</button>
        <button bitButton buttonType="secondary">Cancel</button>
        <button
          class="tw-ml-auto"
          bitIconButton="bwi-trash"
          buttonType="dangerGhost"
          size="default"
          title="Delete"
          label="Delete"></button>
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
    initialValue: [] as any[],
    items: dialogAccessItems,
  },
  render,
};
