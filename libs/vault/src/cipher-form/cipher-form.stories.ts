// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { importProvidersFrom, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { action } from "@storybook/addon-actions";
import {
  applicationConfig,
  componentWrapperDecorator,
  Meta,
  moduleMetadata,
  StoryObj,
} from "@storybook/angular";
import { BehaviorSubject } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionView } from "@bitwarden/admin-console/common";
import { ViewCacheService } from "@bitwarden/angular/platform/view-cache";
import { NudgeStatus, NudgesService } from "@bitwarden/angular/vault";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ClientType } from "@bitwarden/common/enums";
import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { SshKeyData } from "@bitwarden/common/vault/models/data/ssh-key.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { AsyncActionsModule, ButtonModule, ItemModule, ToastService } from "@bitwarden/components";
import {
  CipherFormConfig,
  CipherFormGenerationService,
  PasswordRepromptService,
} from "@bitwarden/vault";
// FIXME: remove `/apps` import from `/libs`
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/src/app/core/tests";

import { SshImportPromptService } from "../services/ssh-import-prompt.service";

import { CipherFormService } from "./abstractions/cipher-form.service";
import { TotpCaptureService } from "./abstractions/totp-capture.service";
import { CipherFormModule } from "./cipher-form.module";
import { CipherFormComponent } from "./components/cipher-form.component";
import { NewItemNudgeComponent } from "./components/new-item-nudge/new-item-nudge.component";
import { CipherFormCacheService } from "./services/default-cipher-form-cache.service";

const defaultConfig: CipherFormConfig = {
  mode: "add",
  cipherType: CipherType.Login,
  admin: false,
  organizationDataOwnershipDisabled: true,
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
    notes: "Example notes",
    viewPassword: true,
    login: Object.assign(new LoginView(), {
      username: "testuser",
      password: "testpassword",
      fido2Credentials: [
        {
          creationDate: new Date(2024, 6, 18),
        },
      ],
      totp: "123456",
    }) as LoginView,
  } as unknown as Cipher,
};

class TestAddEditFormService implements CipherFormService {
  decryptCipher(): Promise<CipherView> {
    return Promise.resolve({ ...defaultConfig.originalCipher } as any);
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
      imports: [
        CipherFormModule,
        AsyncActionsModule,
        ButtonModule,
        ItemModule,
        NewItemNudgeComponent,
      ],
      providers: [
        {
          provide: NudgesService,
          useValue: {
            showNudge$: new BehaviorSubject({
              hasBadgeDismissed: true,
              hasSpotlightDismissed: true,
            } as NudgeStatus),
          },
        },
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
        {
          provide: PasswordRepromptService,
          useValue: {
            enabled$: new BehaviorSubject(true),
          },
        },
        {
          provide: SshImportPromptService,
          useValue: {
            importSshKeyFromClipboard: () => Promise.resolve(new SshKeyData()),
          },
        },
        {
          provide: CipherFormGenerationService,
          useValue: {
            generateInitialPassword: () => Promise.resolve("initial-password"),
            generatePassword: () => Promise.resolve("random-password"),
            generateUsername: () => Promise.resolve("random-username"),
          },
        },
        {
          provide: TotpCaptureService,
          useValue: {
            captureTotpSecret: () => Promise.resolve("some-value"),
            canCaptureTotp: () => true,
          },
        },
        {
          provide: AuditService,
          useValue: {
            passwordLeaked: () => Promise.resolve(0),
          },
        },
        {
          provide: DomainSettingsService,
          useValue: {
            resolvedDefaultUriMatchStrategy$: new BehaviorSubject(UriMatchStrategy.StartsWith),
          },
        },
        {
          provide: AutofillSettingsServiceAbstraction,
          useValue: {
            autofillOnPageLoadDefault$: new BehaviorSubject(true),
          },
        },
        {
          provide: EventCollectionService,
          useValue: {
            collect: () => Promise.resolve(),
          },
        },
        {
          provide: PlatformUtilsService,
          useValue: {
            getClientType: () => ClientType.Browser,
          },
        },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: new BehaviorSubject({ email: "test@example.com" }),
          },
        },
        {
          provide: CipherFormCacheService,
          useValue: {
            getCachedCipherView: (): null => null,
            initializedWithValue: false,
          },
        },
        {
          provide: ViewCacheService,
          useValue: {
            signal: () => signal(null),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getFeatureFlag: () => Promise.resolve(false),
            getFeatureFlag$: () => new BehaviorSubject(false),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParams: {},
            },
          },
        },
        {
          provide: PolicyService,
          useValue: {
            policiesByType$: new BehaviorSubject([]),
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

export const Add: Story = {
  render: (args) => {
    return {
      props: {
        onSave: actionsData.onSave,
        ...args,
      },
      template: /*html*/ `
        <vault-cipher-form [config]="config" (cipherSaved)="onSave($event)" formId="test-form"></vault-cipher-form>
      `,
    };
  },
};

export const Edit: Story = {
  render: (args) => {
    return {
      props: {
        onSave: actionsData.onSave,
        ...args,
      },
      template: /*html*/ `
        <vault-cipher-form [config]="config" (cipherSaved)="onSave($event)" formId="test-form" [submitBtn]="submitBtn">
          <bit-item slot="attachment-button">
            <button bit-item-content type="button">Attachments</button>
          </bit-item>
        </vault-cipher-form>
      `,
    };
  },
  args: {
    config: {
      ...defaultConfig,
      mode: "edit",
      originalCipher: defaultConfig.originalCipher!,
    },
  },
};

export const PartialEdit: Story = {
  ...Add,
  args: {
    config: {
      ...defaultConfig,
      mode: "partial-edit",
      originalCipher: defaultConfig.originalCipher!,
    },
  },
};

export const Clone: Story = {
  ...Add,
  args: {
    config: {
      ...defaultConfig,
      mode: "clone",
      originalCipher: defaultConfig.originalCipher!,
    },
  },
};

export const WithSubmitButton: Story = {
  render: (args) => {
    return {
      props: {
        onSave: actionsData.onSave,
        ...args,
      },
      template: /*html*/ `
      <div class="tw-p-4">
        <vault-cipher-form [config]="config" (cipherSaved)="onSave($event)" formId="test-form" [submitBtn]="submitBtn"></vault-cipher-form>
      </div>
      <div class="tw-p-4">
        <button type="submit" form="test-form" bitButton buttonType="primary" #submitBtn>Submit</button>
      </div>
      `,
    };
  },
};

export const OrganizationDataOwnershipEnabled: Story = {
  ...Add,
  args: {
    config: {
      ...defaultConfig,
      mode: "add",
      organizationDataOwnershipDisabled: false,
      originalCipher: defaultConfig.originalCipher,
      organizations: defaultConfig.organizations!,
    },
  },
};
