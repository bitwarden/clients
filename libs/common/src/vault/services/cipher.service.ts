import { ApiService } from "../../abstractions/api.service";
import { SearchService } from "../../abstractions/search.service";
import { SettingsService } from "../../abstractions/settings.service";
import { FieldType, UriMatchType } from "../../enums";
import { ErrorResponse } from "../../models/response/error.response";
import { View } from "../../models/view/view";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { EncryptService } from "../../platform/abstractions/encrypt.service";
import { I18nService } from "../../platform/abstractions/i18n.service";
import { StateService } from "../../platform/abstractions/state.service";
import { sequentialize } from "../../platform/misc/sequentialize";
import { Utils } from "../../platform/misc/utils";
import Domain from "../../platform/models/domain/domain-base";
import { EncArrayBuffer } from "../../platform/models/domain/enc-array-buffer";
import { EncString } from "../../platform/models/domain/enc-string";
import {
  OrgKey,
  SymmetricCryptoKey,
  UserKey,
} from "../../platform/models/domain/symmetric-crypto-key";
import { CipherService as CipherServiceAbstraction } from "../abstractions/cipher.service";
import { CipherFileUploadService } from "../abstractions/file-upload/cipher-file-upload.service";
import { CipherType } from "../enums/cipher-type";
import { CipherData } from "../models/data/cipher.data";
import { Attachment } from "../models/domain/attachment";
import { Card } from "../models/domain/card";
import { Cipher } from "../models/domain/cipher";
import { Field } from "../models/domain/field";
import { Identity } from "../models/domain/identity";
import { Login } from "../models/domain/login";
import { LoginUri } from "../models/domain/login-uri";
import { Password } from "../models/domain/password";
import { SecureNote } from "../models/domain/secure-note";
import { SortedCiphersCache } from "../models/domain/sorted-ciphers-cache";
import { CipherBulkDeleteRequest } from "../models/request/cipher-bulk-delete.request";
import { CipherBulkMoveRequest } from "../models/request/cipher-bulk-move.request";
import { CipherBulkRestoreRequest } from "../models/request/cipher-bulk-restore.request";
import { CipherBulkShareRequest } from "../models/request/cipher-bulk-share.request";
import { CipherCollectionsRequest } from "../models/request/cipher-collections.request";
import { CipherCreateRequest } from "../models/request/cipher-create.request";
import { CipherPartialRequest } from "../models/request/cipher-partial.request";
import { CipherShareRequest } from "../models/request/cipher-share.request";
import { CipherRequest } from "../models/request/cipher.request";
import { CipherResponse } from "../models/response/cipher.response";
import { AttachmentView } from "../models/view/attachment.view";
import { CipherView } from "../models/view/cipher.view";
import { FieldView } from "../models/view/field.view";
import { PasswordHistoryView } from "../models/view/password-history.view";

export class CipherService implements CipherServiceAbstraction {
  private sortedCiphersCache: SortedCiphersCache = new SortedCiphersCache(
    this.sortCiphersByLastUsed
  );

  constructor(
    private cryptoService: CryptoService,
    private settingsService: SettingsService,
    private apiService: ApiService,
    private i18nService: I18nService,
    private searchService: SearchService,
    private stateService: StateService,
    private encryptService: EncryptService,
    private cipherFileUploadService: CipherFileUploadService
  ) {}

  async getDecryptedCipherCache(): Promise<CipherView[]> {
    const decryptedCiphers = await this.stateService.getDecryptedCiphers();
    return decryptedCiphers;
  }

  async setDecryptedCipherCache(value: CipherView[]) {
    await this.stateService.setDecryptedCiphers(value);
    if (this.searchService != null) {
      if (value == null) {
        this.searchService.clearIndex();
      } else {
        this.searchService.indexCiphers(value);
      }
    }
  }

  async clearCache(userId?: string): Promise<void> {
    await this.clearDecryptedCiphersState(userId);
  }

