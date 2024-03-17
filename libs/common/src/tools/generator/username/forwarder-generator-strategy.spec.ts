import { mock } from "jest-mock-extended";

import { FakeStateProvider, mockAccountServiceWith } from "../../../../spec";
import { CryptoService } from "../../../platform/abstractions/crypto.service";
import { EncryptService } from "../../../platform/abstractions/encrypt.service";
import { StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { DefaultPolicyEvaluator } from "../default-policy-evaluator";
import { DUCK_DUCK_GO_FORWARDER } from "../key-definitions";
import { SecretState } from "../state/secret-state";

import { ForwarderGeneratorStrategy } from "./forwarder-generator-strategy";
import { ApiOptions } from "./options/forwarder-options";

class TestForwarder extends ForwarderGeneratorStrategy<ApiOptions> {
  constructor(
    encryptService: EncryptService,
    keyService: CryptoService,
    stateProvider: StateProvider,
  ) {
    super(encryptService, keyService, stateProvider);
  }

  get key() {
    // arbitrary.
    return DUCK_DUCK_GO_FORWARDER;
  }
}

const SomeUser = "some user" as UserId;
const AnotherUser = "another user" as UserId;

describe("ForwarderGeneratorStrategy", () => {
  const encryptService = mock<EncryptService>();
  const keyService = mock<CryptoService>();
  const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));

  describe("durableState", () => {
    it("constructs a secret state", () => {
      const strategy = new TestForwarder(encryptService, keyService, stateProvider);

      const result = strategy.durableState(SomeUser);

      expect(result).toBeInstanceOf(SecretState);
    });

    it("returns the same secret state for a single user", () => {
      const strategy = new TestForwarder(encryptService, keyService, stateProvider);

      const firstResult = strategy.durableState(SomeUser);
      const secondResult = strategy.durableState(SomeUser);

      expect(firstResult).toBe(secondResult);
    });

    it("returns a different secret state for a different user", () => {
      const strategy = new TestForwarder(encryptService, keyService, stateProvider);

      const firstResult = strategy.durableState(SomeUser);
      const secondResult = strategy.durableState(AnotherUser);

      expect(firstResult).not.toBe(secondResult);
    });
  });

  it("evaluator returns the default policy evaluator", () => {
    const strategy = new TestForwarder(null, null, null);

    const result = strategy.evaluator(null);

    expect(result).toBeInstanceOf(DefaultPolicyEvaluator);
  });
});
