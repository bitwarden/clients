// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FieldType, SecureNoteType, CipherType } from "@bitwarden/common/vault/enums";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

import { processNames } from "./protonpass-import-utils";
import {
  ProtonPassCreditCardItemContent,
  ProtonPassIdentityItemContent,
  ProtonPassIdentityItemExtraSection,
  ProtonPassItemExtraField,
  ProtonPassItemState,
  ProtonPassJsonFile,
  ProtonPassLoginItemContent,
} from "./types/protonpass-json-type";

export class ProtonPassJsonImporter extends BaseImporter implements Importer {
  private mappedIdentityItemKeys = [
    "fullName",
    "firstName",
    "middleName",
    "lastName",
    "email",
    "phoneNumber",
    "company",
    "socialSecurityNumber",
    "passportNumber",
    "licenseNumber",
    "organization",
    "streetAddress",
    "floor",
    "county",
    "city",
    "stateOrProvince",
    "zipOrPostalCode",
    "countryOrRegion",
  ];

  private identityItemExtraFieldsKeys = [
    "extraPersonalDetails",
    "extraAddressDetails",
    "extraContactDetails",
    "extraWorkDetails",
    "extraSections",
  ];

  constructor(private i18nService: I18nService) {
    super();
  }

  private processIdentityItemUnmappedAndExtraFields(
    cipher: CipherView,
    identityItem: ProtonPassIdentityItemContent,
  ) {
    Object.keys(identityItem).forEach((key) => {
      if (
        !this.mappedIdentityItemKeys.includes(key) &&
        !this.identityItemExtraFieldsKeys.includes(key)
      ) {
        this.processKvp(
          cipher,
          key,
          identityItem[key as keyof ProtonPassIdentityItemContent] as string,
        );
        return;
      }

      if (this.identityItemExtraFieldsKeys.includes(key)) {
        if (key !== "extraSections") {
          const extraFields = identityItem[
            key as keyof ProtonPassIdentityItemContent
          ] as ProtonPassItemExtraField[];

          extraFields?.forEach((extraField) => {
            this.processKvp(
              cipher,
              extraField.fieldName,
              extraField.data.content,
              extraField.type === "hidden" ? FieldType.Hidden : FieldType.Text,
            );
          });
        } else {
          const extraSections = identityItem[
            key as keyof ProtonPassIdentityItemContent
          ] as ProtonPassIdentityItemExtraSection[];

          extraSections?.forEach((extraSection) => {
            extraSection.sectionFields?.forEach((extraField) => {
              this.processKvp(
                cipher,
                extraField.fieldName,
                extraField.data.content,
                extraField.type === "hidden" ? FieldType.Hidden : FieldType.Text,
              );
            });
          });
        }
      }
    });
  }

  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results: ProtonPassJsonFile = JSON.parse(data);
    if (results == null || results.vaults == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    if (results.encrypted) {
      result.success = false;
      result.errorMessage = this.i18nService.t("unsupportedEncryptedImport");
      return Promise.resolve(result);
    }

    for (const [, vault] of Object.entries(results.vaults)) {
      for (const item of vault.items) {
        if (item.state == ProtonPassItemState.TRASHED) {
          continue;
        }

        const cipher = this.initLoginCipher();
        cipher.name = this.getValueOrDefault(item.data.metadata.name, "--");
        cipher.notes = this.getValueOrDefault(item.data.metadata.note);
        cipher.favorite = item.pinned;

        switch (item.data.type) {
          case "login": {
            const loginContent = item.data.content as ProtonPassLoginItemContent;
            cipher.login.uris = this.makeUriArray(loginContent.urls);

            cipher.login.username = this.getValueOrDefault(loginContent.itemUsername);
            // if the cipher has no username then the email is used as the username
            if (cipher.login.username == null) {
              cipher.login.username = this.getValueOrDefault(loginContent.itemEmail);
            } else {
              this.processKvp(cipher, "email", loginContent.itemEmail);
            }

            cipher.login.password = this.getValueOrDefault(loginContent.password);
            cipher.login.totp = this.getValueOrDefault(loginContent.totpUri);
            for (const extraField of item.data.extraFields) {
              this.processKvp(
                cipher,
                extraField.fieldName,
                extraField.type == "totp" ? extraField.data.totpUri : extraField.data.content,
                extraField.type == "text" ? FieldType.Text : FieldType.Hidden,
              );
            }
            break;
          }
          case "note":
            cipher.type = CipherType.SecureNote;
            cipher.secureNote = new SecureNoteView();
            cipher.secureNote.type = SecureNoteType.Generic;
            break;
          case "creditCard": {
            const creditCardContent = item.data.content as ProtonPassCreditCardItemContent;
            cipher.type = CipherType.Card;
            cipher.card = new CardView();
            cipher.card.cardholderName = this.getValueOrDefault(creditCardContent.cardholderName);
            cipher.card.number = this.getValueOrDefault(creditCardContent.number);
            cipher.card.brand = CardView.getCardBrandByPatterns(creditCardContent.number);
            cipher.card.code = this.getValueOrDefault(creditCardContent.verificationNumber);

            if (!this.isNullOrWhitespace(creditCardContent.expirationDate)) {
              cipher.card.expMonth = creditCardContent.expirationDate.substring(5, 7);
              cipher.card.expMonth = cipher.card.expMonth.replace(/^0+/, "");
              cipher.card.expYear = creditCardContent.expirationDate.substring(0, 4);
            }

            if (!this.isNullOrWhitespace(creditCardContent.pin)) {
              this.processKvp(cipher, "PIN", creditCardContent.pin, FieldType.Hidden);
            }

            break;
          }
          case "identity": {
            const identityContent = item.data.content as ProtonPassIdentityItemContent;
            cipher.type = CipherType.Identity;
            cipher.identity = new IdentityView();

            const { mappedFirstName, mappedMiddleName, mappedLastName } = processNames(
              this.getValueOrDefault(identityContent.fullName),
              this.getValueOrDefault(identityContent.firstName),
              this.getValueOrDefault(identityContent.middleName),
              this.getValueOrDefault(identityContent.lastName),
            );
            cipher.identity.firstName = mappedFirstName;
            cipher.identity.middleName = mappedMiddleName;
            cipher.identity.lastName = mappedLastName;

            cipher.identity.email = this.getValueOrDefault(identityContent.email);
            cipher.identity.phone = this.getValueOrDefault(identityContent.phoneNumber);
            cipher.identity.company = this.getValueOrDefault(identityContent.company);
            cipher.identity.ssn = this.getValueOrDefault(identityContent.socialSecurityNumber);
            cipher.identity.passportNumber = this.getValueOrDefault(identityContent.passportNumber);
            cipher.identity.licenseNumber = this.getValueOrDefault(identityContent.licenseNumber);

            const address3 =
              `${identityContent.floor ?? ""} ${identityContent.county ?? ""}`.trim();
            cipher.identity.address1 = this.getValueOrDefault(identityContent.organization);
            cipher.identity.address2 = this.getValueOrDefault(identityContent.streetAddress);
            cipher.identity.address3 = this.getValueOrDefault(address3);

            cipher.identity.city = this.getValueOrDefault(identityContent.city);
            cipher.identity.state = this.getValueOrDefault(identityContent.stateOrProvince);
            cipher.identity.postalCode = this.getValueOrDefault(identityContent.zipOrPostalCode);
            cipher.identity.country = this.getValueOrDefault(identityContent.countryOrRegion);
            this.processIdentityItemUnmappedAndExtraFields(cipher, identityContent);

            for (const extraField of item.data.extraFields) {
              this.processKvp(
                cipher,
                extraField.fieldName,
                extraField.data.content,
                extraField.type === "hidden" ? FieldType.Hidden : FieldType.Text,
              );
            }
            break;
          }
          default:
            continue;
        }

        this.processFolder(result, vault.name);
        this.cleanupCipher(cipher);
        result.ciphers.push(cipher);
      }
    }
    if (this.organization) {
      this.moveFoldersToCollections(result);
    }
    result.success = true;
    return Promise.resolve(result);
  }
}