  async encrypt(
    model: CipherView,
    key?: SymmetricCryptoKey,
    originalCipher: Cipher = null
  ): Promise<Cipher> {
    // Adjust password history
    if (model.id != null) {
      if (originalCipher == null) {
        originalCipher = await this.get(model.id);
      }
      if (originalCipher != null) {
        const existingCipher = await originalCipher.decrypt();
        model.passwordHistory = existingCipher.passwordHistory || [];
        if (model.type === CipherType.Login && existingCipher.type === CipherType.Login) {
          if (
            existingCipher.login.password != null &&
            existingCipher.login.password !== "" &&
            existingCipher.login.password !== model.login.password
          ) {
            const ph = new PasswordHistoryView();
            ph.password = existingCipher.login.password;
            ph.lastUsedDate = model.login.passwordRevisionDate = new Date();
            model.passwordHistory.splice(0, 0, ph);
          } else {
            model.login.passwordRevisionDate = existingCipher.login.passwordRevisionDate;
          }
        }
        if (existingCipher.hasFields) {
          const existingHiddenFields = existingCipher.fields.filter(
            (f) =>
              f.type === FieldType.Hidden &&
              f.name != null &&
              f.name !== "" &&
              f.value != null &&
              f.value !== ""
          );
          const hiddenFields =
            model.fields == null
              ? []
              : model.fields.filter(
                  (f) => f.type === FieldType.Hidden && f.name != null && f.name !== ""
                );
          existingHiddenFields.forEach((ef) => {
            const matchedField = hiddenFields.find((f) => f.name === ef.name);
            if (matchedField == null || matchedField.value !== ef.value) {
              const ph = new PasswordHistoryView();
              ph.password = ef.name + ": " + ef.value;
              ph.lastUsedDate = new Date();
              model.passwordHistory.splice(0, 0, ph);
            }
          });
        }
      }
      if (model.passwordHistory != null && model.passwordHistory.length === 0) {
        model.passwordHistory = null;
      } else if (model.passwordHistory != null && model.passwordHistory.length > 5) {
        // only save last 5 history
        model.passwordHistory = model.passwordHistory.slice(0, 5);
      }
    }

    const cipher = new Cipher();
    cipher.id = model.id;
    cipher.folderId = model.folderId;
    cipher.favorite = model.favorite;
    cipher.organizationId = model.organizationId;
    cipher.type = model.type;
    cipher.collectionIds = model.collectionIds;
    cipher.revisionDate = model.revisionDate;
    cipher.reprompt = model.reprompt;
    cipher.edit = model.edit;

    if (key == null && cipher.organizationId != null) {
      key = await this.cryptoService.getOrgKey(cipher.organizationId);
      if (key == null) {
        throw new Error("Cannot encrypt cipher for organization. No key.");
      }
    }
    await Promise.all([
      this.encryptObjProperty(
        model,
        cipher,
        {
          name: null,
          notes: null,
        },
        key
      ),
      this.encryptCipherData(cipher, model, key),
      this.encryptFields(model.fields, key).then((fields) => {
        cipher.fields = fields;
      }),
      this.encryptPasswordHistories(model.passwordHistory, key).then((ph) => {
        cipher.passwordHistory = ph;
      }),
      this.encryptAttachments(model.attachments, key).then((attachments) => {
        cipher.attachments = attachments;
      }),
    ]);

    return cipher;
  }

  async encryptAttachments(
    attachmentsModel: AttachmentView[],
    key: SymmetricCryptoKey
  ): Promise<Attachment[]> {
    if (attachmentsModel == null || attachmentsModel.length === 0) {
      return null;
    }

    const promises: Promise<any>[] = [];
    const encAttachments: Attachment[] = [];
    attachmentsModel.forEach(async (model) => {
      const attachment = new Attachment();
      attachment.id = model.id;
      attachment.size = model.size;
      attachment.sizeName = model.sizeName;
      attachment.url = model.url;
      const promise = this.encryptObjProperty(
        model,
        attachment,
        {
          fileName: null,
        },
        key
      ).then(async () => {
        if (model.key != null) {
          attachment.key = await this.cryptoService.encrypt(model.key.key, key);
        }
        encAttachments.push(attachment);
      });
      promises.push(promise);
    });

    await Promise.all(promises);
    return encAttachments;
  }

  async encryptFields(fieldsModel: FieldView[], key: SymmetricCryptoKey): Promise<Field[]> {
    if (!fieldsModel || !fieldsModel.length) {
      return null;
    }

    const self = this;
    const encFields: Field[] = [];
    await fieldsModel.reduce(async (promise, field) => {
      await promise;
      const encField = await self.encryptField(field, key);
      encFields.push(encField);
    }, Promise.resolve());

    return encFields;
  }

  async encryptField(fieldModel: FieldView, key: SymmetricCryptoKey): Promise<Field> {
    const field = new Field();
    field.type = fieldModel.type;
    field.linkedId = fieldModel.linkedId;
    // normalize boolean type field values
    if (fieldModel.type === FieldType.Boolean && fieldModel.value !== "true") {
      fieldModel.value = "false";
    }

    await this.encryptObjProperty(
      fieldModel,
      field,
      {
        name: null,
        value: null,
      },
      key
    );

    return field;
  }

