import { LoginData } from "../data/login.data";

import { LoginApi } from "./login.api";

describe("LoginApi", () => {
  it("reads the HTTP authentication setting from the response", () => {
    const loginApi = new LoginApi({ HttpAuthenticationEnabled: true });

    expect(loginApi.httpAuthenticationEnabled).toBe(true);
  });

  it("leaves the HTTP authentication setting unset when the response has none", () => {
    const loginApi = new LoginApi({ Username: "username" });

    expect(loginApi.httpAuthenticationEnabled).toBeUndefined();
  });

  it("carries the HTTP authentication setting into LoginData", () => {
    const loginData = new LoginData(new LoginApi({ HttpAuthenticationEnabled: true }));

    expect(loginData.httpAuthenticationEnabled).toBe(true);
  });
});
