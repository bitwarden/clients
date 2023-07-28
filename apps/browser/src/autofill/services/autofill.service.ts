import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { SettingsService } from "@bitwarden/common/abstractions/settings.service";
import { TotpService } from "@bitwarden/common/abstractions/totp.service";
import { EventType, FieldType, UriMatchType } from "@bitwarden/common/enums";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";

import { BrowserApi } from "../../platform/browser/browser-api";
import { BrowserStateService } from "../../platform/services/abstractions/browser-state.service";
import AutofillField from "../models/autofill-field";
import AutofillPageDetails from "../models/autofill-page-details";
import AutofillScript from "../models/autofill-script";

import {
  AutoFillOptions,
  AutofillService as AutofillServiceInterface,
  PageDetail,
  FormData,
} from "./abstractions/autofill.service";
import {
  AutoFillConstants,
  CreditCardAutoFillConstants,
  IdentityAutoFillConstants,
} from "./autofill-constants";

export interface GenerateFillScriptOptions {
  skipUsernameOnlyFill: boolean;
  onlyEmptyFields: boolean;
  onlyVisibleFields: boolean;
  fillNewPassword: boolean;
  allowTotpAutofill: boolean;
  cipher: CipherView;
  tabUrl: string;
  defaultUriMatch: UriMatchType;
}

export default class AutofillService implements AutofillServiceInterface {
  constructor(
    private cipherService: CipherService,
    private stateService: BrowserStateService,
    private totpService: TotpService,
    private eventCollectionService: EventCollectionService,
    private logService: LogService,
    private settingsService: SettingsService
  ) {}

  getFormsWithPasswordFields(pageDetails: AutofillPageDetails): FormData[] {
    const formData: FormData[] = [];

    const passwordFields = AutofillService.loadPasswordFields(pageDetails, true, true, false, true);

    // TODO: this logic prevents multi-step account creation forms (that just start with email)
    // from being passed on to the notification bar content script - even if autofill.js found the form and email field.
    // ex: https://signup.live.com/
    if (passwordFields.length === 0) {
      return formData;
    }

    // Back up check for cases where there are several password fields detected,
    // but they are not all part of the form b/c of bad HTML

    // gather password fields that don't have an enclosing form
    const passwordFieldsWithoutForm = passwordFields.filter((pf) => pf.form === undefined);
    const formKeys = Object.keys(pageDetails.forms);
    const formCount = formKeys.length;

    // if we have 3 password fields and only 1 form, and there are password fields that are not within a form
    // but there is at least one password field within the form, then most likely this is a poorly built password change form
    if (passwordFields.length === 3 && formCount == 1 && passwordFieldsWithoutForm.length > 0) {
      // Only one form so get the singular form key
      const soloFormKey = formKeys[0];

      const atLeastOnePasswordFieldWithinSoloForm =
        passwordFields.filter((pf) => pf.form !== null && pf.form === soloFormKey).length > 0;

      if (atLeastOnePasswordFieldWithinSoloForm) {
        // We have a form with at least one password field,
        // so let's make an assumption that the password fields without a form are actually part of this form
        passwordFieldsWithoutForm.forEach((pf) => {
          pf.form = soloFormKey;
        });
      }
    }

    for (const formKey in pageDetails.forms) {
      // eslint-disable-next-line
      if (!pageDetails.forms.hasOwnProperty(formKey)) {
        continue;
      }

      const formPasswordFields = passwordFields.filter((pf) => formKey === pf.form);
      if (formPasswordFields.length > 0) {
        let uf = this.findUsernameField(pageDetails, formPasswordFields[0], false, false, false);
        if (uf == null) {
          // not able to find any viewable username fields. maybe there are some "hidden" ones?
          uf = this.findUsernameField(pageDetails, formPasswordFields[0], true, true, false);
        }
        formData.push({
          form: pageDetails.forms[formKey],
          password: formPasswordFields[0],
          username: uf,
          passwords: formPasswordFields,
        });
      }
    }

    return formData;
  }

  /**
   * Autofills a given tab with a given login item
   * @param options Instructions about the autofill operation, including tab and login item
   * @returns The TOTP code of the successfully autofilled login, if any
   */
  async doAutoFill(options: AutoFillOptions): Promise<string> {
    const tab = options.tab;
    if (!tab || !options.cipher || !options.pageDetails || !options.pageDetails.length) {
      throw new Error("Nothing to auto-fill.");
    }

    let totpPromise: Promise<string> = null;

    const canAccessPremium = await this.stateService.getCanAccessPremium();
    const defaultUriMatch = (await this.stateService.getDefaultUriMatch()) ?? UriMatchType.Domain;

    let didAutofill = false;
    await Promise.all(
      options.pageDetails.map(async (pd) => {
        // make sure we're still on correct tab
        if (pd.tab.id !== tab.id || pd.tab.url !== tab.url) {
          return;
        }

        const fillScript = await this.generateFillScript(pd.details, {
          skipUsernameOnlyFill: options.skipUsernameOnlyFill || false,
          onlyEmptyFields: options.onlyEmptyFields || false,
          onlyVisibleFields: options.onlyVisibleFields || false,
          fillNewPassword: options.fillNewPassword || false,
          allowTotpAutofill: options.allowTotpAutofill || false,
          cipher: options.cipher,
          tabUrl: tab.url,
          defaultUriMatch: defaultUriMatch,
        });

        if (!fillScript || !fillScript.script || !fillScript.script.length) {
          return;
        }

        if (
          fillScript.untrustedIframe &&
          options.allowUntrustedIframe != undefined &&
          !options.allowUntrustedIframe
        ) {
          this.logService.info("Auto-fill on page load was blocked due to an untrusted iframe.");
          return;
        }

        // Add a small delay between operations
        fillScript.properties.delay_between_operations = 20;

        didAutofill = true;
        if (!options.skipLastUsed) {
          this.cipherService.updateLastUsedDate(options.cipher.id);
        }

        BrowserApi.tabSendMessage(
          tab,
          {
            command: "fillForm",
            fillScript: fillScript,
            url: tab.url,
          },
          { frameId: pd.frameId }
        );

        if (
          options.cipher.type !== CipherType.Login ||
          totpPromise ||
          !options.cipher.login.totp ||
          (!canAccessPremium && !options.cipher.organizationUseTotp)
        ) {
          return;
        }

        totpPromise = this.stateService.getDisableAutoTotpCopy().then((disabled) => {
          if (!disabled) {
            return this.totpService.getCode(options.cipher.login.totp);
          }
          return null;
        });
      })
    );

    if (didAutofill) {
      this.eventCollectionService.collect(EventType.Cipher_ClientAutofilled, options.cipher.id);
      if (totpPromise != null) {
        return await totpPromise;
      } else {
        return null;
      }
    } else {
      throw new Error("Did not auto-fill.");
    }
  }