  async encryptPasswordHistories(
    phModels: PasswordHistoryView[],
    key: SymmetricCryptoKey
  ): Promise<Password[]> {
    if (!phModels || !phModels.length) {
      return null;
    }

    const self = this;
    const encPhs: Password[] = [];
    await phModels.reduce(async (promise, ph) => {
      await promise;
      const encPh = await self.encryptPasswordHistory(ph, key);
      encPhs.push(encPh);
    }, Promise.resolve());

    return encPhs;
  }

  async encryptPasswordHistory(
    phModel: PasswordHistoryView,
    key: SymmetricCryptoKey
  ): Promise<Password> {
    const ph = new Password();
    ph.lastUsedDate = phModel.lastUsedDate;

    await this.encryptObjProperty(
      phModel,
      ph,
      {
        password: null,
      },
      key
    );

    return ph;
  }

  async get(id: string): Promise<Cipher> {
    const ciphers = await this.stateService.getEncryptedCiphers();
    // eslint-disable-next-line
    if (ciphers == null || !ciphers.hasOwnProperty(id)) {
      return null;
    }

    const localData = await this.stateService.getLocalData();
    return new Cipher(ciphers[id], localData ? localData[id] : null);
  }

  async getAll(): Promise<Cipher[]> {
    const localData = await this.stateService.getLocalData();
    const ciphers = await this.stateService.getEncryptedCiphers();
    const response: Cipher[] = [];
    for (const id in ciphers) {
      // eslint-disable-next-line
      if (ciphers.hasOwnProperty(id)) {
        response.push(new Cipher(ciphers[id], localData ? localData[id] : null));
      }
    }
    return response;
  }

  @sequentialize(() => "getAllDecrypted")
  async getAllDecrypted(): Promise<CipherView[]> {
    if ((await this.getDecryptedCipherCache()) != null) {
      await this.reindexCiphers();
      return await this.getDecryptedCipherCache();
    }

    const ciphers = await this.getAll();
    const orgKeys = await this.cryptoService.getOrgKeys();
    const userKey = await this.cryptoService.getUserKeyWithLegacySupport();

    // Group ciphers by orgId or under 'null' for the user's ciphers
    const grouped = ciphers.reduce((agg, c) => {
      agg[c.organizationId] ??= [];
      agg[c.organizationId].push(c);
      return agg;
    }, {} as Record<string, Cipher[]>);

    const decCiphers = (
      await Promise.all(
        Object.entries(grouped).map(([orgId, groupedCiphers]) =>
          this.encryptService.decryptItems(groupedCiphers, orgKeys.get(orgId) ?? userKey)
        )
      )
    )
      .flat()
      .sort(this.getLocaleSortingFunction());

    await this.setDecryptedCipherCache(decCiphers);
    return decCiphers;
  }

  private async reindexCiphers() {
    const userId = await this.stateService.getUserId();
    const reindexRequired =
      this.searchService != null && (this.searchService.indexedEntityId ?? userId) !== userId;
    if (reindexRequired) {
      this.searchService.indexCiphers(await this.getDecryptedCipherCache(), userId);
    }
  }

  async getAllDecryptedForGrouping(groupingId: string, folder = true): Promise<CipherView[]> {
    const ciphers = await this.getAllDecrypted();

    return ciphers.filter((cipher) => {
      if (cipher.isDeleted) {
        return false;
      }
      if (folder && cipher.folderId === groupingId) {
        return true;
      } else if (
        !folder &&
        cipher.collectionIds != null &&
        cipher.collectionIds.indexOf(groupingId) > -1
      ) {
        return true;
      }

      return false;
    });
  }

  async getAllDecryptedForUrl(
    url: string,
    includeOtherTypes?: CipherType[],
    defaultMatch: UriMatchType = null
  ): Promise<CipherView[]> {
    if (url == null && includeOtherTypes == null) {
      return Promise.resolve([]);
    }

    const equivalentDomains = this.settingsService.getEquivalentDomains(url);
    const ciphers = await this.getAllDecrypted();
    defaultMatch ??= await this.stateService.getDefaultUriMatch();

    return ciphers.filter((cipher) => {
      const cipherIsLogin = cipher.type === CipherType.Login && cipher.login !== null;

      if (cipher.deletedDate !== null) {
        return false;
      }

      if (
        Array.isArray(includeOtherTypes) &&
        includeOtherTypes.includes(cipher.type) &&
        !cipherIsLogin
      ) {
        return true;
      }

      if (cipherIsLogin) {
        return cipher.login.matchesUri(url, equivalentDomains, defaultMatch);
      }

      return false;
    });
  }

