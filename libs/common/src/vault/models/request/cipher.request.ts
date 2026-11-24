// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { UserId } from "../../../types/guid";
import { EncryptionContext } from "../../abstractions/cipher.service";
import { CipherRepromptType } from "../../enums/cipher-reprompt-type";
import { CipherType } from "../../enums/cipher-type";
import { BankAccountApi } from "../api/bank-account.api";
import { CardApi } from "../api/card.api";
import { DriversLicenseApi } from "../api/drivers-license.api";
import { Fido2CredentialApi } from "../api/fido2-credential.api";
import { FieldApi } from "../api/field.api";
import { IdentityApi } from "../api/identity.api";
import { LoginUriApi } from "../api/login-uri.api";
import { LoginApi } from "../api/login.api";
import { PassportApi } from "../api/passport.api";
import { SecureNoteApi } from "../api/secure-note.api";
import { SshKeyApi } from "../api/ssh-key.api";

import { AttachmentRequest } from "./attachment.request";
import { PasswordHistoryRequest } from "./password-history.request";

export class CipherRequest {
  encryptedFor: UserId;
  encryptedByKeyId?: string;
  type: CipherType;
  folderId: string;
  organizationId: string;
  name: string;
  notes: string;
  favorite: boolean;
  login: LoginApi;
  secureNote: SecureNoteApi;
  card: CardApi;
  identity: IdentityApi;
  sshKey: SshKeyApi;
  bankAccount: BankAccountApi;
  driversLicense: DriversLicenseApi;
  passport: PassportApi;
  fields: FieldApi[];
  passwordHistory: PasswordHistoryRequest[];
  // Deprecated, remove at some point and rename attachments2 to attachments
  attachments: { [id: string]: string };
  attachments2: { [id: string]: AttachmentRequest };
  lastKnownRevisionDate: Date;
  archivedDate: Date | null;
  reprompt: CipherRepromptType;
  key: string;
  data?: string;

