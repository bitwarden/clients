import { Login as LoginDomain } from "../../vault/models/domain/login";
import { LoginView } from "../../vault/models/view/login.view";

import { LoginExport } from "./login.export";

describe("LoginExport", () => {
  describe("httpAuthenticationEnabled", () => {
    it("is false in the template", () => {
      expect(LoginExport.template().httpAuthenticationEnabled).toBe(false);
    });

    it.each([true, false])("is exported from a login view (%s)", (httpAuthenticationEnabled) => {
      const view = new LoginView();
      view.httpAuthenticationEnabled = httpAuthenticationEnabled;

      expect(new LoginExport(view).httpAuthenticationEnabled).toBe(httpAuthenticationEnabled);
    });

    it.each([true, false])("is exported from a login domain (%s)", (httpAuthenticationEnabled) => {
      const domain = new LoginDomain();
      domain.httpAuthenticationEnabled = httpAuthenticationEnabled;

      expect(new LoginExport(domain).httpAuthenticationEnabled).toBe(httpAuthenticationEnabled);
    });

    it("is left out of the exported JSON when it was never set", () => {
      const exported = JSON.parse(JSON.stringify(new LoginExport(new LoginView())));

      expect(exported).not.toHaveProperty("httpAuthenticationEnabled");
    });

    it.each([true, false])("is imported into a login view (%s)", (httpAuthenticationEnabled) => {
      const request = new LoginExport();
      request.httpAuthenticationEnabled = httpAuthenticationEnabled;

      expect(LoginExport.toView(request).httpAuthenticationEnabled).toBe(httpAuthenticationEnabled);
    });

    it.each([true, false])("is imported into a login domain (%s)", (httpAuthenticationEnabled) => {
      const request = new LoginExport();
      request.httpAuthenticationEnabled = httpAuthenticationEnabled;

      expect(LoginExport.toDomain(request).httpAuthenticationEnabled).toBe(
        httpAuthenticationEnabled,
      );
    });

    it("stays unset when imported from an export without it", () => {
      const request = new LoginExport();

      expect(LoginExport.toView(request).httpAuthenticationEnabled).toBeUndefined();
      expect(LoginExport.toDomain(request).httpAuthenticationEnabled).toBeUndefined();
    });
  });
});