  /**
   * Autofills the specified tab with the next login item from the cache
   * @param pageDetails The data scraped from the page
   * @param tab The tab to be autofilled
   * @param fromCommand Whether the autofill is triggered by a keyboard shortcut (`true`) or autofill on page load (`false`)
   * @returns The TOTP code of the successfully autofilled login, if any
   */
  async doAutoFillOnTab(
    pageDetails: PageDetail[],
    tab: chrome.tabs.Tab,
    fromCommand: boolean
  ): Promise<string> {
    let cipher: CipherView;
    if (fromCommand) {
      cipher = await this.cipherService.getNextCipherForUrl(tab.url);
    } else {
      const lastLaunchedCipher = await this.cipherService.getLastLaunchedForUrl(tab.url, true);
      if (
        lastLaunchedCipher &&
        Date.now().valueOf() - lastLaunchedCipher.localData?.lastLaunched?.valueOf() < 30000
      ) {
        cipher = lastLaunchedCipher;
      } else {
        cipher = await this.cipherService.getLastUsedForUrl(tab.url, true);
      }
    }

    if (cipher == null || cipher.reprompt !== CipherRepromptType.None) {
      return null;
    }

    const totpCode = await this.doAutoFill({
      tab: tab,
      cipher: cipher,
      pageDetails: pageDetails,
      skipLastUsed: !fromCommand,
      skipUsernameOnlyFill: !fromCommand,
      onlyEmptyFields: !fromCommand,
      onlyVisibleFields: !fromCommand,
      fillNewPassword: fromCommand,
      allowUntrustedIframe: fromCommand,
      allowTotpAutofill: fromCommand,
    });

    // Update last used index as autofill has succeed
    if (fromCommand) {
      this.cipherService.updateLastUsedIndexForUrl(tab.url);
    }

    return totpCode;
  }

  /**
   * Autofills the active tab with the next login item from the cache
   * @param pageDetails The data scraped from the page
   * @param fromCommand Whether the autofill is triggered by a keyboard shortcut (`true`) or autofill on page load (`false`)
   * @returns The TOTP code of the successfully autofilled login, if any
   */
  async doAutoFillActiveTab(pageDetails: PageDetail[], fromCommand: boolean): Promise<string> {
    const tab = await this.getActiveTab();
    if (!tab || !tab.url) {
      return;
    }

    return await this.doAutoFillOnTab(pageDetails, tab, fromCommand);
  }

  // Helpers

  private async getActiveTab(): Promise<chrome.tabs.Tab> {
    const tab = await BrowserApi.getTabFromCurrentWindow();
    if (!tab) {
      throw new Error("No tab found.");
    }

    return tab;
  }

  private async generateFillScript(
    pageDetails: AutofillPageDetails,
    options: GenerateFillScriptOptions
  ): Promise<AutofillScript> {
    if (!pageDetails || !options.cipher) {
      return null;
    }

    let fillScript = new AutofillScript(pageDetails.documentUUID);
    const filledFields: { [id: string]: AutofillField } = {};
    const fields = options.cipher.fields;

    if (fields && fields.length) {
      const fieldNames: string[] = [];

      fields.forEach((f) => {
        if (AutofillService.hasValue(f.name)) {
          fieldNames.push(f.name.toLowerCase());
        }
      });

      pageDetails.fields.forEach((field) => {
        // eslint-disable-next-line
        if (filledFields.hasOwnProperty(field.opid)) {
          return;
        }

        if (!field.viewable && field.tagName !== "span") {
          return;
        }

        const matchingIndex = this.findMatchingFieldIndex(field, fieldNames);
        if (matchingIndex > -1) {
          const matchingField: FieldView = fields[matchingIndex];
          let val: string;
          if (matchingField.type === FieldType.Linked) {
            // Assumption: Linked Field is not being used to autofill a boolean value
            val = options.cipher.linkedFieldValue(matchingField.linkedId) as string;
          } else {
            val = matchingField.value;
            if (val == null && matchingField.type === FieldType.Boolean) {
              val = "false";
            }
          }

          filledFields[field.opid] = field;
          AutofillService.fillByOpid(fillScript, field, val);
        }
      });
    }

    switch (options.cipher.type) {
      case CipherType.Login:
        fillScript = await this.generateLoginFillScript(
          fillScript,
          pageDetails,
          filledFields,
          options
        );
        break;
      case CipherType.Card:
        fillScript = this.generateCardFillScript(fillScript, pageDetails, filledFields, options);
        break;
      case CipherType.Identity:
        fillScript = this.generateIdentityFillScript(
          fillScript,
          pageDetails,
          filledFields,
          options
        );
        break;
      default:
        return null;
    }

    return fillScript;
  }