  async getAllFromApiForOrganization(organizationId: string): Promise<CipherView[]> {
    const response = await this.apiService.getCiphersOrganization(organizationId);
    if (response?.data == null || response.data.length < 1) {
      return [];
    }

    const ciphers = response.data.map((cr) => new Cipher(new CipherData(cr)));
    const key = await this.cryptoService.getOrgKey(organizationId);
    const decCiphers = await this.encryptService.decryptItems(ciphers, key);

    decCiphers.sort(this.getLocaleSortingFunction());
    return decCiphers;
  }

  async getLastUsedForUrl(url: string, autofillOnPageLoad = false): Promise<CipherView> {
    return this.getCipherForUrl(url, true, false, autofillOnPageLoad);
  }

  async getLastLaunchedForUrl(url: string, autofillOnPageLoad = false): Promise<CipherView> {
    return this.getCipherForUrl(url, false, true, autofillOnPageLoad);
  }

  async getNextCipherForUrl(url: string): Promise<CipherView> {
    return this.getCipherForUrl(url, false, false, false);
  }

  updateLastUsedIndexForUrl(url: string) {
    this.sortedCiphersCache.updateLastUsedIndex(url);
  }

  async updateLastUsedDate(id: string): Promise<void> {
    let ciphersLocalData = await this.stateService.getLocalData();
    if (!ciphersLocalData) {
      ciphersLocalData = {};
    }

    if (ciphersLocalData[id]) {
      ciphersLocalData[id].lastUsedDate = new Date().getTime();
    } else {
      ciphersLocalData[id] = {
        lastUsedDate: new Date().getTime(),
      };
    }

    await this.stateService.setLocalData(ciphersLocalData);

    const decryptedCipherCache = await this.stateService.getDecryptedCiphers();
    if (!decryptedCipherCache) {
      return;
    }

    for (let i = 0; i < decryptedCipherCache.length; i++) {
      const cached = decryptedCipherCache[i];
      if (cached.id === id) {
        cached.localData = ciphersLocalData[id];
        break;
      }
    }
    await this.stateService.setDecryptedCiphers(decryptedCipherCache);
  }

  async updateLastLaunchedDate(id: string): Promise<void> {
    let ciphersLocalData = await this.stateService.getLocalData();
    if (!ciphersLocalData) {
      ciphersLocalData = {};
    }

    if (ciphersLocalData[id]) {
      ciphersLocalData[id].lastLaunched = new Date().getTime();
    } else {
      ciphersLocalData[id] = {
        lastUsedDate: new Date().getTime(),
      };
    }

    await this.stateService.setLocalData(ciphersLocalData);

    const decryptedCipherCache = await this.stateService.getDecryptedCiphers();
    if (!decryptedCipherCache) {
      return;
    }

    for (let i = 0; i < decryptedCipherCache.length; i++) {
      const cached = decryptedCipherCache[i];
      if (cached.id === id) {
        cached.localData = ciphersLocalData[id];
        break;
      }
    }
    await this.stateService.setDecryptedCiphers(decryptedCipherCache);
  }

  async saveNeverDomain(domain: string): Promise<void> {
    if (domain == null) {
      return;
    }

    let domains = await this.stateService.getNeverDomains();
    if (!domains) {
      domains = {};
    }
    domains[domain] = null;
    await this.stateService.setNeverDomains(domains);
  }

  async createWithServer(cipher: Cipher, orgAdmin?: boolean): Promise<any> {
    let response: CipherResponse;
    if (orgAdmin && cipher.organizationId != null) {
      const request = new CipherCreateRequest(cipher);
      response = await this.apiService.postCipherAdmin(request);
    } else if (cipher.collectionIds != null) {
      const request = new CipherCreateRequest(cipher);
      response = await this.apiService.postCipherCreate(request);
    } else {
      const request = new CipherRequest(cipher);
      response = await this.apiService.postCipher(request);
    }
    cipher.id = response.id;

    const data = new CipherData(response, cipher.collectionIds);
    await this.upsert(data);
  }

  async updateWithServer(cipher: Cipher, orgAdmin?: boolean, isNotClone?: boolean): Promise<any> {
    let response: CipherResponse;
    if (orgAdmin && isNotClone) {
      const request = new CipherRequest(cipher);
      response = await this.apiService.putCipherAdmin(cipher.id, request);
    } else if (cipher.edit) {
      const request = new CipherRequest(cipher);
      response = await this.apiService.putCipher(cipher.id, request);
    } else {
      const request = new CipherPartialRequest(cipher);
      response = await this.apiService.putPartialCipher(cipher.id, request);
    }

    const data = new CipherData(response, cipher.collectionIds);
    await this.upsert(data);
  }

