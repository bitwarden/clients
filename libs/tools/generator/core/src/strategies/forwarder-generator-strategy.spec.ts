import { mock } from "jest-mock-extended";
import { of, firstValueFrom } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
// FIXME: use index.ts imports once policy abstractions and models
// implement ADR-0002
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { RestClient } from "@bitwarden/common/tools/integration/rpc";
import { BufferedState } from "@bitwarden/common/tools/state/buffered-state";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import { FakeStateProvider, mockAccountServiceWith } from "../../../../../common/spec";
import { AddyIo, Fastmail, FirefoxRelay } from "../integration";
import { DefaultPolicyEvaluator } from "../policies";

import { ForwarderGeneratorStrategy } from "./forwarder-generator-strategy";

const SomeUser = "some user" as UserId;
const AnotherUser = "another user" as UserId;
const SomePolicy = mock<Policy>({
  type: PolicyType.PasswordGenerator,
  data: {
    minLength: 10,
  },
});

describe("ForwarderGeneratorStrategy", () => {
  const encryptService = mock<EncryptService>();
  const keyService = mock<KeyService>();
  const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
  const restClient = mock<RestClient>();
  const i18nService = mock<I18nService>();

  beforeEach(() => {
    const keyAvailable = of({} as UserKey);
    keyService.userKey$.mockReturnValue(keyAvailable);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("durableState", () => {
    it("constructs a secret state", () => {
      const strategy = new ForwarderGeneratorStrategy(
        AddyIo,
        restClient,
        i18nService,
        encryptService,
        keyService,
        stateProvider,
      );

      const result = strategy.durableState(SomeUser);

      expect(result).toBeInstanceOf(BufferedState);
    });

    it("returns the same secret state for a single user", () => {
      const strategy = new ForwarderGeneratorStrategy(
        AddyIo,
        restClient,
        i18nService,
        encryptService,
        keyService,
        stateProvider,
      );

      const firstResult = strategy.durableState(SomeUser);
      const secondResult = strategy.durableState(SomeUser);

      expect(firstResult).toBe(secondResult);
    });

    it("returns a different secret state for a different user", () => {
      const strategy = new ForwarderGeneratorStrategy(
        AddyIo,
        restClient,
        i18nService,
        encryptService,
        keyService,
        stateProvider,
      );

      const firstResult = strategy.durableState(SomeUser);
      const secondResult = strategy.durableState(AnotherUser);

      expect(firstResult).not.toBe(secondResult);
    });
  });

  describe("toEvaluator()", () => {
    it.each([[[]], [null], [undefined], [[SomePolicy]], [[SomePolicy, SomePolicy]]])(
      "should map any input (= %p) to the default policy evaluator",
      async (policies) => {
        const strategy = new ForwarderGeneratorStrategy(
          AddyIo,
          restClient,
          i18nService,
          encryptService,
          keyService,
          stateProvider,
        );

        const evaluator$ = of(policies).pipe(strategy.toEvaluator());
        const evaluator = await firstValueFrom(evaluator$);

        expect(evaluator).toBeInstanceOf(DefaultPolicyEvaluator);
      },
    );
  });

  describe("generate", () => {
    it("issues a remote procedure request to create the forwarding address", async () => {
      restClient.fetchJson.mockResolvedValue("jdoe@example.com");
      const strategy = new ForwarderGeneratorStrategy(
        FirefoxRelay,
        restClient,
        i18nService,
        encryptService,
        keyService,
        stateProvider,
      );

      const result = await strategy.generate({ website: null });

      expect(result).toEqual("jdoe@example.com");
    });

    it("issues a remote procedure request to look up the account id before creating the forwarding address", async () => {
      restClient.fetchJson.mockResolvedValue("some account id");
      restClient.fetchJson.mockResolvedValue("jdoe@example.com");
      const strategy = new ForwarderGeneratorStrategy(
        Fastmail,
        restClient,
        i18nService,
        encryptService,
        keyService,
        stateProvider,
      );

      const result = await strategy.generate({ website: null, prefix: "", domain: "example.com" });

      expect(result).toEqual("jdoe@example.com");
    });
  });
});