  private async generateLoginFillScript(
    fillScript: AutofillScript,
    pageDetails: AutofillPageDetails,
    filledFields: { [id: string]: AutofillField },
    options: GenerateFillScriptOptions
  ): Promise<AutofillScript> {
    if (!options.cipher.login) {
      return null;
    }

    const passwords: AutofillField[] = [];
    const usernames: AutofillField[] = [];
    const totps: AutofillField[] = [];
    let pf: AutofillField = null;
    let username: AutofillField = null;
    let totp: AutofillField = null;
    const login = options.cipher.login;
    fillScript.savedUrls =
      login?.uris?.filter((u) => u.match != UriMatchType.Never).map((u) => u.uri) ?? [];

    fillScript.untrustedIframe = this.inUntrustedIframe(pageDetails.url, options);

    let passwordFields = AutofillService.loadPasswordFields(
      pageDetails,
      false,
      false,
      options.onlyEmptyFields,
      options.fillNewPassword
    );
    if (!passwordFields.length && !options.onlyVisibleFields) {
      // not able to find any viewable password fields. maybe there are some "hidden" ones?
      passwordFields = AutofillService.loadPasswordFields(
        pageDetails,
        true,
        true,
        options.onlyEmptyFields,
        options.fillNewPassword
      );
    }

    for (const formKey in pageDetails.forms) {
      // eslint-disable-next-line
      if (!pageDetails.forms.hasOwnProperty(formKey)) {
        continue;
      }

      passwordFields.forEach((passField) => {
        pf = passField;
        passwords.push(pf);

        if (login.username) {
          username = this.findUsernameField(pageDetails, pf, false, false, false);

          if (!username && !options.onlyVisibleFields) {
            // not able to find any viewable username fields. maybe there are some "hidden" ones?
            username = this.findUsernameField(pageDetails, pf, true, true, false);
          }

          if (username) {
            usernames.push(username);
          }
        }

        if (options.allowTotpAutofill && login.totp) {
          totp = this.findTotpField(pageDetails, pf, false, false, false);

          if (!totp && !options.onlyVisibleFields) {
            // not able to find any viewable totp fields. maybe there are some "hidden" ones?
            totp = this.findTotpField(pageDetails, pf, true, true, false);
          }

          if (totp) {
            totps.push(totp);
          }
        }
      });
    }

    if (passwordFields.length && !passwords.length) {
      // The page does not have any forms with password fields. Use the first password field on the page and the
      // input field just before it as the username.

      pf = passwordFields[0];
      passwords.push(pf);

      if (login.username && pf.elementNumber > 0) {
        username = this.findUsernameField(pageDetails, pf, false, false, true);

        if (!username && !options.onlyVisibleFields) {
          // not able to find any viewable username fields. maybe there are some "hidden" ones?
          username = this.findUsernameField(pageDetails, pf, true, true, true);
        }

        if (username) {
          usernames.push(username);
        }
      }

      if (options.allowTotpAutofill && login.totp && pf.elementNumber > 0) {
        totp = this.findTotpField(pageDetails, pf, false, false, true);

        if (!totp && !options.onlyVisibleFields) {
          // not able to find any viewable username fields. maybe there are some "hidden" ones?
          totp = this.findTotpField(pageDetails, pf, true, true, true);
        }

        if (totp) {
          totps.push(totp);
        }
      }
    }

    if (!passwordFields.length) {
      // No password fields on this page. Let's try to just fuzzy fill the username.
      pageDetails.fields.forEach((f) => {
        if (
          !options.skipUsernameOnlyFill &&
          f.viewable &&
          (f.type === "text" || f.type === "email" || f.type === "tel") &&
          AutofillService.fieldIsFuzzyMatch(f, AutoFillConstants.UsernameFieldNames)
        ) {
          usernames.push(f);
        }

        if (
          options.allowTotpAutofill &&
          f.viewable &&
          (f.type === "text" || f.type === "number") &&
          (AutofillService.fieldIsFuzzyMatch(f, AutoFillConstants.TotpFieldNames) ||
            f.autoCompleteType === "one-time-code")
        ) {
          totps.push(f);
        }
      });
    }

    usernames.forEach((u) => {
      // eslint-disable-next-line
      if (filledFields.hasOwnProperty(u.opid)) {
        return;
      }

      filledFields[u.opid] = u;
      AutofillService.fillByOpid(fillScript, u, login.username);
    });

    passwords.forEach((p) => {
      // eslint-disable-next-line
      if (filledFields.hasOwnProperty(p.opid)) {
        return;
      }

      filledFields[p.opid] = p;
      AutofillService.fillByOpid(fillScript, p, login.password);
    });

    if (options.allowTotpAutofill) {
      await Promise.all(
        totps.map(async (t) => {
          if (Object.prototype.hasOwnProperty.call(filledFields, t.opid)) {
            return;
          }

          filledFields[t.opid] = t;
          const totpValue = await this.totpService.getCode(login.totp);
          AutofillService.fillByOpid(fillScript, t, totpValue);
        })
      );
    }

    fillScript = AutofillService.setFillScriptForFocus(filledFields, fillScript);
    return fillScript;
  }

