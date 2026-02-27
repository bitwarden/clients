import { mock } from "jest-mock-extended";
import { Subject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { DocumentLangSetter } from "./document-lang.setter";

describe("DocumentLangSetter", () => {
  const document = mock<Document>();
  const i18nService = mock<I18nService>();

  const sut = new DocumentLangSetter(document, i18nService);

  describe("start", () => {
    it("reacts to locale changes while start called with a non-closed subscription", async () => {
      const localeSubject = new Subject<string>();
      i18nService.locale$ = localeSubject;

      localeSubject.next("en");

      expect(document.documentElement.lang).toBeFalsy();

      const sub = sut.start();

      localeSubject.next("es");

      expect(document.documentElement.lang).toBe("es");

      sub.unsubscribe();

      localeSubject.next("ar");

      expect(document.documentElement.lang).toBe("es");
    });
  });
});