  constructor({ cipher, encryptedFor, encryptedByKeyId }: EncryptionContext) {
    this.type = cipher.type;
    this.encryptedFor = encryptedFor;
    this.encryptedByKeyId = encryptedByKeyId;
    this.folderId = cipher.folderId;
    this.organizationId = cipher.organizationId;
    this.name = cipher.name ?? null;
    this.notes = cipher.notes ?? null;
    this.favorite = cipher.favorite;
    this.lastKnownRevisionDate = cipher.revisionDate;
    this.archivedDate = cipher.archivedDate;
    this.reprompt = cipher.reprompt;
    this.key = cipher.key;
    this.data = cipher.data;

    switch (this.type) {
      case CipherType.Login:
        if (cipher.login == null) {
          break;
        }
        this.login = new LoginApi();
        this.login.uris =
          cipher.login.uris?.map((u) => {
            const uri = new LoginUriApi();
            uri.uri = u.uri ?? null;
            uri.match = u.match != null ? u.match : null;
            uri.uriChecksum = u.uriChecksum ?? null;
            return uri;
          }) ?? [];
        this.login.username = cipher.login.username ?? null;
        this.login.password = cipher.login.password ?? null;
        this.login.passwordRevisionDate =
          cipher.login.passwordRevisionDate != null
            ? cipher.login.passwordRevisionDate.toISOString()
            : null;
        this.login.totp = cipher.login.totp ?? null;
        this.login.autofillOnPageLoad = cipher.login.autofillOnPageLoad;
        this.login.httpAuthenticationEnabled = cipher.login.httpAuthenticationEnabled;

        if (cipher.login.fido2Credentials != null) {
          this.login.fido2Credentials = cipher.login.fido2Credentials.map((key) => {
            const keyApi = new Fido2CredentialApi();
            keyApi.credentialId = key.credentialId ?? null;
            keyApi.keyType = key.keyType != null ? (key.keyType as "public-key") : null;
            keyApi.keyAlgorithm = key.keyAlgorithm != null ? (key.keyAlgorithm as "ECDSA") : null;
            keyApi.keyCurve = key.keyCurve != null ? (key.keyCurve as "P-256") : null;
            keyApi.keyValue = key.keyValue ?? null;
            keyApi.rpId = key.rpId ?? null;
            keyApi.rpName = key.rpName ?? null;
            keyApi.counter = key.counter ?? null;
            keyApi.userHandle = key.userHandle ?? null;
            keyApi.userName = key.userName ?? null;
            keyApi.userDisplayName = key.userDisplayName ?? null;
            keyApi.discoverable = key.discoverable ?? null;
            keyApi.creationDate = key.creationDate != null ? key.creationDate.toISOString() : null;
            return keyApi;
          });
        }
        break;
      case CipherType.SecureNote:
        if (cipher.secureNote == null) {
          break;
        }
        this.secureNote = new SecureNoteApi();
        this.secureNote.type = cipher.secureNote.type;
        break;
      case CipherType.SshKey:
        if (cipher.sshKey == null) {
          break;
        }
        this.sshKey = new SshKeyApi();
        this.sshKey.privateKey = cipher.sshKey.privateKey ?? null;
        this.sshKey.publicKey = cipher.sshKey.publicKey ?? null;
        this.sshKey.keyFingerprint = cipher.sshKey.keyFingerprint ?? null;
        break;
      case CipherType.Card:
        if (cipher.card == null) {
          break;
        }
        this.card = new CardApi();
        this.card.cardholderName = cipher.card.cardholderName ?? null;
        this.card.brand = cipher.card.brand ?? null;
        this.card.number = cipher.card.number ?? null;
        this.card.expMonth = cipher.card.expMonth ?? null;
        this.card.expYear = cipher.card.expYear ?? null;
        this.card.code = cipher.card.code ?? null;
        break;
      case CipherType.Identity:
        if (cipher.identity == null) {
          break;
        }
        this.identity = new IdentityApi();
        this.identity.title = cipher.identity.title ?? null;
        this.identity.firstName = cipher.identity.firstName ?? null;
        this.identity.middleName = cipher.identity.middleName ?? null;
        this.identity.lastName = cipher.identity.lastName ?? null;
        this.identity.address1 = cipher.identity.address1 ?? null;
        this.identity.address2 = cipher.identity.address2 ?? null;
        this.identity.address3 = cipher.identity.address3 ?? null;
        this.identity.city = cipher.identity.city ?? null;
        this.identity.state = cipher.identity.state ?? null;
        this.identity.postalCode = cipher.identity.postalCode ?? null;
        this.identity.country = cipher.identity.country ?? null;
        this.identity.company = cipher.identity.company ?? null;
        this.identity.email = cipher.identity.email ?? null;
        this.identity.phone = cipher.identity.phone ?? null;
        this.identity.ssn = cipher.identity.ssn ?? null;
        this.identity.username = cipher.identity.username ?? null;
        this.identity.passportNumber = cipher.identity.passportNumber ?? null;
        this.identity.licenseNumber = cipher.identity.licenseNumber ?? null;
        break;
      case CipherType.BankAccount:
        if (cipher.bankAccount == null) {
          break;
        }
        this.bankAccount = new BankAccountApi();
        this.bankAccount.bankName = cipher.bankAccount.bankName ?? null;
        this.bankAccount.nameOnAccount = cipher.bankAccount.nameOnAccount ?? null;
        this.bankAccount.accountType = cipher.bankAccount.accountType ?? null;
        this.bankAccount.accountNumber = cipher.bankAccount.accountNumber ?? null;
        this.bankAccount.routingNumber = cipher.bankAccount.routingNumber ?? null;
        this.bankAccount.branchNumber = cipher.bankAccount.branchNumber ?? null;
        this.bankAccount.pin = cipher.bankAccount.pin ?? null;
        this.bankAccount.swiftCode = cipher.bankAccount.swiftCode ?? null;
        this.bankAccount.iban = cipher.bankAccount.iban ?? null;
        this.bankAccount.bankContactPhone = cipher.bankAccount.bankContactPhone ?? null;
        break;
      case CipherType.DriversLicense:
        if (cipher.driversLicense == null) {
          break;
        }
        this.driversLicense = new DriversLicenseApi();
        this.driversLicense.firstName = cipher.driversLicense.firstName ?? null;
        this.driversLicense.middleName = cipher.driversLicense.middleName ?? null;
        this.driversLicense.lastName = cipher.driversLicense.lastName ?? null;
        this.driversLicense.dateOfBirth = cipher.driversLicense.dateOfBirth ?? null;
        this.driversLicense.licenseNumber = cipher.driversLicense.licenseNumber ?? null;
        this.driversLicense.issuingCountry = cipher.driversLicense.issuingCountry ?? null;
        this.driversLicense.issuingState = cipher.driversLicense.issuingState ?? null;
        this.driversLicense.issueDate = cipher.driversLicense.issueDate ?? null;
        this.driversLicense.expirationDate = cipher.driversLicense.expirationDate ?? null;
        this.driversLicense.issuingAuthority = cipher.driversLicense.issuingAuthority ?? null;
        this.driversLicense.licenseClass = cipher.driversLicense.licenseClass ?? null;
        break;
      case CipherType.Passport:
        if (cipher.passport == null) {
          break;
        }
        this.passport = new PassportApi();
        this.passport.surname = cipher.passport.surname ?? null;
        this.passport.givenName = cipher.passport.givenName ?? null;
        this.passport.dateOfBirth = cipher.passport.dateOfBirth ?? null;
        this.passport.sex = cipher.passport.sex ?? null;
        this.passport.birthPlace = cipher.passport.birthPlace ?? null;
        this.passport.nationality = cipher.passport.nationality ?? null;
        this.passport.issuingCountry = cipher.passport.issuingCountry ?? null;
        this.passport.passportNumber = cipher.passport.passportNumber ?? null;
        this.passport.passportType = cipher.passport.passportType ?? null;
        this.passport.nationalIdentificationNumber =
          cipher.passport.nationalIdentificationNumber ?? null;
        this.passport.issuingAuthority = cipher.passport.issuingAuthority ?? null;
        this.passport.issueDate = cipher.passport.issueDate ?? null;
        this.passport.expirationDate = cipher.passport.expirationDate ?? null;
        break;
      default:
        break;
    }

    if (cipher.fields != null) {
      this.fields = cipher.fields.map((f) => {
        const field = new FieldApi();
        field.type = f.type;
        field.name = f.name ?? null;
        field.value = f.value ?? null;
        field.linkedId = f.linkedId;
        return field;
      });
    }

    if (cipher.passwordHistory != null) {
      this.passwordHistory = [];
      cipher.passwordHistory.forEach((ph) => {
        this.passwordHistory.push({
          lastUsedDate: ph.lastUsedDate,
          password: ph.password ?? null,
        });
      });
    }

    if (cipher.attachments != null) {
      this.attachments = {};
      this.attachments2 = {};
      cipher.attachments.forEach((attachment) => {
        const fileName = attachment.fileName ?? null;
        this.attachments[attachment.id] = fileName;
        const attachmentRequest = new AttachmentRequest();
        attachmentRequest.fileName = fileName;
        attachmentRequest.lastKnownRevisionDate = cipher.revisionDate;
        if (attachment.key != null) {
          attachmentRequest.key = attachment.key;
        }
        this.attachments2[attachment.id] = attachmentRequest;
      });
    }
  }
}