  private generateCardFillScript(
    fillScript: AutofillScript,
    pageDetails: AutofillPageDetails,
    filledFields: { [id: string]: AutofillField },
    options: GenerateFillScriptOptions
  ): AutofillScript {
    if (!options.cipher.card) {
      return null;
    }

    const fillFields: { [id: string]: AutofillField } = {};

    pageDetails.fields.forEach((f) => {
      if (AutofillService.forCustomFieldsOnly(f)) {
        return;
      }

      if (this.isExcludedType(f.type, AutoFillConstants.ExcludedAutofillTypes)) {
        return;
      }

      for (let i = 0; i < CreditCardAutoFillConstants.CardAttributes.length; i++) {
        const attr = CreditCardAutoFillConstants.CardAttributes[i];
        // eslint-disable-next-line
        if (!f.hasOwnProperty(attr) || !f[attr] || !f.viewable) {
          continue;
        }

        // ref https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill
        // ref https://developers.google.com/web/fundamentals/design-and-ux/input/forms/
        if (
          !fillFields.cardholderName &&
          AutofillService.isFieldMatch(
            f[attr],
            CreditCardAutoFillConstants.CardHolderFieldNames,
            CreditCardAutoFillConstants.CardHolderFieldNameValues
          )
        ) {
          fillFields.cardholderName = f;
          break;
        } else if (
          !fillFields.number &&
          AutofillService.isFieldMatch(
            f[attr],
            CreditCardAutoFillConstants.CardNumberFieldNames,
            CreditCardAutoFillConstants.CardNumberFieldNameValues
          )
        ) {
          fillFields.number = f;
          break;
        } else if (
          !fillFields.exp &&
          AutofillService.isFieldMatch(
            f[attr],
            CreditCardAutoFillConstants.CardExpiryFieldNames,
            CreditCardAutoFillConstants.CardExpiryFieldNameValues
          )
        ) {
          fillFields.exp = f;
          break;
        } else if (
          !fillFields.expMonth &&
          AutofillService.isFieldMatch(f[attr], CreditCardAutoFillConstants.ExpiryMonthFieldNames)
        ) {
          fillFields.expMonth = f;
          break;
        } else if (
          !fillFields.expYear &&
          AutofillService.isFieldMatch(f[attr], CreditCardAutoFillConstants.ExpiryYearFieldNames)
        ) {
          fillFields.expYear = f;
          break;
        } else if (
          !fillFields.code &&
          AutofillService.isFieldMatch(f[attr], CreditCardAutoFillConstants.CVVFieldNames)
        ) {
          fillFields.code = f;
          break;
        } else if (
          !fillFields.brand &&
          AutofillService.isFieldMatch(f[attr], CreditCardAutoFillConstants.CardBrandFieldNames)
        ) {
          fillFields.brand = f;
          break;
        }
      }
    });

    const card = options.cipher.card;
    this.makeScriptAction(fillScript, card, fillFields, filledFields, "cardholderName");
    this.makeScriptAction(fillScript, card, fillFields, filledFields, "number");
    this.makeScriptAction(fillScript, card, fillFields, filledFields, "code");
    this.makeScriptAction(fillScript, card, fillFields, filledFields, "brand");

    if (fillFields.expMonth && AutofillService.hasValue(card.expMonth)) {
      let expMonth: string = card.expMonth;

      if (fillFields.expMonth.selectInfo && fillFields.expMonth.selectInfo.options) {
        let index: number = null;
        const siOptions = fillFields.expMonth.selectInfo.options;
        if (siOptions.length === 12) {
          index = parseInt(card.expMonth, null) - 1;
        } else if (siOptions.length === 13) {
          if (
            siOptions[0][0] != null &&
            siOptions[0][0] !== "" &&
            (siOptions[12][0] == null || siOptions[12][0] === "")
          ) {
            index = parseInt(card.expMonth, null) - 1;
          } else {
            index = parseInt(card.expMonth, null);
          }
        }

        if (index != null) {
          const option = siOptions[index];
          if (option.length > 1) {
            expMonth = option[1];
          }
        }
      } else if (
        (this.fieldAttrsContain(fillFields.expMonth, "mm") ||
          fillFields.expMonth.maxLength === 2) &&
        expMonth.length === 1
      ) {
        expMonth = "0" + expMonth;
      }

      filledFields[fillFields.expMonth.opid] = fillFields.expMonth;
      AutofillService.fillByOpid(fillScript, fillFields.expMonth, expMonth);
    }

    if (fillFields.expYear && AutofillService.hasValue(card.expYear)) {
      let expYear: string = card.expYear;
      if (fillFields.expYear.selectInfo && fillFields.expYear.selectInfo.options) {
        for (let i = 0; i < fillFields.expYear.selectInfo.options.length; i++) {
          const o: [string, string] = fillFields.expYear.selectInfo.options[i];
          if (o[0] === card.expYear || o[1] === card.expYear) {
            expYear = o[1];
            break;
          }
          if (
            o[1].length === 2 &&
            card.expYear.length === 4 &&
            o[1] === card.expYear.substring(2)
          ) {
            expYear = o[1];
            break;
          }
          const colonIndex = o[1].indexOf(":");
          if (colonIndex > -1 && o[1].length > colonIndex + 1) {
            const val = o[1].substring(colonIndex + 2);
            if (val != null && val.trim() !== "" && val === card.expYear) {
              expYear = o[1];
              break;
            }
          }
        }
      } else if (
        this.fieldAttrsContain(fillFields.expYear, "yyyy") ||
        fillFields.expYear.maxLength === 4
      ) {
        if (expYear.length === 2) {
          expYear = "20" + expYear;
        }
      } else if (
        this.fieldAttrsContain(fillFields.expYear, "yy") ||
        fillFields.expYear.maxLength === 2
      ) {
        if (expYear.length === 4) {
          expYear = expYear.substr(2);
        }
      }

      filledFields[fillFields.expYear.opid] = fillFields.expYear;
      AutofillService.fillByOpid(fillScript, fillFields.expYear, expYear);
    }

    if (
      fillFields.exp &&
      AutofillService.hasValue(card.expMonth) &&
      AutofillService.hasValue(card.expYear)
    ) {
      const fullMonth = ("0" + card.expMonth).slice(-2);

      let fullYear: string = card.expYear;
      let partYear: string = null;
      if (fullYear.length === 2) {
        partYear = fullYear;
        fullYear = "20" + fullYear;
      } else if (fullYear.length === 4) {
        partYear = fullYear.substr(2, 2);
      }

      let exp: string = null;
      for (let i = 0; i < CreditCardAutoFillConstants.MonthAbbr.length; i++) {
        if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.MonthAbbr[i] +
              "/" +
              CreditCardAutoFillConstants.YearAbbrLong[i]
          )
        ) {
          exp = fullMonth + "/" + fullYear;
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.MonthAbbr[i] +
              "/" +
              CreditCardAutoFillConstants.YearAbbrShort[i]
          ) &&
          partYear != null
        ) {
          exp = fullMonth + "/" + partYear;
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.YearAbbrLong[i] +
              "/" +
              CreditCardAutoFillConstants.MonthAbbr[i]
          )
        ) {
          exp = fullYear + "/" + fullMonth;
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.YearAbbrShort[i] +
              "/" +
              CreditCardAutoFillConstants.MonthAbbr[i]
          ) &&
          partYear != null
        ) {
          exp = partYear + "/" + fullMonth;
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.MonthAbbr[i] +
              "-" +
              CreditCardAutoFillConstants.YearAbbrLong[i]
          )
        ) {
          exp = fullMonth + "-" + fullYear;
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.MonthAbbr[i] +
              "-" +
              CreditCardAutoFillConstants.YearAbbrShort[i]
          ) &&
          partYear != null
        ) {
          exp = fullMonth + "-" + partYear;
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.YearAbbrLong[i] +
              "-" +
              CreditCardAutoFillConstants.MonthAbbr[i]
          )
        ) {
          exp = fullYear + "-" + fullMonth;
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.YearAbbrShort[i] +
              "-" +
              CreditCardAutoFillConstants.MonthAbbr[i]
          ) &&
          partYear != null
        ) {
          exp = partYear + "-" + fullMonth;
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.YearAbbrLong[i] + CreditCardAutoFillConstants.MonthAbbr[i]
          )
        ) {
          exp = fullYear + fullMonth;
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.YearAbbrShort[i] + CreditCardAutoFillConstants.MonthAbbr[i]
          ) &&
          partYear != null
        ) {
          exp = partYear + fullMonth;
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.MonthAbbr[i] + CreditCardAutoFillConstants.YearAbbrLong[i]
          )
        ) {
          exp = fullMonth + fullYear;
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.MonthAbbr[i] + CreditCardAutoFillConstants.YearAbbrShort[i]
          ) &&
          partYear != null
        ) {
          exp = fullMonth + partYear;
        }

        if (exp != null) {
          break;
        }
      }

      if (exp == null) {
        exp = fullYear + "-" + fullMonth;
      }

      this.makeScriptActionWithValue(fillScript, exp, fillFields.exp, filledFields);
    }

    return fillScript;
  }

  /**
   * Determines whether an iframe is potentially dangerous ("untrusted") to autofill
   * @param pageUrl The url of the page/iframe, usually from AutofillPageDetails
   * @param options The GenerateFillScript options
   * @returns `true` if the iframe is untrusted and a warning should be shown, `false` otherwise
   */
  private inUntrustedIframe(pageUrl: string, options: GenerateFillScriptOptions): boolean {
    // If the pageUrl (from the content script) matches the tabUrl (from the sender tab), we are not in an iframe
    // This also avoids a false positive if no URI is saved and the user triggers auto-fill anyway
    if (pageUrl === options.tabUrl) {
      return false;
    }

    // Check the pageUrl against cipher URIs using the configured match detection.
    // Remember: if we are in this function, the tabUrl already matches a saved URI for the login.
    // We need to verify the pageUrl also matches.
    const equivalentDomains = this.settingsService.getEquivalentDomains(pageUrl);
    const matchesUri = options.cipher.login.matchesUri(
      pageUrl,
      equivalentDomains,
      options.defaultUriMatch
    );
    return !matchesUri;
  }

  private fieldAttrsContain(field: AutofillField, containsVal: string) {
    if (!field) {
      return false;
    }

    let doesContain = false;
    CreditCardAutoFillConstants.CardAttributesExtended.forEach((attr) => {
      // eslint-disable-next-line
      if (doesContain || !field.hasOwnProperty(attr) || !field[attr]) {
        return;
      }

      let val = field[attr];
      val = val.replace(/ /g, "").toLowerCase();
      doesContain = val.indexOf(containsVal) > -1;
    });

    return doesContain;
  }

  private generateIdentityFillScript(
    fillScript: AutofillScript,
    pageDetails: AutofillPageDetails,
    filledFields: { [id: string]: AutofillField },
    options: GenerateFillScriptOptions
  ): AutofillScript {
    if (!options.cipher.identity) {
      return null;
    }

    const fillFields: { [id: string]: AutofillField } = {};

    pageDetails.fields.forEach((f) => {
      if (AutofillService.forCustomFieldsOnly(f)) {
        return;
      }

      if (this.isExcludedType(f.type, AutoFillConstants.ExcludedAutofillTypes)) {
        return;
      }

      for (let i = 0; i < IdentityAutoFillConstants.IdentityAttributes.length; i++) {
        const attr = IdentityAutoFillConstants.IdentityAttributes[i];
        // eslint-disable-next-line
        if (!f.hasOwnProperty(attr) || !f[attr] || !f.viewable) {
          continue;
        }

        // ref https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill
        // ref https://developers.google.com/web/fundamentals/design-and-ux/input/forms/
        if (
          !fillFields.name &&
          AutofillService.isFieldMatch(
            f[attr],
            IdentityAutoFillConstants.FullNameFieldNames,
            IdentityAutoFillConstants.FullNameFieldNameValues
          )
        ) {
          fillFields.name = f;
          break;
        } else if (
          !fillFields.firstName &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.FirstnameFieldNames)
        ) {
          fillFields.firstName = f;
          break;
        } else if (
          !fillFields.middleName &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.MiddlenameFieldNames)
        ) {
          fillFields.middleName = f;
          break;
        } else if (
          !fillFields.lastName &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.LastnameFieldNames)
        ) {
          fillFields.lastName = f;
          break;
        } else if (
          !fillFields.title &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.TitleFieldNames)
        ) {
          fillFields.title = f;
          break;
        } else if (
          !fillFields.email &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.EmailFieldNames)
        ) {
          fillFields.email = f;
          break;
        } else if (
          !fillFields.address &&
          AutofillService.isFieldMatch(
            f[attr],
            IdentityAutoFillConstants.AddressFieldNames,
            IdentityAutoFillConstants.AddressFieldNameValues
          )
        ) {
          fillFields.address = f;
          break;
        } else if (
          !fillFields.address1 &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.Address1FieldNames)
        ) {
          fillFields.address1 = f;
          break;
        } else if (
          !fillFields.address2 &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.Address2FieldNames)
        ) {
          fillFields.address2 = f;
          break;
        } else if (
          !fillFields.address3 &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.Address3FieldNames)
        ) {
          fillFields.address3 = f;
          break;
        } else if (
          !fillFields.postalCode &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.PostalCodeFieldNames)
        ) {
          fillFields.postalCode = f;
          break;
        } else if (
          !fillFields.city &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.CityFieldNames)
        ) {
          fillFields.city = f;
          break;
        } else if (
          !fillFields.state &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.StateFieldNames)
        ) {
          fillFields.state = f;
          break;
        } else if (
          !fillFields.country &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.CountryFieldNames)
        ) {
          fillFields.country = f;
          break;
        } else if (
          !fillFields.phone &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.PhoneFieldNames)
        ) {
          fillFields.phone = f;
          break;
        } else if (
          !fillFields.username &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.UserNameFieldNames)
        ) {
          fillFields.username = f;
          break;
        } else if (
          !fillFields.company &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.CompanyFieldNames)
        ) {
          fillFields.company = f;
          break;
        }
      }
    });

    const identity = options.cipher.identity;
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "title");
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "firstName");
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "middleName");
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "lastName");
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "address1");
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "address2");
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "address3");
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "city");
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "postalCode");
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "company");
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "email");
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "phone");
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "username");

    let filledState = false;
    if (fillFields.state && identity.state && identity.state.length > 2) {
      const stateLower = identity.state.toLowerCase();
      const isoState =
        IdentityAutoFillConstants.IsoStates[stateLower] ||
        IdentityAutoFillConstants.IsoProvinces[stateLower];
      if (isoState) {
        filledState = true;
        this.makeScriptActionWithValue(fillScript, isoState, fillFields.state, filledFields);
      }
    }

    if (!filledState) {
      this.makeScriptAction(fillScript, identity, fillFields, filledFields, "state");
    }

    let filledCountry = false;
    if (fillFields.country && identity.country && identity.country.length > 2) {
      const countryLower = identity.country.toLowerCase();
      const isoCountry = IdentityAutoFillConstants.IsoCountries[countryLower];
      if (isoCountry) {
        filledCountry = true;
        this.makeScriptActionWithValue(fillScript, isoCountry, fillFields.country, filledFields);
      }
    }

    if (!filledCountry) {
      this.makeScriptAction(fillScript, identity, fillFields, filledFields, "country");
    }

    if (fillFields.name && (identity.firstName || identity.lastName)) {
      let fullName = "";
      if (AutofillService.hasValue(identity.firstName)) {
        fullName = identity.firstName;
      }
      if (AutofillService.hasValue(identity.middleName)) {
        if (fullName !== "") {
          fullName += " ";
        }
        fullName += identity.middleName;
      }
      if (AutofillService.hasValue(identity.lastName)) {
        if (fullName !== "") {
          fullName += " ";
        }
        fullName += identity.lastName;
      }

      this.makeScriptActionWithValue(fillScript, fullName, fillFields.name, filledFields);
    }

    if (fillFields.address && AutofillService.hasValue(identity.address1)) {
      let address = "";
      if (AutofillService.hasValue(identity.address1)) {
        address = identity.address1;
      }
      if (AutofillService.hasValue(identity.address2)) {
        if (address !== "") {
          address += ", ";
        }
        address += identity.address2;
      }
      if (AutofillService.hasValue(identity.address3)) {
        if (address !== "") {
          address += ", ";
        }
        address += identity.address3;
      }

      this.makeScriptActionWithValue(fillScript, address, fillFields.address, filledFields);
    }

    return fillScript;
  }

  private isExcludedType(type: string, excludedTypes: string[]) {
    return excludedTypes.indexOf(type) > -1;
  }

  private static isFieldMatch(
    value: string,
    options: string[],
    containsOptions?: string[]
  ): boolean {
    value = value
      .trim()
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]+/g, "");
    for (let i = 0; i < options.length; i++) {
      let option = options[i];
      const checkValueContains = containsOptions == null || containsOptions.indexOf(option) > -1;
      option = option.toLowerCase().replace(/-/g, "");
      if (value === option || (checkValueContains && value.indexOf(option) > -1)) {
        return true;
      }
    }

    return false;
  }

  private makeScriptAction(
    fillScript: AutofillScript,
    cipherData: any,
    fillFields: { [id: string]: AutofillField },
    filledFields: { [id: string]: AutofillField },
    dataProp: string,
    fieldProp?: string
  ) {
    fieldProp = fieldProp || dataProp;
    this.makeScriptActionWithValue(
      fillScript,
      cipherData[dataProp],
      fillFields[fieldProp],
      filledFields
    );
  }

  private makeScriptActionWithValue(
    fillScript: AutofillScript,
    dataValue: any,
    field: AutofillField,
    filledFields: { [id: string]: AutofillField }
  ) {
    let doFill = false;
    if (AutofillService.hasValue(dataValue) && field) {
      if (field.type === "select-one" && field.selectInfo && field.selectInfo.options) {
        for (let i = 0; i < field.selectInfo.options.length; i++) {
          const option = field.selectInfo.options[i];
          for (let j = 0; j < option.length; j++) {
            if (
              AutofillService.hasValue(option[j]) &&
              option[j].toLowerCase() === dataValue.toLowerCase()
            ) {
              doFill = true;
              if (option.length > 1) {
                dataValue = option[1];
              }
              break;
            }
          }

          if (doFill) {
            break;
          }
        }
      } else {
        doFill = true;
      }
    }

    if (doFill) {
      filledFields[field.opid] = field;
      AutofillService.fillByOpid(fillScript, field, dataValue);
    }
  }

  static loadPasswordFields(
    pageDetails: AutofillPageDetails,
    canBeHidden: boolean,
    canBeReadOnly: boolean,
    mustBeEmpty: boolean,
    fillNewPassword: boolean
  ) {
    const arr: AutofillField[] = [];
    pageDetails.fields.forEach((f) => {
      if (AutofillService.forCustomFieldsOnly(f)) {
        return;
      }

      const isPassword = f.type === "password";
      const valueIsLikePassword = (value: string) => {
        if (value == null) {
          return false;
        }
        // Removes all whitespace, _ and - characters
        // eslint-disable-next-line
        const cleanedValue = value.toLowerCase().replace(/[\s_\-]/g, "");

        if (cleanedValue.indexOf("password") < 0) {
          return false;
        }

        if (AutoFillConstants.PasswordFieldIgnoreList.some((i) => cleanedValue.indexOf(i) > -1)) {
          return false;
        }

        return true;
      };
      const isLikePassword = () => {
        if (f.type !== "text") {
          return false;
        }
        if (valueIsLikePassword(f.htmlID)) {
          return true;
        }
        if (valueIsLikePassword(f.htmlName)) {
          return true;
        }
        if (valueIsLikePassword(f.placeholder)) {
          return true;
        }
        return false;
      };
      if (
        !f.disabled &&
        (canBeReadOnly || !f.readonly) &&
        (isPassword || isLikePassword()) &&
        (canBeHidden || f.viewable) &&
        (!mustBeEmpty || f.value == null || f.value.trim() === "") &&
        (fillNewPassword || f.autoCompleteType !== "new-password")
      ) {
        arr.push(f);
      }
    });
    return arr;
  }

  private findUsernameField(
    pageDetails: AutofillPageDetails,
    passwordField: AutofillField,
    canBeHidden: boolean,
    canBeReadOnly: boolean,
    withoutForm: boolean
  ) {
    let usernameField: AutofillField = null;
    for (let i = 0; i < pageDetails.fields.length; i++) {
      const f = pageDetails.fields[i];
      if (AutofillService.forCustomFieldsOnly(f)) {
        continue;
      }

      if (f.elementNumber >= passwordField.elementNumber) {
        break;
      }

      if (
        !f.disabled &&
        (canBeReadOnly || !f.readonly) &&
        (withoutForm || f.form === passwordField.form) &&
        (canBeHidden || f.viewable) &&
        (f.type === "text" || f.type === "email" || f.type === "tel")
      ) {
        usernameField = f;

        if (this.findMatchingFieldIndex(f, AutoFillConstants.UsernameFieldNames) > -1) {
          // We found an exact match. No need to keep looking.
          break;
        }
      }
    }

    return usernameField;
  }

  private findTotpField(
    pageDetails: AutofillPageDetails,
    passwordField: AutofillField,
    canBeHidden: boolean,
    canBeReadOnly: boolean,
    withoutForm: boolean
  ) {
    let totpField: AutofillField = null;
    for (let i = 0; i < pageDetails.fields.length; i++) {
      const f = pageDetails.fields[i];
      if (AutofillService.forCustomFieldsOnly(f)) {
        continue;
      }

      if (
        !f.disabled &&
        (canBeReadOnly || !f.readonly) &&
        (withoutForm || f.form === passwordField.form) &&
        (canBeHidden || f.viewable) &&
        (f.type === "text" || f.type === "number") &&
        AutofillService.fieldIsFuzzyMatch(f, AutoFillConstants.TotpFieldNames)
      ) {
        totpField = f;

        if (
          this.findMatchingFieldIndex(f, AutoFillConstants.TotpFieldNames) > -1 ||
          f.autoCompleteType === "one-time-code"
        ) {
          // We found an exact match. No need to keep looking.
          break;
        }
      }
    }

    return totpField;
  }

  private findMatchingFieldIndex(field: AutofillField, names: string[]): number {
    for (let i = 0; i < names.length; i++) {
      if (names[i].indexOf("=") > -1) {
        if (this.fieldPropertyIsPrefixMatch(field, "htmlID", names[i], "id")) {
          return i;
        }
        if (this.fieldPropertyIsPrefixMatch(field, "htmlName", names[i], "name")) {
          return i;
        }
        if (this.fieldPropertyIsPrefixMatch(field, "label-left", names[i], "label")) {
          return i;
        }
        if (this.fieldPropertyIsPrefixMatch(field, "label-right", names[i], "label")) {
          return i;
        }
        if (this.fieldPropertyIsPrefixMatch(field, "label-tag", names[i], "label")) {
          return i;
        }
        if (this.fieldPropertyIsPrefixMatch(field, "label-aria", names[i], "label")) {
          return i;
        }
        if (this.fieldPropertyIsPrefixMatch(field, "placeholder", names[i], "placeholder")) {
          return i;
        }
      }

      if (this.fieldPropertyIsMatch(field, "htmlID", names[i])) {
        return i;
      }
      if (this.fieldPropertyIsMatch(field, "htmlName", names[i])) {
        return i;
      }
      if (this.fieldPropertyIsMatch(field, "label-left", names[i])) {
        return i;
      }
      if (this.fieldPropertyIsMatch(field, "label-right", names[i])) {
        return i;
      }
      if (this.fieldPropertyIsMatch(field, "label-tag", names[i])) {
        return i;
      }
      if (this.fieldPropertyIsMatch(field, "label-aria", names[i])) {
        return i;
      }
      if (this.fieldPropertyIsMatch(field, "placeholder", names[i])) {
        return i;
      }
    }

    return -1;
  }

  private fieldPropertyIsPrefixMatch(
    field: any,
    property: string,
    name: string,
    prefix: string,
    separator = "="
  ): boolean {
    if (name.indexOf(prefix + separator) === 0) {
      const sepIndex = name.indexOf(separator);
      const val = name.substring(sepIndex + 1);
      return val != null && this.fieldPropertyIsMatch(field, property, val);
    }
    return false;
  }

  private fieldPropertyIsMatch(field: any, property: string, name: string): boolean {
    let fieldVal = field[property] as string;
    if (!AutofillService.hasValue(fieldVal)) {
      return false;
    }

    fieldVal = fieldVal.trim().replace(/(?:\r\n|\r|\n)/g, "");
    if (name.startsWith("regex=")) {
      try {
        const regexParts = name.split("=", 2);
        if (regexParts.length === 2) {
          const regex = new RegExp(regexParts[1], "i");
          return regex.test(fieldVal);
        }
      } catch (e) {
        this.logService.error(e);
      }
    } else if (name.startsWith("csv=")) {
      const csvParts = name.split("=", 2);
      if (csvParts.length === 2) {
        const csvVals = csvParts[1].split(",");
        for (let i = 0; i < csvVals.length; i++) {
          const val = csvVals[i];
          if (val != null && val.trim().toLowerCase() === fieldVal.toLowerCase()) {
            return true;
          }
        }
        return false;
      }
    }

    return fieldVal.toLowerCase() === name;
  }

  static fieldIsFuzzyMatch(field: AutofillField, names: string[]): boolean {
    if (AutofillService.hasValue(field.htmlID) && this.fuzzyMatch(names, field.htmlID)) {
      return true;
    }
    if (AutofillService.hasValue(field.htmlName) && this.fuzzyMatch(names, field.htmlName)) {
      return true;
    }
    if (
      AutofillService.hasValue(field["label-tag"]) &&
      this.fuzzyMatch(names, field["label-tag"])
    ) {
      return true;
    }
    if (AutofillService.hasValue(field.placeholder) && this.fuzzyMatch(names, field.placeholder)) {
      return true;
    }
    if (
      AutofillService.hasValue(field["label-left"]) &&
      this.fuzzyMatch(names, field["label-left"])
    ) {
      return true;
    }
    if (
      AutofillService.hasValue(field["label-top"]) &&
      this.fuzzyMatch(names, field["label-top"])
    ) {
      return true;
    }
    if (
      AutofillService.hasValue(field["label-aria"]) &&
      this.fuzzyMatch(names, field["label-aria"])
    ) {
      return true;
    }

    return false;
  }

  private static fuzzyMatch(options: string[], value: string): boolean {
    if (options == null || options.length === 0 || value == null || value === "") {
      return false;
    }

    value = value
      .replace(/(?:\r\n|\r|\n)/g, "")
      .trim()
      .toLowerCase();

    for (let i = 0; i < options.length; i++) {
      if (value.indexOf(options[i]) > -1) {
        return true;
      }
    }

    return false;
  }

  static hasValue(str: string): boolean {
    return Boolean(str && str !== "");
  }

  static setFillScriptForFocus(
    filledFields: { [id: string]: AutofillField },
    fillScript: AutofillScript
  ): AutofillScript {
    let lastField: AutofillField = null;
    let lastPasswordField: AutofillField = null;

    for (const opid in filledFields) {
      // eslint-disable-next-line
      if (filledFields.hasOwnProperty(opid) && filledFields[opid].viewable) {
        lastField = filledFields[opid];

        if (filledFields[opid].type === "password") {
          lastPasswordField = filledFields[opid];
        }
      }
    }

    // Prioritize password field over others.
    if (lastPasswordField) {
      fillScript.script.push(["focus_by_opid", lastPasswordField.opid]);
    } else if (lastField) {
      fillScript.script.push(["focus_by_opid", lastField.opid]);
    }

    return fillScript;
  }

  static fillByOpid(fillScript: AutofillScript, field: AutofillField, value: string): void {
    if (field.maxLength && value && value.length > field.maxLength) {
      value = value.substr(0, value.length);
    }
    if (field.tagName !== "span") {
      fillScript.script.push(["click_on_opid", field.opid]);
      fillScript.script.push(["focus_by_opid", field.opid]);
    }
    fillScript.script.push(["fill_by_opid", field.opid, value]);
  }

  static forCustomFieldsOnly(field: AutofillField): boolean {
    return field.tagName === "span";
  }
}
