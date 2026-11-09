import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { DialogService, I18nMockService } from "@bitwarden/components";
import { UserId } from "@bitwarden/user-core";

import { SendPolicyService } from "../services/send-policy.service";

import { SendTableV2Component } from "./send-table-v2.component";

function createMockSend(id: number, overrides: Partial<SendView> = {}): SendView {
  const send = new SendView();

  send.id = `send-${id}`;
  send.name = "My Send";
  send.type = SendType.Text;
  send.authType = AuthType.None;
  send.deletionDate = new Date("2030-01-01T12:00:00Z");
  send.password = null as any;

  Object.assign(send, overrides);

  return send;
}

const sends: SendView[] = [
  createMockSend(0, {
    name: "Project Documentation",
    type: SendType.Text,
  }),
  createMockSend(1, {
    name: "Meeting Notes",
    type: SendType.File,
  }),
  createMockSend(2, {
    name: "Password Protected Send",
    type: SendType.Text,
    authType: AuthType.Password,
    password: "123",
  }),
  createMockSend(3, {
    name: "Email Protected Send",
    type: SendType.Text,
    authType: AuthType.Email,
    emails: ["ckent@dailyplanet.com"],
  }),
  createMockSend(4, {
    name: "Disabled Send",
    type: SendType.Text,
    disabled: true,
  }),
  createMockSend(5, {
    name: "Expired Send",
    type: SendType.File,
    expirationDate: new Date("2025-12-01T00:00:00Z"),
  }),
  createMockSend(6, {
    name: "Max Access Reached",
    type: SendType.Text,
    authType: AuthType.Password,
    maxAccessCount: 5,
    accessCount: 5,
    password: "123",
  }),
];

function decorators() {
  return [
    moduleMetadata({
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              search: "Search",
              type: "Type",
              all: "All",
              sendTypeText: "Text",
              sendTypeFile: "File",
              item: "Item",
              name: "Name",
              passwordProtected: "Password protected",
              emailProtected: "Email protected",
              expired: "Expired",
              maxAccessCountReached: "Max access count reached",
              pendingDeletion: "Pending deletion",
              deletionDate: "Deletion Date",
              options: "Options",
              disabled: "Disabled",
              copySendLink: "Copy Send link",
              removePassword: "Remove password",
              delete: "Delete",
              loading: "Loading",
              sendsTitleNoItemsV2: "You have no Sends",
              sendsBodyNoItemsV2:
                "Share text or files securely with anyone. Your information will be end-to-end encrypted.",
              noItemsMatchSelectedFilters: "No items match selected filters",
              clearAll: "Clear all",
              sendNotCompliantWithYourOrgsPolicy:
                "Not compliant with your organization's Send policy",
              removeEmailVerification: "Remove email verification",
              itemCount: (num) => `${num} Items`,
              create: "Create",
            });
          },
        },
        { provide: DialogService, useValue: { open: () => ({ closed: of(undefined) }) } },
        {
          provide: BillingAccountProfileStateService,
          useValue: { hasPremiumFromAnySource$: () => of(true) },
        },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({ id: "test-user-id" as UserId }),
          } as Partial<AccountService>,
        },
        {
          provide: SendPolicyService,
          useValue: { allowedSendTypes$: of([SendType.Text, SendType.File, SendType.Item]) },
        },
        { provide: PremiumUpgradePromptService, useValue: { promptForPremium: async () => {} } },
      ],
    }),
  ];
}

export default {
  title: "Tools/Sends/Send Table V2",
  component: SendTableV2Component,
  argTypes: {
    addSend: { action: "addSend" },
    editSend: { action: "editSend" },
    copySend: { action: "copySend" },
    removeAuth: { action: "removeAuth" },
    deleteSend: { action: "deleteSend" },
  },
} as Meta<SendTableV2Component>;

type Story = StoryObj<SendTableV2Component>;

export const Default: Story = {
  decorators: decorators(),
  args: {
    sends,
    disableSend: true,
  },
};

export const Empty: Story = {
  decorators: decorators(),
  args: {
    sends: [],
    disableSend: true,
  },
};
