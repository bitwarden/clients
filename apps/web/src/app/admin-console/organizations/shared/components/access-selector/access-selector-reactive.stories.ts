// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { FormBuilder, FormControl, FormGroup } from "@angular/forms";
import { Meta, StoryObj } from "@storybook/angular";

import { AccessSelectorComponent, PermissionMode } from "./access-selector.component";
import { AccessItemType, AccessItemValue } from "./access-selector.models";
import { default as baseComponentDefinition } from "./access-selector.stories";
import { actionsData, itemsFactory } from "./storybook-utils";

/**
 * Displays the Access Selector embedded in a reactive form.
 */
export default {
  title: "Web/Organizations/Access Selector/Reactive form",
  decorators: baseComponentDefinition.decorators,
  argTypes: {
    formObj: { table: { disable: true } },
  },
} as Meta;

type FormObj = { formObj: FormGroup<{ formItems: FormControl<AccessItemValue[]> }> };
type Story = StoryObj<AccessSelectorComponent & FormObj>;

const fb = new FormBuilder();

const render: Story["render"] = (args) => ({
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

const sampleMembers = itemsFactory(10, AccessItemType.Member);
const sampleGroups = itemsFactory(6, AccessItemType.Group);

export const ReactiveForm: Story = {
  args: {
    formObj: fb.group({ formItems: [[{ id: "1g", type: AccessItemType.Group }]] }),
    permissionMode: PermissionMode.Edit,
    showMemberRoles: false,
    columnHeader: "Groups/Members",
    selectorLabelText: "Select groups and members",
    selectorHelpText:
      "Permissions set for a member will replace permissions set by that member's group",
    emptySelectionText: "No members or groups added",
    items: sampleGroups.concat(sampleMembers),
  },
  render,
};
