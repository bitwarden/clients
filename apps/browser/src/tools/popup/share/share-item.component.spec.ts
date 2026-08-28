import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ToastService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { SendPolicyService } from "@bitwarden/send-ui";
import { ShareLinkService } from "@bitwarden/tools-share";

import { PopupRouterCacheService } from "../../../platform/popup/view-cache/popup-router-cache.service";

import { ShareItemComponent } from "./share-item.component";

describe("ShareItemComponent", () => {
  let component: ShareItemComponent;
  let fixture: ComponentFixture<ShareItemComponent>;
  let cipherService: MockProxy<CipherService>;

  const queryParams$ = new BehaviorSubject<Record<string, string>>({
    cipherId: "cipher-123" as CipherId,
  });

  const mockCipher = Object.assign(new CipherView(), {
    id: "cipher-123",
    name: "Test Login",
    type: CipherType.Login,
    login: { username: "user@example.com", uris: [] },
  });

  const mockUserId = "user-123" as UserId;

  beforeEach(async () => {
    cipherService = mock<CipherService>();
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    cipherService.cipherView$.mockReturnValue(of(mockCipher));

    const collectionService = mock<CollectionService>();
    collectionService.decryptedCollections$.mockReturnValue(of([]));

    const folderService = mock<FolderService>();
    folderService.folderViews$.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, ShareItemComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { queryParams: queryParams$ },
        },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({
              id: mockUserId,
              ...mockAccountInfoWith({
                email: "test@email.com",
                name: "Test User",
              }),
            }),
          },
        },
        { provide: CipherService, useValue: cipherService },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: I18nService, useValue: i18nService },
        { provide: ShareLinkService, useValue: { links$: of([]), setCipher: () => {} } },
        {
          provide: SendPolicyService,
          useValue: { deletionDatePolicyInfo$: of([]), allowedDomains$: of([]) },
        },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: CollectionService, useValue: collectionService },
        { provide: FolderService, useValue: folderService },
        {
          provide: PopupRouterCacheService,
          useValue: mock<PopupRouterCacheService>(),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShareItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should load cipher from route query params", () => {
    expect(cipherService.cipherView$).toHaveBeenCalledWith(mockUserId, "cipher-123");
  });

  it("should set cipher signal after loading from route", () => {
    expect(component["cipher"]()).toEqual(mockCipher);
  });
});
