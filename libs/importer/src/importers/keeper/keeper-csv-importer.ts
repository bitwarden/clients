import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { CipherType } from "@bitwarden/common/vault/enums";
import { BankAccountView } from "@bitwarden/common/vault/models/view/bank-account.view";
import { DriversLicenseView } from "@bitwarden/common/vault/models/view/drivers-license.view";
import { PassportView } from "@bitwarden/common/vault/models/view/passport.view";

import { ImportResult } from "../../models/import-result";
import { Importer } from "../importer";

import { KeeperImporter } from "./keeper-importer";

export class KeeperCsvImporter extends KeeperImporter implements Importer {
  async parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, false);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    const useNewDedicatedTypes = await this.configService.getFeatureFlag(
      FeatureFlag.PM32009NewItemTypes,
    );

    results.forEach((value: string[]) => {
      if (value.length < 6) {
        return;
      }

      this.processFolder(result, value[0]);
      const cipher = this.initLoginCipher();

      cipher.name = this.getValueOrDefault(value[1], "--");
      cipher.login.username = this.getValueOrDefault(value[2]);
      cipher.login.password = this.getValueOrDefault(value[3]);
      cipher.login.uris = this.makeUriArray(value[4]);
      const notes = this.getValueOrDefault(value[5], "").trimEnd();
      if (notes.length) {
        cipher.notes = notes;
      }

      // We currently ignore index 6, which is for shared folders

      const customFields = value.slice(7);
      // If the above array has any values we have some custom fields, which are listed in the row as [key1, value1, key2, value2, ...]
      const fieldNames = value.slice(7).filter((_val, idx) => idx % 2 === 0);
      const bankAccountView = new BankAccountView();
      const isBankAccount = fieldNames.includes("Bank Account");
      const passportView = new PassportView();
      const isPassport = fieldNames.includes("Passport Number");
      const driversLicenseView = new DriversLicenseView();
      const isDriversLicense = fieldNames.includes("Driver's License Number");

      for (let i = 0; i < customFields.length; i = i + 2) {
        const fieldName = customFields[i];
        const fieldValue = customFields[i + 1];

        if (!useNewDedicatedTypes) {
          if (fieldName === "TFC:Keeper") {
            cipher.login.totp = fieldValue;
          } else {
            this.processKvp(cipher, fieldName, fieldValue);
          }
        } else {
          switch (fieldName) {
            case "TFC:Keeper":
              cipher.login.totp = fieldValue;
              break;
            // TODO: Currently this relies on English field names.
            // We should add support for other languages later
            case "Bank Account": {
              const [type, accountNbr, routingNbr] = fieldValue.split(" | ");
              bankAccountView.accountType = type;
              bankAccountView.accountNumber = accountNbr;
              bankAccountView.routingNumber = routingNbr;
              break;
            }
            case "Name": {
              if (isBankAccount) {
                bankAccountView.nameOnAccount = fieldValue;
              } else if (isPassport) {
                const [first, middle, last] = this.getFullName(fieldValue);
                passportView.givenName = first;
                if (middle) {
                  passportView.givenName = passportView.givenName + " " + middle;
                }
                passportView.surname = last;
              } else if (isDriversLicense) {
                const [first, middle, last] = this.getFullName(fieldValue);
                driversLicenseView.firstName = first;
                driversLicenseView.middleName = middle;
                driversLicenseView.lastName = last;
              } else {
                this.processKvp(cipher, fieldName, fieldValue);
              }
              break;
            }
            case "Passport Number":
              passportView.passportNumber = fieldValue;
              break;
            case "Driver's License Number":
              driversLicenseView.licenseNumber = fieldValue;
              break;
            case "Date of Birth":
              if (isPassport) {
                passportView.dateOfBirth = fieldValue;
              } else if (isDriversLicense) {
                driversLicenseView.dateOfBirth = fieldValue;
              } else {
                this.processKvp(cipher, fieldName, fieldValue);
              }
              break;
            case "Date":
              if (isPassport) {
                passportView.expirationDate = fieldValue;
              } else if (isDriversLicense) {
                driversLicenseView.expirationDate = fieldValue;
              } else {
                this.processKvp(cipher, fieldName, fieldValue);
              }
              break;
            case "Date Issued":
              if (isPassport) {
                passportView.issueDate = fieldValue;
              } else {
                this.processKvp(cipher, fieldName, fieldValue);
              }
              break;
            default:
              this.processKvp(cipher, fieldName, fieldValue);
          }
        }
      }

      if (useNewDedicatedTypes && isPassport) {
        cipher.type = CipherType.Passport;
        cipher.passport = passportView;
        this.copyLoginPropertiesAsCustomFields(cipher);
      } else if (useNewDedicatedTypes && isDriversLicense) {
        cipher.type = CipherType.DriversLicense;
        cipher.driversLicense = driversLicenseView;
        this.copyLoginPropertiesAsCustomFields(cipher);
      }

      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);

      if (useNewDedicatedTypes && isBankAccount) {
        const bankAccountCipher = this.initLoginCipher();
        bankAccountCipher.name = cipher.name;
        bankAccountCipher.type = CipherType.BankAccount;
        bankAccountCipher.bankAccount = bankAccountView;
        this.cleanupCipher(bankAccountCipher);
        // Make sure the bank account is in the same folder as the login cipher. This
        // must happen before the cipher is pushed to the results to get the right index
        this.processFolder(result, value[0]);
        result.ciphers.push(bankAccountCipher);
      }
    });

    if (this.organization) {
      this.moveFoldersToCollections(result);
    }

    result.success = true;
    return Promise.resolve(result);
  }
}