  async shareWithServer(
    cipher: CipherView,
    organizationId: string,
    collectionIds: string[]
  ): Promise<any> {
    const attachmentPromises: Promise<any>[] = [];
    if (cipher.attachments != null) {
      cipher.attachments.forEach((attachment) => {
        if (attachment.key == null) {
          attachmentPromises.push(
            this.shareAttachmentWithServer(attachment, cipher.id, organizationId)
          );
        }
      });
    }
    await Promise.all(attachmentPromises);

    cipher.organizationId = organizationId;
    cipher.collectionIds = collectionIds;
    const encCipher = await this.encrypt(cipher);
    const request = new CipherShareRequest(encCipher);
    const response = await this.apiService.putShareCipher(cipher.id, request);
    const data = new CipherData(response, collectionIds);
    await this.upsert(data);
  }

  async shareManyWithServer(
    ciphers: CipherView[],
    organizationId: string,
    collectionIds: string[]
  ): Promise<any> {
    const promises: Promise<any>[] = [];
    const encCiphers: Cipher[] = [];
    for (const cipher of ciphers) {
      cipher.organizationId = organizationId;
      cipher.collectionIds = collectionIds;
      promises.push(
        this.encrypt(cipher).then((c) => {
          encCiphers.push(c);
        })
      );
    }
    await Promise.all(promises);
    const request = new CipherBulkShareRequest(encCiphers, collectionIds);
    try {
      await this.apiService.putShareCiphers(request);
    } catch (e) {
      for (const cipher of ciphers) {
        cipher.organizationId = null;
        cipher.collectionIds = null;
      }
      throw e;
    }
    await this.upsert(encCiphers.map((c) => c.toCipherData()));
  }

