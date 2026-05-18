import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { DialogService, ToastService } from "@bitwarden/components";
import {
  CollectionLeasingConfigResponse,
  CollectionLeasingRequest,
  PamApiService,
} from "@bitwarden/pam";

import { PreloadedEnglishI18nModule } from "../../core/tests";

import { CollectionLeasingTabComponent } from "./collection-leasing-tab.component";

class StubPamApiService implements Partial<PamApiService> {
  constructor(
    private initial: { leasingEnabled: boolean; policy: { Kind: string } | null } = {
      leasingEnabled: false,
      policy: null,
    },
  ) {}

  getCollectionLeasingConfig(_id: string) {
    return Promise.resolve(
      new CollectionLeasingConfigResponse({
        CollectionId: _id,
        LeasingEnabled: this.initial.leasingEnabled,
        Policy: this.initial.policy,
      }),
    );
  }

  setCollectionLeasingConfig(_id: string, _request: CollectionLeasingRequest) {
    return Promise.resolve(
      new CollectionLeasingConfigResponse({
        CollectionId: _id,
        LeasingEnabled: _request.leasingEnabled,
        Policy: _request.policy == null ? null : { Kind: _request.policy.kind },
      }),
    );
  }
}

class StubDialogService implements Partial<DialogService> {
  // Confirm everything so the "turn off" story shows the resulting state.
  openSimpleDialog = () => Promise.resolve(true) as ReturnType<DialogService["openSimpleDialog"]>;
}

class StubToastService implements Partial<ToastService> {
  showToast = () => undefined;
}

export default {
  title: "Web/PAM/Collection Leasing Tab",
  component: CollectionLeasingTabComponent,
  decorators: [
    moduleMetadata({
      imports: [CollectionLeasingTabComponent],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        { provide: DialogService, useClass: StubDialogService },
        { provide: ToastService, useClass: StubToastService },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<CollectionLeasingTabComponent>;

export const Disabled: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: PamApiService,
          useValue: new StubPamApiService({ leasingEnabled: false, policy: null }),
        },
      ],
    }),
  ],
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <pam-collection-leasing-tab
        collectionId="col-1"
        [canManage]="true"
      ></pam-collection-leasing-tab>
    `,
  }),
};

export const HumanApproval: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: PamApiService,
          useValue: new StubPamApiService({
            leasingEnabled: true,
            policy: { Kind: "human_approval" },
          }),
        },
      ],
    }),
  ],
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <pam-collection-leasing-tab
        collectionId="col-1"
        [canManage]="true"
      ></pam-collection-leasing-tab>
    `,
  }),
};

export const IpAllowlistPlaceholder: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: PamApiService,
          useValue: new StubPamApiService({
            leasingEnabled: true,
            policy: { Kind: "ip_allowlist" },
          }),
        },
      ],
    }),
  ],
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <pam-collection-leasing-tab
        collectionId="col-1"
        [canManage]="true"
      ></pam-collection-leasing-tab>
    `,
  }),
};

export const TurnOffConfirmation: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: PamApiService,
          useValue: new StubPamApiService({
            leasingEnabled: true,
            policy: { Kind: "human_approval" },
          }),
        },
      ],
    }),
  ],
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <p class="tw-mb-3 tw-text-muted">
        Untick the master toggle to see the confirmation dialog (the stub auto-confirms).
      </p>
      <pam-collection-leasing-tab
        collectionId="col-1"
        [canManage]="true"
      ></pam-collection-leasing-tab>
    `,
  }),
};

export const ReadOnly: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: PamApiService,
          useValue: new StubPamApiService({
            leasingEnabled: true,
            policy: { Kind: "human_approval" },
          }),
        },
      ],
    }),
  ],
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <pam-collection-leasing-tab
        collectionId="col-1"
        [canManage]="false"
      ></pam-collection-leasing-tab>
    `,
  }),
};
