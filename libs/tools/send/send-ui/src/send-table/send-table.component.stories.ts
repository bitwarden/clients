import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { TableDataSource, I18nMockService } from "@bitwarden/components";

import { SendTableComponent } from "./send-table.component";

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

const dataSource = new TableDataSource<SendView>();
dataSource.data = [
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

export default {
  title: "Tools/Sends/Send Table",
  component: SendTableComponent,
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              name: "Name",
              deletionDate: "Deletion Date",
              options: "Options",
              disabled: "Disabled",
              passwordProtected: "Password protected",
              emailProtected: "Email protected",
              maxAccessCountReached: "Max access count reached",
              expired: "Expired",
              pendingDeletion: "Pending deletion",
              copySendLink: "Copy Send link",
              removePassword: "Remove password",
              delete: "Delete",
              loading: "Loading",
            });
          },
        },
      ],
    }),
  ],
  args: {
    dataSource,
    disableSend: false,
  },
  argTypes: {
    editSend: { action: "editSend" },
    copySend: { action: "copySend" },
    removePassword: { action: "removePassword" },
    deleteSend: { action: "deleteSend" },
  },
} as Meta<SendTableComponent>;

type Story = StoryObj<SendTableComponent>;

export const Default: Story = {};
