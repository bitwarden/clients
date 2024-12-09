import { DatePipe } from "@angular/common";
import { Directive, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { concatMap, firstValueFrom, map, Observable, Subject, takeUntil } from "rxjs";

import { CollectionService, CollectionView } from "@bitwarden/admin-console/common";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import {
  isMember,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { OrganizationUserStatusType, PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { normalizeExpiryYearFormat } from "@bitwarden/common/autofill/utils";
import { ClientType, EventType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { CollectionId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType, SecureNoteType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";
import { SshKeyView } from "@bitwarden/common/vault/models/view/ssh-key.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { DialogService } from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

@Directive()
export class AddEditComponent implements OnInit, OnDestroy {
  @Input() cloneMode = false;
  @Input() folderId: string = null;
  @Input() cipherId: string;
  @Input() type: CipherType;
  @Input() collectionIds: string[];
  @Input() organizationId: string = null;
  @Input() collectionId: string = null;
  @Output() onSavedCipher = new EventEmitter<CipherView>();
  @Output() onDeletedCipher = new EventEmitter<CipherView>();
  @Output() onRestoredCipher = new EventEmitter<CipherView>();
  @Output() onCancelled = new EventEmitter<CipherView>();
  @Output() onEditAttachments = new EventEmitter<CipherView>();
  @Output() onShareCipher = new EventEmitter<CipherView>();
  @Output() onEditCollections = new EventEmitter<CipherView>();
  @Output() onGeneratePassword = new EventEmitter();
  @Output() onGenerateUsername = new EventEmitter();

  canDeleteCipher$: Observable<boolean>;

  editMode = false;
  cipher: CipherView;
  folders$: Observable<FolderView[]>;
  collections: CollectionView[] = [];
  title: string;
  formPromise: Promise<any>;
  deletePromise: Promise<any>;
  restorePromise: Promise<any>;
  checkPasswordPromise: Promise<number>;
  showPassword = false;
  showPrivateKey = false;
  showTotpSeed = false;
  showCardNumber = false;
  showCardCode = false;
  cipherType = CipherType;
  typeOptions: any[];
  cardBrandOptions: any[];
  cardExpMonthOptions: any[];
  identityTitleOptions: any[];
  uriMatchOptions: any[];
  ownershipOptions: any[] = [];
  autofillOnPageLoadOptions: any[];
  currentDate = new Date();
  allowPersonal = true;
  reprompt = false;
  canUseReprompt = true;
  organization: Organization;
  /**
   * Flag to determine if the action is being performed from the admin console.
   */
  isAdminConsoleAction: boolean = false;

  protected componentName = "";
  protected destroy$ = new Subject<void>();
  protected writeableCollections: CollectionView[];
  private personalOwnershipPolicyAppliesToActiveUser: boolean;
  private previousCipherId: string;

  get fido2CredentialCreationDateValue(): string {
    const dateCreated = this.i18nService.t("dateCreated");
    const creationDate = this.datePipe.transform(
      this.cipher?.login?.fido2Credentials?.[0]?.creationDate,
      "short",
    );
    return `${dateCreated} ${creationDate}`;
  }

  constructor(
    protected cipherService: CipherService,
    protected folderService: FolderService,
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected auditService: AuditService,
    protected accountService: AccountService,
    protected collectionService: CollectionService,
    protected messagingService: MessagingService,
    protected eventCollectionService: EventCollectionService,
    protected policyService: PolicyService,
    protected logService: LogService,
    protected passwordRepromptService: PasswordRepromptService,
    private organizationService: OrganizationService,
    protected sendApiService: SendApiService,
    protected dialogService: DialogService,
    protected win: Window,
    protected datePipe: DatePipe,
    protected configService: ConfigService,
    protected cipherAuthorizationService: CipherAuthorizationService,
  ) {
    this.typeOptions = [
      { name: i18nService.t("typeLogin"), value: CipherType.Login },
      { name: i18nService.t("typeCard"), value: CipherType.Card },
      { name: i18nService.t("typeIdentity"), value: CipherType.Identity },
      { name: i18nService.t("typeSecureNote"), value: CipherType.SecureNote },
    ];

    this.cardBrandOptions = [
      { name: "-- " + i18nService.t("select") + " --", value: null },
      { name: "Visa", value: "Visa" },
      { name: "Mastercard", value: "Mastercard" },
      { name: "American Express", value: "Amex" },
      { name: "Discover", value: "Discover" },
      { name: "Diners Club", value: "Diners Club" },
      { name: "JCB", value: "JCB" },
      { name: "Maestro", value: "Maestro" },
      { name: "UnionPay", value: "UnionPay" },
      { name: "RuPay", value: "RuPay" },
      { name: i18nService.t("other"), value: "Other" },
    ];
    this.cardExpMonthOptions = [
      { name: "-- " + i18nService.t("select") + " --", value: null },
      { name: "01 - " + i18nService.t("january"), value: "1" },
      { name: "02 - " + i18nService.t("february"), value: "2" },
      { name: "03 - " + i18nService.t("march"), value: "3" },
      { name: "04 - " + i18nService.t("april"), value: "4" },
      { name: "05 - " + i18nService.t("may"), value: "5" },
      { name: "06 - " + i18nService.t("june"), value: "6" },
      { name: "07 - " + i18nService.t("july"), value: "7" },
      { name: "08 - " + i18nService.t("august"), value: "8" },
      { name: "09 - " + i18nService.t("september"), value: "9" },
      { name: "10 - " + i18nService.t("october"), value: "10" },
      { name: "11 - " + i18nService.t("november"), value: "11" },
      { name: "12 - " + i18nService.t("december"), value: "12" },
    ];
    this.identityTitleOptions = [
      { name: "-- " + i18nService.t("select") + " --", value: null },
      { name: i18nService.t("mr"), value: i18nService.t("mr") },
      { name: i18nService.t("mrs"), value: i18nService.t("mrs") },
      { name: i18nService.t("ms"), value: i18nService.t("ms") },
      { name: i18nService.t("mx"), value: i18nService.t("mx") },
      { name: i18nService.t("dr"), value: i18nService.t("dr") },
    ];
    this.uriMatchOptions = [
      { name: i18nService.t("defaultMatchDetection"), value: null },
      { name: i18nService.t("baseDomain"), value: UriMatchStrategy.Domain },
      { name: i18nService.t("host"), value: UriMatchStrategy.Host },
      { name: i18nService.t("startsWith"), value: UriMatchStrategy.StartsWith },
      { name: i18nService.t("regEx"), value: UriMatchStrategy.RegularExpression },
      { name: i18nService.t("exact"), value: UriMatchStrategy.Exact },
      { name: i18nService.t("never"), value: UriMatchStrategy.Never },
    ];
    this.autofillOnPageLoadOptions = [
      { name: i18nService.t("autoFillOnPageLoadUseDefault"), value: null },
      { name: i18nService.t("autoFillOnPageLoadYes"), value: true },
      { name: i18nService.t("autoFillOnPageLoadNo"), value: false },
    ];
  }

  async ngOnInit() {
    this.policyService
      .policyAppliesToActiveUser$(PolicyType.PersonalOwnership)
      .pipe(
        concatMap(async (policyAppliesToActiveUser) => {
          this.personalOwnershipPolicyAppliesToActiveUser = policyAppliesToActiveUser;
          await this.init();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.writeableCollections = await this.loadCollections();
    this.canUseReprompt = await this.passwordRepromptService.enabled();

    const sshKeysEnabled = await this.configService.getFeatureFlag(FeatureFlag.SSHKeyVaultItem);
    if (this.platformUtilsService.getClientType() == ClientType.Desktop && sshKeysEnabled) {
      this.typeOptions.push({ name: this.i18nService.t("typeSshKey"), value: CipherType.SshKey });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async init() {
    if (this.ownershipOptions.length) {
      this.ownershipOptions = [];
    }
    if (this.personalOwnershipPolicyAppliesToActiveUser) {
      this.allowPersonal = false;
    } else {
      const myEmail = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.email)),
      );
      this.ownershipOptions.push({ name: myEmail, value: null });
    }

    const orgs = await this.organizationService.getAll();
    orgs
      .filter(isMember)
      .sort(Utils.getSortFunction(this.i18nService, "name"))
      .forEach((o) => {
        if (o.enabled && o.status === OrganizationUserStatusType.Confirmed) {
          this.ownershipOptions.push({ name: o.name, value: o.id });
        }
      });
    if (!this.allowPersonal && this.organizationId == undefined) {
      this.organizationId = this.defaultOwnerId;
    }
  }

  async load() {
    this.editMode = this.cipherId != null;
    if (this.editMode) {
      this.editMode = true;
      if (this.cloneMode) {
        this.cloneMode = true;
        this.title = this.i18nService.t("addItem");
      } else {
        this.title = this.i18nService.t("editItem");
      }
    } else {
      this.title = this.i18nService.t("addItem");
    }

    const loadedAddEditCipherInfo = await this.loadAddEditCipherInfo();

    if (this.cipher == null) {
      if (this.editMode) {
        const cipher = await this.loadCipher();
        const activeUserId = await firstValueFrom(
          this.accountService.activeAccount$.pipe(map((a) => a?.id)),
        );
        this.cipher = await cipher.decrypt(
          await this.cipherService.getKeyForCipherKeyDecryption(cipher, activeUserId),
        );

        // Adjust Cipher Name if Cloning
        if (this.cloneMode) {
          this.cipher.name += " - " + this.i18nService.t("clone");
          // If not allowing personal ownership, update cipher's org Id to prompt downstream changes
          if (this.cipher.organizationId == null && !this.allowPersonal) {
            this.cipher.organizationId = this.organizationId;
          }
        }
      } else {
        this.cipher = new CipherView();
        this.cipher.organizationId = this.organizationId == null ? null : this.organizationId;
        this.cipher.folderId = this.folderId;
        this.cipher.type = this.type == null ? CipherType.Login : this.type;
        this.cipher.login = new LoginView();
        this.cipher.login.uris = [new LoginUriView()];
        this.cipher.card = new CardView();
        this.cipher.identity = new IdentityView();
        this.cipher.secureNote = new SecureNoteView();
        this.cipher.secureNote.type = SecureNoteType.Generic;
        this.cipher.sshKey = new SshKeyView();
        this.cipher.reprompt = CipherRepromptType.None;
      }
    }

    if (this.cipher != null && (!this.editMode || loadedAddEditCipherInfo || this.cloneMode)) {
      await this.organizationChanged();
      if (
        this.collectionIds != null &&
        this.collectionIds.length > 0 &&
        this.collections.length > 0
      ) {
        this.collections.forEach((c) => {
          if (this.collectionIds.indexOf(c.id) > -1) {
            (c as any).checked = true;
          }
        });
      }
    }
    // Only Admins can clone a cipher to different owner
    if (this.cloneMode && this.cipher.organizationId != null) {
      const cipherOrg = (await firstValueFrom(this.organizationService.memberOrganizations$)).find(
        (o) => o.id === this.cipher.organizationId,
      );

      if (cipherOrg != null && !cipherOrg.isAdmin && !cipherOrg.permissions.editAnyCollection) {
        this.ownershipOptions = [{ name: cipherOrg.name, value: cipherOrg.id }];
      }
    }

    // We don't want to copy passkeys when we clone a cipher
    if (this.cloneMode && this.cipher?.login?.hasFido2Credentials) {
      this.cipher.login.fido2Credentials = null;
    }

    this.folders$ = this.folderService.folderViews$;

    if (this.editMode && this.previousCipherId !== this.cipherId) {
      void this.eventCollectionService.collectMany(EventType.Cipher_ClientViewed, [this.cipher]);
    }
    this.previousCipherId = this.cipherId;
    this.reprompt = this.cipher.reprompt !== CipherRepromptType.None;
    if (this.reprompt) {
      this.cipher.login.autofillOnPageLoad = this.autofillOnPageLoadOptions[2].value;
    }

    this.canDeleteCipher$ = this.cipherAuthorizationService.canDeleteCipher$(
      this.cipher,
      [this.collectionId as CollectionId],
      this.isAdminConsoleAction,
    );
  }

  async submit(): Promise<boolean> {
    if (this.cipher.isDeleted) {
      return this.restore();
    }

    // normalize card expiry year on save
    if (this.cipher.type === this.cipherType.Card) {
      this.cipher.card.expYear = normalizeExpiryYearFormat(this.cipher.card.expYear);
    }

    // trim whitespace from the TOTP field
    if (this.cipher.type === this.cipherType.Login && this.cipher.login.totp) {
      this.cipher.login.totp = this.cipher.login.totp.trim();
    }

    if (this.cipher.name == null || this.cipher.name === "") {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("nameRequired"),
      );
      return false;
    }

    if (
      (!this.editMode || this.cloneMode) &&
      !this.allowPersonal &&
      this.cipher.organizationId == null
    ) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("personalOwnershipSubmitError"),
      );
      return false;
    }

    if (
      (!this.editMode || this.cloneMode) &&
      this.cipher.type === CipherType.Login &&
      this.cipher.login.uris != null &&
      this.cipher.login.uris.length === 1 &&
      (this.cipher.login.uris[0].uri == null || this.cipher.login.uris[0].uri === "")
    ) {
      this.cipher.login.uris = [];
    }

    // Allows saving of selected collections during "Add" and "Clone" flows
    if ((!this.editMode || this.cloneMode) && this.cipher.organizationId != null) {
      this.cipher.collectionIds =
        this.collections == null
          ? []
          : this.collections.filter((c) => (c as any).checked).map((c) => c.id);
    }

    // Clear current Cipher Id if exists to trigger "Add" cipher flow
    if (this.cloneMode) {
      this.cipher.id = null;
    }

    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );
    const cipher = await this.encryptCipher(activeUserId);
    try {
      this.formPromise = this.saveCipher(cipher);
      await this.formPromise;
      this.cipher.id = cipher.id;
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t(this.editMode && !this.cloneMode ? "editedItem" : "addedItem"),
      );
      this.onSavedCipher.emit(this.cipher);
      this.messagingService.send(this.editMode && !this.cloneMode ? "editedCipher" : "addedCipher");
      return true;
    } catch (e) {
      this.logService.error(e);
    }

    return false;
  }

  addUri() {
    if (this.cipher.type !== CipherType.Login) {
      return;
    }

    if (this.cipher.login.uris == null) {
      this.cipher.login.uris = [];
    }

    this.cipher.login.uris.push(new LoginUriView());
  }

  removeUri(uri: LoginUriView) {
    if (this.cipher.type !== CipherType.Login || this.cipher.login.uris == null) {
      return;
    }

    const i = this.cipher.login.uris.indexOf(uri);
    if (i > -1) {
      this.cipher.login.uris.splice(i, 1);
    }
  }

  removePasskey() {
    if (this.cipher.type !== CipherType.Login || this.cipher.login.fido2Credentials == null) {
      return;
    }

    this.cipher.login.fido2Credentials = null;
  }

  onCardNumberChange(): void {
    this.cipher.card.brand = CardView.getCardBrandByPatterns(this.cipher.card.number);
  }

  getCardExpMonthDisplay() {
    return this.cardExpMonthOptions.find((x) => x.value == this.cipher.card.expMonth)?.name;
  }

  trackByFunction(index: number, item: any) {
    return index;
  }

  cancel() {
    this.onCancelled.emit(this.cipher);
  }

  attachments() {
    this.onEditAttachments.emit(this.cipher);
  }

  share() {
    this.onShareCipher.emit(this.cipher);
  }

  editCollections() {
    this.onEditCollections.emit(this.cipher);
  }

  async delete(): Promise<boolean> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteItem" },
      content: {
        key: this.cipher.isDeleted ? "permanentlyDeleteItemConfirmation" : "deleteItemConfirmation",
      },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    try {
      this.deletePromise = this.deleteCipher();
      await this.deletePromise;
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t(this.cipher.isDeleted ? "permanentlyDeletedItem" : "deletedItem"),
      );
      this.onDeletedCipher.emit(this.cipher);
      this.messagingService.send(
        this.cipher.isDeleted ? "permanentlyDeletedCipher" : "deletedCipher",
      );
    } catch (e) {
      this.logService.error(e);
    }

    return true;
  }

  async restore(): Promise<boolean> {
    if (!this.cipher.isDeleted) {
      return false;
    }

    try {
      this.restorePromise = this.restoreCipher();
      await this.restorePromise;
      this.platformUtilsService.showToast("success", null, this.i18nService.t("restoredItem"));
      this.onRestoredCipher.emit(this.cipher);
      this.messagingService.send("restoredCipher");
    } catch (e) {
      this.logService.error(e);
    }

    return true;
  }

  async generateUsername(): Promise<boolean> {
    if (this.cipher.login?.username?.length) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "overwriteUsername" },
        content: { key: "overwriteUsernameConfirmation" },
        type: "warning",
      });

      if (!confirmed) {
        return false;
      }
    }

    this.onGenerateUsername.emit();
    return true;
  }

  async generatePassword(): Promise<boolean> {
    if (this.cipher.login?.password?.length) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "overwritePassword" },
        content: { key: "overwritePasswordConfirmation" },
        type: "warning",
      });

      if (!confirmed) {
        return false;
      }
    }

    this.onGeneratePassword.emit();
    return true;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;

    if (this.editMode && this.showPassword) {
      document.getElementById("loginPassword")?.focus();

      void this.eventCollectionService.collectMany(EventType.Cipher_ClientToggledPasswordVisible, [
        this.cipher,
      ]);
    }
  }

  toggleTotpSeed() {
    this.showTotpSeed = !this.showTotpSeed;

    if (this.editMode && this.showTotpSeed) {
      document.getElementById("loginTotp")?.focus();

      void this.eventCollectionService.collectMany(EventType.Cipher_ClientToggledTOTPSeedVisible, [
        this.cipher,
      ]);
    }
  }

  async toggleCardNumber() {
    this.showCardNumber = !this.showCardNumber;
    if (this.showCardNumber) {
      void this.eventCollectionService.collectMany(
        EventType.Cipher_ClientToggledCardNumberVisible,
        [this.cipher],
      );
    }
  }

  toggleCardCode() {
    this.showCardCode = !this.showCardCode;
    document.getElementById("cardCode").focus();
    if (this.editMode && this.showCardCode) {
      void this.eventCollectionService.collectMany(EventType.Cipher_ClientToggledCardCodeVisible, [
        this.cipher,
      ]);
    }
  }

  togglePrivateKey() {
    this.showPrivateKey = !this.showPrivateKey;
  }

  toggleUriOptions(uri: LoginUriView) {
    const u = uri as any;
    u.showOptions = u.showOptions == null && uri.match != null ? false : !u.showOptions;
  }

  loginUriMatchChanged(uri: LoginUriView) {
    const u = uri as any;
    u.showOptions = u.showOptions == null ? true : u.showOptions;
  }

  async organizationChanged() {
    if (this.writeableCollections != null) {
      this.writeableCollections.forEach((c) => ((c as any).checked = false));
    }
    if (this.cipher.organizationId != null) {
      this.collections = this.writeableCollections?.filter(
        (c) => c.organizationId === this.cipher.organizationId,
      );
      // If there's only one collection, check it by default
      if (this.collections.length === 1) {
        (this.collections[0] as any).checked = true;
      }
      const org = await this.organizationService.get(this.cipher.organizationId);
      if (org != null) {
        this.cipher.organizationUseTotp = org.useTotp;
      }
    } else {
      this.collections = [];
    }
  }

  async checkPassword() {
    if (this.checkPasswordPromise != null) {
      return;
    }

    if (
      this.cipher.login == null ||
      this.cipher.login.password == null ||
      this.cipher.login.password === ""
    ) {
      return;
    }

    this.checkPasswordPromise = this.auditService.passwordLeaked(this.cipher.login.password);
    const matches = await this.checkPasswordPromise;
    this.checkPasswordPromise = null;

    if (matches > 0) {
      this.platformUtilsService.showToast(
        "warning",
        null,
        this.i18nService.t("passwordExposed", matches.toString()),
      );
    } else {
      this.platformUtilsService.showToast("success", null, this.i18nService.t("passwordSafe"));
    }
  }

  repromptChanged() {
    this.reprompt = !this.reprompt;
    if (this.reprompt) {
      this.cipher.reprompt = CipherRepromptType.Password;
      this.cipher.login.autofillOnPageLoad = this.autofillOnPageLoadOptions[2].value;
    } else {
      this.cipher.reprompt = CipherRepromptType.None;
      this.cipher.login.autofillOnPageLoad = this.autofillOnPageLoadOptions[0].value;
    }
  }

  protected async loadCollections() {
    const allCollections = await this.collectionService.getAllDecrypted();
    return allCollections.filter((c) => !c.readOnly);
  }

  protected loadCipher() {
    return this.cipherService.get(this.cipherId);
  }

  protected encryptCipher(userId: UserId) {
    return this.cipherService.encrypt(this.cipher, userId);
  }

  protected saveCipher(cipher: Cipher) {
    let orgAdmin = this.organization?.canEditAllCiphers;

    // if a cipher is unassigned we want to check if they are an admin or have permission to edit any collection
    if (!cipher.collectionIds) {
      orgAdmin = this.organization?.canEditUnassignedCiphers;
    }

    return this.cipher.id == null
      ? this.cipherService.createWithServer(cipher, orgAdmin)
      : this.cipherService.updateWithServer(cipher, orgAdmin);
  }

  protected deleteCipher() {
    return this.cipher.isDeleted
      ? this.cipherService.deleteWithServer(this.cipher.id, this.asAdmin)
      : this.cipherService.softDeleteWithServer(this.cipher.id, this.asAdmin);
  }

  protected restoreCipher() {
    return this.cipherService.restoreWithServer(this.cipher.id, this.asAdmin);
  }

  /**
   * Determines if a cipher must be deleted as an admin by belonging to an organization and being unassigned to a collection.
   */
  get asAdmin(): boolean {
    return (
      this.cipher.organizationId !== null &&
      this.cipher.organizationId.length > 0 &&
      (this.organization?.canEditAllCiphers ||
        !this.cipher.collectionIds ||
        this.cipher.collectionIds.length === 0)
    );
  }

  get defaultOwnerId(): string | null {
    return this.ownershipOptions[0].value;
  }

  async loadAddEditCipherInfo(): Promise<boolean> {
    const addEditCipherInfo: any = await firstValueFrom(this.cipherService.addEditCipherInfo$);
    const loadedSavedInfo = addEditCipherInfo != null;

    if (loadedSavedInfo) {
      this.cipher = addEditCipherInfo.cipher;
      this.collectionIds = addEditCipherInfo.collectionIds;

      if (!this.editMode && !this.allowPersonal && this.cipher.organizationId == null) {
        // This is a new cipher and personal ownership isn't allowed, so we need to set the default owner
        this.cipher.organizationId = this.defaultOwnerId;
      }
    }

    await this.cipherService.setAddEditCipherInfo(null);

    return loadedSavedInfo;
  }

  async copy(value: string, typeI18nKey: string, aType: string): Promise<boolean> {
    if (value == null) {
      return false;
    }

    const copyOptions = this.win != null ? { window: this.win } : null;
    this.platformUtilsService.copyToClipboard(value, copyOptions);
    this.platformUtilsService.showToast(
      "info",
      null,
      this.i18nService.t("valueCopied", this.i18nService.t(typeI18nKey)),
    );

    if (typeI18nKey === "password") {
      void this.eventCollectionService.collectMany(EventType.Cipher_ClientCopiedPassword, [
        this.cipher,
      ]);
    } else if (typeI18nKey === "securityCode") {
      void this.eventCollectionService.collectMany(EventType.Cipher_ClientCopiedCardCode, [
        this.cipher,
      ]);
    } else if (aType === "H_Field") {
      void this.eventCollectionService.collectMany(EventType.Cipher_ClientCopiedHiddenField, [
        this.cipher,
      ]);
    }

    return true;
  }
}
