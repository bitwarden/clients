import { mock } from "jest-mock-extended";

import { ForwarderContext } from "../engine";

import { Fastmail, FastmailSettings } from "./fastmail";

describe("Fastmail forwarder", () => {
  const context = mock<ForwarderContext<FastmailSettings>>();

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("authenticate", () => {
    it("returns a bearer header with the token", () => {
      context.authenticationToken.mockReturnValue("token");

      const result = Fastmail.authenticate(null, context);

      expect(result).toEqual({ Authorization: "Bearer token" });
      expect(context.authenticationToken).toHaveBeenCalled();
    });
  });

  describe("settings", () => {
    it("should pass through deserialization", () => {
      const value: any = {};
      const result = Fastmail.forwarder.settings.deserializer(value);
      expect(result).toBe(value);
    });
  });

  describe("importBuffer", () => {
    it("should pass through deserialization", () => {
      const value: any = {};
      const result = Fastmail.forwarder.importBuffer.options.deserializer(value);
      expect(result).toBe(value);
    });
  });

  describe("getAccountId", () => {
    describe("url", () => {
      it("returns the alias path", () => {
        context.baseUrl.mockReturnValue("");

        const result = Fastmail.forwarder.getAccountId.url(null, context);

        expect(result).toEqual("/jmap/session");
      });
    });

    describe("hasJsonPayload", () => {
      it.each([[200]])("returns true when the status is $%i", (status) => {
        const result = Fastmail.forwarder.getAccountId.hasJsonPayload(
          { status } as Response,
          context,
        );
        expect(result).toBeTruthy();
      });
    });

    describe("processJson", () => {
      it("looks up an account id", () => {
        const json = {
          primaryAccounts: {
            "https://www.fastmail.com/dev/maskedemail": "some id",
          },
        };

        const result = Fastmail.forwarder.getAccountId.processJson(json, context);
        expect(result).toEqual(["some id"]);
      });

      it("returns a cause when account id is missing", () => {
        context.missingAccountIdCause.mockReturnValue("cause");
        const json = {
          primaryAccounts: {
            "https://www.fastmail.com/dev/maskedemail": null as string,
          },
        };

        const result = Fastmail.forwarder.getAccountId.processJson(json, context);
        expect(result).toEqual([undefined, "cause"]);
      });

      it("returns a cause when masked mail account is missing", () => {
        context.missingAccountIdCause.mockReturnValue("cause");
        const json = { primaryAccounts: {} };

        const result = Fastmail.forwarder.getAccountId.processJson(json, context);
        expect(result).toEqual([undefined, "cause"]);
      });

      it("returns a cause when all accounts are missing", () => {
        context.missingAccountIdCause.mockReturnValue("cause");
        const json = { primaryAccounts: null as any };

        const result = Fastmail.forwarder.getAccountId.processJson(json, context);
        expect(result).toEqual([undefined, "cause"]);
      });
    });
  });

  describe("createForwardingEmail", () => {
    describe("url", () => {
      it("returns the alias path", () => {
        context.baseUrl.mockReturnValue("");

        const result = Fastmail.forwarder.createForwardingEmail.url(null, context);

        expect(result).toEqual("/jmap/api/");
      });
    });

    describe("body", () => {
      it("creates a request body without email prefix when prefix is not set", () => {
        context.website.mockReturnValue("website");
        context.prefixEnabled.mockReturnValue(false);
        const request = { accountId: "accountId", website: "" };

        const result = Fastmail.forwarder.createForwardingEmail.body(request, context);
        const methodCall = result.methodCalls[0][1];

        expect(methodCall.accountId).toEqual("accountId");
        expect(methodCall.create["new-masked-email"].forDomain).toEqual("website");
        expect(methodCall.create["new-masked-email"].emailPrefix).toEqual("");
      });
      it("sends the website's origin as forDomain and its hostname as the description", () => {
        const website = "https://1up-usa.com/account/login?ref=nav";
        context.website.mockImplementation((_request, options) =>
          options?.extractOrigin ? "https://1up-usa.com" : "1up-usa.com",
        );
        context.prefixEnabled.mockReturnValue(false);
        const request = { accountId: "accountId", website };

        const result = Fastmail.forwarder.createForwardingEmail.body(request, context);
        const maskedEmail = result.methodCalls[0][1].create["new-masked-email"];

        expect(context.website).toHaveBeenCalledWith(request, { extractOrigin: true });
        expect(context.website).toHaveBeenCalledWith(request, { extractHostname: true });
        expect(maskedEmail.forDomain).toEqual("https://1up-usa.com");
        expect(maskedEmail.description).toEqual("1up-usa.com");
      });
      it("creates a request body with website as email prefix when prefix is enabled", () => {
        context.prefixEnabled.mockReturnValue(true);
        context.prefix.mockReturnValue("example");
        const request = { accountId: "accountId", website: "https://example.com" };
        const result = Fastmail.forwarder.createForwardingEmail.body(request, context);
        const methodCall = result.methodCalls[0][1];
        expect(methodCall.accountId).toEqual("accountId");
        expect(methodCall.create["new-masked-email"].emailPrefix).toEqual("example");
      });
      it("creates a request body with empty email prefix when prefix is enabled but website is empty", () => {
        context.prefixEnabled.mockReturnValue(true);
        context.prefix.mockReturnValue("");
        const request = { accountId: "accountId", website: "" };
        const result = Fastmail.forwarder.createForwardingEmail.body(request, context);
        const methodCall = result.methodCalls[0][1];
        expect(methodCall.accountId).toEqual("accountId");
        expect(methodCall.create["new-masked-email"].emailPrefix).toEqual("");
      });
      it.each([
        ["1up-usa", "n_1up_usa"],
        ["foo_1up-usa", "foo_1up_usa"],
        ["EXAMPLE", "example"],
        ["xn--mnchen-3ya", "xn_mnchen_3ya"],
        ["-example-", "example"],
        ["127_0_0", "n_127_0_0"],
        ["-1password", "n_1password"],
        ["www_cnn", "cnn"],
        ["www_t-mobile", "t_mobile"],
        ["www_1password", "n_1password"],
        ["www2_example", "example"],
        ["www12_example", "example"],
        ["mail_www", "mail_www"],
        ["___", ""],
      ])(
        "replaces characters fastmail rejects in the email prefix (%s => %s)",
        (prefix, expected) => {
          context.prefixEnabled.mockReturnValue(true);
          context.prefix.mockReturnValue(prefix);
          const request = { accountId: "accountId", website: "https://example.com" };

          const result = Fastmail.forwarder.createForwardingEmail.body(request, context);
          const methodCall = result.methodCalls[0][1];

          expect(methodCall.create["new-masked-email"].emailPrefix).toEqual(expected);
        },
      );
      it("truncates the email prefix to the length fastmail accepts", () => {
        context.prefixEnabled.mockReturnValue(true);
        context.prefix.mockReturnValue("a".repeat(70));
        const request = { accountId: "accountId", website: "https://example.com" };

        const result = Fastmail.forwarder.createForwardingEmail.body(request, context);
        const methodCall = result.methodCalls[0][1];

        expect(methodCall.create["new-masked-email"].emailPrefix).toEqual("a".repeat(64));
      });
      it("truncates the email prefix after prepending n_ to a leading digit", () => {
        context.prefixEnabled.mockReturnValue(true);
        context.prefix.mockReturnValue("1".repeat(70));
        const request = { accountId: "accountId", website: "https://example.com" };

        const result = Fastmail.forwarder.createForwardingEmail.body(request, context);
        const methodCall = result.methodCalls[0][1];

        expect(methodCall.create["new-masked-email"].emailPrefix).toEqual("n_" + "1".repeat(62));
      });
    });

    describe("hasJsonPayload", () => {
      it.each([[200]])("returns true when the status is $%i", (status) => {
        const result = Fastmail.forwarder.createForwardingEmail.hasJsonPayload(
          { status } as Response,
          context,
        );
        expect(result).toBeTruthy();
      });
    });

    describe("processJson", () => {
      it("returns the generated email address", () => {
        const body = {
          methodResponses: [
            [
              "MaskedEmail/set",
              {
                created: {
                  "new-masked-email": {
                    email: "jdoe@example.com",
                  },
                },
              },
            ],
          ],
        };

        const result = Fastmail.forwarder.createForwardingEmail.processJson(body, context);

        expect(result).toEqual(["jdoe@example.com"]);
      });

      it("returns a forwarder error if masked email creation fails", () => {
        const notCreatedBody = {
          methodResponses: [
            [
              "MaskedEmail/set",
              {
                notCreated: { "new-masked-email": { description: "It turned inside out!" } },
              },
            ],
          ],
        };

        const notCreatedResult = Fastmail.forwarder.createForwardingEmail.processJson(
          notCreatedBody,
          context,
        );

        expect(notCreatedResult).toEqual([undefined, "It turned inside out!"]);

        const generalErrorBody = {
          methodResponses: [["error", { description: "And then it exploded!" }]],
        };

        const generalErrorResult = Fastmail.forwarder.createForwardingEmail.processJson(
          generalErrorBody,
          context,
        );

        expect(generalErrorResult).toEqual([undefined, "And then it exploded!"]);
      });

      it.each([
        null,
        [],
        [[]],
        [["MaskedEmail/not-a-real-op"]],
        [["MaskedEmail/set", null]],
        [["MaskedEmail/set", { created: null }]],
        [["MaskedEmail/set", { created: { "new-masked-email": null } }]],
        [["MaskedEmail/set", { notCreated: null }]],
        [["MaskedEmail/set", { notCreated: { "new-masked-email": null } }]],
      ])("returns undefined if the jmap request is malformed (=%p)", (response: any) => {
        const generalErrorBody = {
          methodResponses: response,
        };

        const result = Fastmail.forwarder.createForwardingEmail.processJson(
          generalErrorBody,
          context,
        );

        expect(result).toBeUndefined();
      });
    });
  });
});
