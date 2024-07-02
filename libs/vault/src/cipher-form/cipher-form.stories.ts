import { importProvidersFrom } from "@angular/core";
import { action } from "@storybook/addon-actions";
import {
  applicationConfig,
  componentWrapperDecorator,
  Meta,
  moduleMetadata,
  StoryObj,
} from "@storybook/angular";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CipherType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { AsyncActionsModule, ButtonModule, ToastService } from "@bitwarden/components";
import { CipherFormConfig } from "@bitwarden/vault";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/src/app/core/tests";

import { CipherFormService } from "./abstractions/cipher-form.service";
import { CipherFormModule } from "./cipher-form.module";
import { CipherFormComponent } from "./components/cipher-form.component";

const defaultConfig: CipherFormConfig = {
  mode: "add",
  cipherType: CipherType.Login,
  admin: false,
  allowPersonalOwnership: true,
  collections: [
    {
      id: "col1",
      name: "Org 1 Collection 1",
      organizationId: "org1",
    },
    {
      id: "col2",
      name: "Org 1 Collection 2",
      organizationId: "org1",
    },
    {
      id: "colA",
      name: "Org 2 Collection A",
      organizationId: "org2",
    },
  ] as CollectionView[],
  folders: [
    {
      id: undefined,
      name: "No Folder",
    },
    {
      id: "folder2",
      name: "Folder 2",
    },
  ] as FolderView[],
  organizations: [
    {
      id: "org1",
      name: "Organization 1",
    },
    {
      id: "org2",
      name: "Organization 2",
    },
  ] as Organization[],
  originalCipher: {
    id: "123",
    organizationId: "org1",
    name: "Test Cipher",
    folderId: "folder2",
    collectionIds: ["col1"],
    favorite: false,
  } as unknown as Cipher,
};

class TestAddEditFormService implements CipherFormService {
  decryptCipher(): Promise<CipherView> {
    return Promise.resolve(defaultConfig.originalCipher as any);
  }
  async saveCipher(cipher: CipherView): Promise<CipherView> {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return cipher;
  }
}

const actionsData = {
  onSave: action("onSave"),
};

export default {
  title: "Vault/Cipher Form",
  component: CipherFormComponent,
  decorators: [
    moduleMetadata({
      imports: [CipherFormModule, AsyncActionsModule, ButtonModule],
      providers: [
        {
          provide: CipherFormService,
          useClass: TestAddEditFormService,
        },
        {
          provide: ToastService,
          useValue: {
            showToast: action("showToast"),
          },
        },
      ],
    }),
    componentWrapperDecorator(
      (story) => `<div class="tw-bg-background-alt tw-text-main tw-border">${story}</div>`,
    ),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
  args: {
    config: defaultConfig,
  },
  argTypes: {
    config: {
      description: "The configuration object for the form.",
    },
  },
} as Meta;

type Story = StoryObj<CipherFormComponent>;

export const Default: Story = {
  render: (args) => {
    return {
      props: {
        onSave: actionsData.onSave,
        ...args,
      },
      template: /*html*/ `
        <vault-cipher-form [config]="config" (cipherSaved)="onSave($event)" formId="test-form" [submitBtn]="submitBtn"></vault-cipher-form>
        <button type="submit" form="test-form" bitButton buttonType="primary" #submitBtn>Submit</button>
      `,
    };
  },
};

export const Edit: Story = {
  ...Default,
  args: {
    config: {
      ...defaultConfig,
      mode: "edit",
      originalCipher: defaultConfig.originalCipher,
    },
  },
};

export const PartialEdit: Story = {
  ...Default,
  args: {
    config: {
      ...defaultConfig,
      mode: "partial-edit",
      originalCipher: defaultConfig.originalCipher,
    },
  },
};

export const Clone: Story = {
  ...Default,
  args: {
    config: {
      ...defaultConfig,
      mode: "clone",
      originalCipher: defaultConfig.originalCipher,
    },
  },
};

export const NoPersonalOwnership: Story = {
  ...Default,
  args: {
    config: {
      ...defaultConfig,
      mode: "add",
      allowPersonalOwnership: false,
      originalCipher: defaultConfig.originalCipher,
      organizations: defaultConfig.organizations,
    },
  },
};
