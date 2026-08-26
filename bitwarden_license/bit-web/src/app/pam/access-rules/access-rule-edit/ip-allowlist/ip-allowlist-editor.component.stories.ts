import { FormArray } from "@angular/forms";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { CidrValidationService } from "./cidr-validation.service";
import { atLeastOneNonEmptyCidrValidator, noDuplicateCidrsValidator } from "./cidr.validator";
import {
  cidrRowControl,
  IpAllowlistCidrsArray,
  IpAllowlistEditorComponent,
} from "./ip-allowlist-editor.component";

const INVALID_CIDR_MESSAGE = "Enter a valid CIDR range.";

/**
 * Story stand-in for the SDK-backed {@link CidrValidationService}. The real check needs the WASM
 * SDK booted, which Storybook doesn't do — this lightweight IPv4/IPv6 shape check is enough to
 * exercise the editor's per-row validation UI.
 */
const isValidCidr = (value: string): boolean => {
  const v = value.trim();
  return /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(v) || /^[0-9a-f:]+\/\d{1,3}$/i.test(v);
};

/** Builds the host-owned CIDR array the parent form would pass in. */
function cidrArray(
  values: string[],
  { withArrayValidators = false, touched = false } = {},
): IpAllowlistCidrsArray {
  const controls = values.map((v) => cidrRowControl(v, INVALID_CIDR_MESSAGE, isValidCidr));
  const array: IpAllowlistCidrsArray = new FormArray(
    controls,
    withArrayValidators ? [noDuplicateCidrsValidator(), atLeastOneNonEmptyCidrValidator()] : [],
  );
  if (touched) {
    array.markAllAsTouched();
  }
  return array;
}

export default {
  title: "Web/PAM/IP Allowlist Editor",
  component: IpAllowlistEditorComponent,
  decorators: [
    moduleMetadata({
      providers: [
        { provide: CidrValidationService, useValue: { isValid: isValidCidr } },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              accessRuleIpAllowlistHelpText:
                "Only requests originating from these IP ranges will be allowed.",
              accessRuleIpAllowlistCidrLabel: "CIDR range",
              accessRuleIpAllowlistCidrPlaceholder: "e.g. 10.0.0.0/8",
              accessRuleIpAllowlistRemoveRow: "Remove CIDR range",
              accessRuleIpAllowlistDuplicateCidr: "This CIDR range has already been added.",
              accessRuleIpAllowlistAtLeastOne: "Add at least one CIDR range.",
              accessRuleIpAllowlistAddRow: "Add CIDR range",
              accessRuleIpAllowlistInvalidCidr: INVALID_CIDR_MESSAGE,
            }),
        },
      ],
    }),
  ],
} as Meta<IpAllowlistEditorComponent>;

type Story = StoryObj<IpAllowlistEditorComponent>;

function editorStory(array: IpAllowlistCidrsArray, readonly = false): Story {
  return {
    render: () => ({
      props: { cidrArray: array, readonly },
      template: `<app-pam-ip-allowlist-editor [cidrArray]="cidrArray" [readonly]="readonly" />`,
    }),
  };
}

/** No rows yet — the editor seeds a single blank input to type into. */
export const Empty: Story = editorStory(cidrArray([]));

/** A few configured ranges, each with a remove control. */
export const Populated: Story = editorStory(cidrArray(["10.0.0.0/8", "192.168.0.0/16"]));

/** Read-only mode: values are shown but add/remove controls are hidden. */
export const Readonly: Story = editorStory(cidrArray(["10.0.0.0/8", "192.168.0.0/16"]), true);

/** A row whose value isn't a valid CIDR surfaces a per-row error once touched. */
export const InvalidRow: Story = editorStory(
  cidrArray(["10.0.0.0/8", "not-a-cidr"], { touched: true }),
);

/** Duplicate ranges surface the array-level duplicate error. */
export const DuplicateRanges: Story = editorStory(
  cidrArray(["10.0.0.0/8", "10.0.0.0/8"], { withArrayValidators: true, touched: true }),
);