  saveAttachmentWithServer(cipher: Cipher, unencryptedFile: any, admin = false): Promise<Cipher> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsArrayBuffer(unencryptedFile);
      reader.onload = async (evt: any) => {
        try {
          const cData = await this.saveAttachmentRawWithServer(
            cipher,
            unencryptedFile.name,
            evt.target.result,
            admin
          );
          resolve(cData);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => {
        reject("Error reading file.");
      };
    });
  }

  async saveAttachmentRawWithServer(
    cipher: Cipher,
    filename: string,
    data: Uint8Array,
    admin = false
  ): Promise<Cipher> {
    let encKey: UserKey | OrgKey;
    encKey = await this.cryptoService.getOrgKey(cipher.organizationId);
    encKey ||= await this.cryptoService.getUserKeyWithLegacySupport();

    const dataEncKey = await this.cryptoService.makeDataEncKey(encKey);

    const encFileName = await this.encryptService.encrypt(filename, encKey);
    const encData = await this.encryptService.encryptToBytes(data, dataEncKey[0]);

    const response = await this.cipherFileUploadService.upload(
      cipher,
      encFileName,
      encData,
      admin,
      dataEncKey
    );

    const cData = new CipherData(response, cipher.collectionIds);
    if (!admin) {
      await this.upsert(cData);
    }
    return new Cipher(cData);
  }

  async saveCollectionsWithServer(cipher: Cipher): Promise<any> {
    const request = new CipherCollectionsRequest(cipher.collectionIds);
    await this.apiService.putCipherCollections(cipher.id, request);
    const data = cipher.toCipherData();
    await this.upsert(data);
  }

  async upsert(cipher: CipherData | CipherData[]): Promise<any> {
    let ciphers = await this.stateService.getEncryptedCiphers();
    if (ciphers == null) {
      ciphers = {};
    }

    if (cipher instanceof CipherData) {
      const c = cipher as CipherData;
      ciphers[c.id] = c;
    } else {
      (cipher as CipherData[]).forEach((c) => {
        ciphers[c.id] = c;
      });
    }

    await this.replace(ciphers);
  }

  async replace(ciphers: { [id: string]: CipherData }): Promise<any> {
    await this.clearDecryptedCiphersState();
    await this.stateService.setEncryptedCiphers(ciphers);
  }

  async clear(userId?: string): Promise<any> {
    await this.clearEncryptedCiphersState(userId);
    await this.clearCache(userId);
  }

  async moveManyWithServer(ids: string[], folderId: string): Promise<any> {
    await this.apiService.putMoveCiphers(new CipherBulkMoveRequest(ids, folderId));

    let ciphers = await this.stateService.getEncryptedCiphers();
    if (ciphers == null) {
      ciphers = {};
    }

    ids.forEach((id) => {
      // eslint-disable-next-line
      if (ciphers.hasOwnProperty(id)) {
        ciphers[id].folderId = folderId;
      }
    });

    await this.clearCache();
    await this.stateService.setEncryptedCiphers(ciphers);
  }

  async delete(id: string | string[]): Promise<any> {
    const ciphers = await this.stateService.getEncryptedCiphers();
    if (ciphers == null) {
      return;
    }

    if (typeof id === "string") {
      if (ciphers[id] == null) {
        return;
      }
      delete ciphers[id];
    } else {
      (id as string[]).forEach((i) => {
        delete ciphers[i];
      });
    }

    await this.clearCache();
    await this.stateService.setEncryptedCiphers(ciphers);
  }

  async deleteWithServer(id: string, asAdmin = false): Promise<any> {
    if (asAdmin) {
      await this.apiService.deleteCipherAdmin(id);
    } else {
      await this.apiService.deleteCipher(id);
    }

    await this.delete(id);
  }

  async deleteManyWithServer(ids: string[], asAdmin = false): Promise<any> {
    const request = new CipherBulkDeleteRequest(ids);
    if (asAdmin) {
      await this.apiService.deleteManyCiphersAdmin(request);
    } else {
      await this.apiService.deleteManyCiphers(request);
    }
    await this.delete(ids);
  }

  async deleteAttachment(id: string, attachmentId: string): Promise<void> {
    const ciphers = await this.stateService.getEncryptedCiphers();

    // eslint-disable-next-line
    if (ciphers == null || !ciphers.hasOwnProperty(id) || ciphers[id].attachments == null) {
      return;
    }

    for (let i = 0; i < ciphers[id].attachments.length; i++) {
      if (ciphers[id].attachments[i].id === attachmentId) {
        ciphers[id].attachments.splice(i, 1);
      }
    }

    await this.clearCache();
    await this.stateService.setEncryptedCiphers(ciphers);
  }

  async deleteAttachmentWithServer(id: string, attachmentId: string): Promise<void> {
    try {
      await this.apiService.deleteCipherAttachment(id, attachmentId);
    } catch (e) {
      return Promise.reject((e as ErrorResponse).getSingleMessage());
    }
    await this.deleteAttachment(id, attachmentId);
  }

  sortCiphersByLastUsed(a: CipherView, b: CipherView): number {
    const aLastUsed =
      a.localData && a.localData.lastUsedDate ? (a.localData.lastUsedDate as number) : null;
    const bLastUsed =
      b.localData && b.localData.lastUsedDate ? (b.localData.lastUsedDate as number) : null;

    const bothNotNull = aLastUsed != null && bLastUsed != null;
    if (bothNotNull && aLastUsed < bLastUsed) {
      return 1;
    }
    if (aLastUsed != null && bLastUsed == null) {
      return -1;
    }

    if (bothNotNull && aLastUsed > bLastUsed) {
      return -1;
    }
    if (bLastUsed != null && aLastUsed == null) {
      return 1;
    }

    return 0;
  }

  sortCiphersByLastUsedThenName(a: CipherView, b: CipherView): number {
    const result = this.sortCiphersByLastUsed(a, b);
    if (result !== 0) {
      return result;
    }

    return this.getLocaleSortingFunction()(a, b);
  }

  getLocaleSortingFunction(): (a: CipherView, b: CipherView) => number {
    return (a, b) => {
      let aName = a.name;
      let bName = b.name;

      if (aName == null && bName != null) {
        return -1;
      }
      if (aName != null && bName == null) {
        return 1;
      }
      if (aName == null && bName == null) {
        return 0;
      }

      const result = this.i18nService.collator
        ? this.i18nService.collator.compare(aName, bName)
        : aName.localeCompare(bName);

      if (result !== 0 || a.type !== CipherType.Login || b.type !== CipherType.Login) {
        return result;
      }

      if (a.login.username != null) {
        aName += a.login.username;
      }

      if (b.login.username != null) {
        bName += b.login.username;
      }

      return this.i18nService.collator
        ? this.i18nService.collator.compare(aName, bName)
        : aName.localeCompare(bName);
    };
  }

  async softDelete(id: string | string[]): Promise<any> {
    const ciphers = await this.stateService.getEncryptedCiphers();
    if (ciphers == null) {
      return;
    }

    const setDeletedDate = (cipherId: string) => {
      if (ciphers[cipherId] == null) {
        return;
      }
      ciphers[cipherId].deletedDate = new Date().toISOString();
    };

    if (typeof id === "string") {
      setDeletedDate(id);
    } else {
      (id as string[]).forEach(setDeletedDate);
    }

    await this.clearCache();
    await this.stateService.setEncryptedCiphers(ciphers);
  }

  async softDeleteWithServer(id: string, asAdmin = false): Promise<any> {
    if (asAdmin) {
      await this.apiService.putDeleteCipherAdmin(id);
    } else {
      await this.apiService.putDeleteCipher(id);
    }

    await this.softDelete(id);
  }

  async softDeleteManyWithServer(ids: string[], asAdmin = false): Promise<any> {
    const request = new CipherBulkDeleteRequest(ids);
    if (asAdmin) {
      await this.apiService.putDeleteManyCiphersAdmin(request);
    } else {
      await this.apiService.putDeleteManyCiphers(request);
    }

    await this.softDelete(ids);
  }

  async restore(
    cipher: { id: string; revisionDate: string } | { id: string; revisionDate: string }[]
  ) {
    const ciphers = await this.stateService.getEncryptedCiphers();
    if (ciphers == null) {
      return;
    }

    const clearDeletedDate = (c: { id: string; revisionDate: string }) => {
      if (ciphers[c.id] == null) {
        return;
      }
      ciphers[c.id].deletedDate = null;
      ciphers[c.id].revisionDate = c.revisionDate;
    };

    if (cipher.constructor.name === Array.name) {
      (cipher as { id: string; revisionDate: string }[]).forEach(clearDeletedDate);
    } else {
      clearDeletedDate(cipher as { id: string; revisionDate: string });
    }

    await this.clearCache();
    await this.stateService.setEncryptedCiphers(ciphers);
  }

  async restoreWithServer(id: string, asAdmin = false): Promise<any> {
    let response;
    if (asAdmin) {
      response = await this.apiService.putRestoreCipherAdmin(id);
    } else {
      response = await this.apiService.putRestoreCipher(id);
    }

    await this.restore({ id: id, revisionDate: response.revisionDate });
  }

  async restoreManyWithServer(
    ids: string[],
    organizationId: string = null,
    asAdmin = false
  ): Promise<void> {
    let response;
    if (asAdmin) {
      const request = new CipherBulkRestoreRequest(ids, organizationId);
      response = await this.apiService.putRestoreManyCiphersAdmin(request);
    } else {
      const request = new CipherBulkRestoreRequest(ids);
      response = await this.apiService.putRestoreManyCiphers(request);
    }

    const restores: { id: string; revisionDate: string }[] = [];
    for (const cipher of response.data) {
      restores.push({ id: cipher.id, revisionDate: cipher.revisionDate });
    }
    await this.restore(restores);
  }

  // Helpers

  private async shareAttachmentWithServer(
    attachmentView: AttachmentView,
    cipherId: string,
    organizationId: string
  ): Promise<any> {
    const attachmentResponse = await this.apiService.nativeFetch(
      new Request(attachmentView.url, { cache: "no-store" })
    );
    if (attachmentResponse.status !== 200) {
      throw Error("Failed to download attachment: " + attachmentResponse.status.toString());
    }

    const encBuf = await EncArrayBuffer.fromResponse(attachmentResponse);
    const decBuf = await this.cryptoService.decryptFromBytes(encBuf, null);

    let encKey: UserKey | OrgKey;
    encKey = await this.cryptoService.getOrgKey(organizationId);
    encKey ||= (await this.cryptoService.getUserKeyWithLegacySupport()) as UserKey;

    const dataEncKey = await this.cryptoService.makeDataEncKey(encKey);

    const encFileName = await this.encryptService.encrypt(attachmentView.fileName, encKey);
    const encData = await this.encryptService.encryptToBytes(new Uint8Array(decBuf), dataEncKey[0]);

    const fd = new FormData();
    try {
      const blob = new Blob([encData.buffer], { type: "application/octet-stream" });
      fd.append("key", dataEncKey[1].encryptedString);
      fd.append("data", blob, encFileName.encryptedString);
    } catch (e) {
      if (Utils.isNode && !Utils.isBrowser) {
        fd.append("key", dataEncKey[1].encryptedString);
        fd.append(
          "data",
          Buffer.from(encData.buffer) as any,
          {
            filepath: encFileName.encryptedString,
            contentType: "application/octet-stream",
          } as any
        );
      } else {
        throw e;
      }
    }

    try {
      await this.apiService.postShareCipherAttachment(
        cipherId,
        attachmentView.id,
        fd,
        organizationId
      );
    } catch (e) {
      throw new Error((e as ErrorResponse).getSingleMessage());
    }
  }

  private async encryptObjProperty<V extends View, D extends Domain>(
    model: V,
    obj: D,
    map: any,
    key: SymmetricCryptoKey
  ): Promise<void> {
    const promises = [];
    const self = this;

    for (const prop in map) {
      // eslint-disable-next-line
      if (!map.hasOwnProperty(prop)) {
        continue;
      }

      (function (theProp, theObj) {
        const p = Promise.resolve()
          .then(() => {
            const modelProp = (model as any)[map[theProp] || theProp];
            if (modelProp && modelProp !== "") {
              return self.cryptoService.encrypt(modelProp, key);
            }
            return null;
          })
          .then((val: EncString) => {
            (theObj as any)[theProp] = val;
          });
        promises.push(p);
      })(prop, obj);
    }

    await Promise.all(promises);
  }

  private async encryptCipherData(cipher: Cipher, model: CipherView, key: SymmetricCryptoKey) {
    switch (cipher.type) {
      case CipherType.Login:
        cipher.login = new Login();
        cipher.login.passwordRevisionDate = model.login.passwordRevisionDate;
        cipher.login.autofillOnPageLoad = model.login.autofillOnPageLoad;
        await this.encryptObjProperty(
          model.login,
          cipher.login,
          {
            username: null,
            password: null,
            totp: null,
          },
          key
        );

        if (model.login.uris != null) {
          cipher.login.uris = [];
          for (let i = 0; i < model.login.uris.length; i++) {
            const loginUri = new LoginUri();
            loginUri.match = model.login.uris[i].match;
            await this.encryptObjProperty(
              model.login.uris[i],
              loginUri,
              {
                uri: null,
              },
              key
            );
            cipher.login.uris.push(loginUri);
          }
        }
        return;
      case CipherType.SecureNote:
        cipher.secureNote = new SecureNote();
        cipher.secureNote.type = model.secureNote.type;
        return;
      case CipherType.Card:
        cipher.card = new Card();
        await this.encryptObjProperty(
          model.card,
          cipher.card,
          {
            cardholderName: null,
            brand: null,
            number: null,
            expMonth: null,
            expYear: null,
            code: null,
          },
          key
        );
        return;
      case CipherType.Identity:
        cipher.identity = new Identity();
        await this.encryptObjProperty(
          model.identity,
          cipher.identity,
          {
            title: null,
            firstName: null,
            middleName: null,
            lastName: null,
            address1: null,
            address2: null,
            address3: null,
            city: null,
            state: null,
            postalCode: null,
            country: null,
            company: null,
            email: null,
            phone: null,
            ssn: null,
            username: null,
            passportNumber: null,
            licenseNumber: null,
          },
          key
        );
        return;
      default:
        throw new Error("Unknown cipher type.");
    }
  }

  private async getCipherForUrl(
    url: string,
    lastUsed: boolean,
    lastLaunched: boolean,
    autofillOnPageLoad: boolean
  ): Promise<CipherView> {
    const cacheKey = autofillOnPageLoad ? "autofillOnPageLoad-" + url : url;

    if (!this.sortedCiphersCache.isCached(cacheKey)) {
      let ciphers = await this.getAllDecryptedForUrl(url);
      if (!ciphers) {
        return null;
      }

      if (autofillOnPageLoad) {
        const autofillOnPageLoadDefault = await this.stateService.getAutoFillOnPageLoadDefault();
        ciphers = ciphers.filter(
          (cipher) =>
            cipher.login.autofillOnPageLoad ||
            (cipher.login.autofillOnPageLoad == null && autofillOnPageLoadDefault !== false)
        );
        if (ciphers.length === 0) {
          return null;
        }
      }

      this.sortedCiphersCache.addCiphers(cacheKey, ciphers);
    }

    if (lastLaunched) {
      return this.sortedCiphersCache.getLastLaunched(cacheKey);
    } else if (lastUsed) {
      return this.sortedCiphersCache.getLastUsed(cacheKey);
    } else {
      return this.sortedCiphersCache.getNext(cacheKey);
    }
  }

  private async clearEncryptedCiphersState(userId?: string) {
    await this.stateService.setEncryptedCiphers(null, { userId: userId });
  }

  private async clearDecryptedCiphersState(userId?: string) {
    await this.stateService.setDecryptedCiphers(null, { userId: userId });
    this.clearSortedCiphers();
  }

  private clearSortedCiphers() {
    this.sortedCiphersCache.clear();
  }
}
