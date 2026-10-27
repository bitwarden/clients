import { mock } from "jest-mock-extended";
import { firstValueFrom, Observable, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherEncryptionService } from "@bitwarden/common/vault/abstractions/cipher-encryption.service";
import { CipherSdkService } from "@bitwarden/common/vault/abstractions/cipher-sdk.service";
import { CipherFileUploadService } from "@bitwarden/common/vault/abstractions/file-upload/cipher-file-upload.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { KeyService } from "@bitwarden/key-management";

import { DesktopCipherService } from "./desktop-cipher.service";

type CtorArgs = ConstructorParameters<typeof DesktopCipherService>;

class TestDesktopCipherService extends DesktopCipherService {
  setFullViews(views$: (userId: UserId) => Observable<CipherView[] | null>) {
    this.cipherViewsWithPartials$ = views$;
  }
}

describe("DesktopCipherService", () => {
  const userId = "user-id" as UserId;
  const cipherEncryptionService = mock<CipherEncryptionService>();
  let service: TestDesktopCipherService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new TestDesktopCipherService(
      mock<KeyService>(),
      mock<CtorArgs[1]>(),
      mock<DomainSettingsService>(),
      mock<ApiService>(),
      mock<I18nService>(),
      mock<AutofillSettingsServiceAbstraction>(),
      mock<CtorArgs[6]>(),
      mock<CipherFileUploadService>(),
      mock<ConfigService>(),
      mock<StateProvider>(),
      mock<AccountService>(),
      mock<LogService>(),
      cipherEncryptionService,
      mock<MessageSender>(),
      mock<CipherSdkService>(),
    );
  });

  it("emits list views from the full-view decrypt", async () => {
    const views = [new CipherView()];
    service.setFullViews(() => of(views));

    expect(await firstValueFrom(service.cipherListViewsWithPartials$(userId))).toBe(views);
    expect(await firstValueFrom(service.cipherListViews$(userId))).toEqual(views);
    expect(cipherEncryptionService.decryptManyWithFailures).not.toHaveBeenCalled();
  });

  it("passes through null while decryption is in progress", async () => {
    service.setFullViews(() => of(null));

    expect(await firstValueFrom(service.cipherListViews$(userId))).toBeNull();
  });
});
