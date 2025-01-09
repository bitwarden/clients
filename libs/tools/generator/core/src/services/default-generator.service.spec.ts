import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, map, pipe } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
// FIXME: use index.ts imports once policy abstractions and models
// implement ADR-0002
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { SingleUserState } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { FakeSingleUserState, awaitAsync } from "../../../../../common/spec";
import { GeneratorStrategy, PolicyEvaluator } from "../abstractions";
import { PasswordGenerationOptions } from "../types";

import { DefaultGeneratorService } from "./default-generator.service";

function mockPolicyService(config?: { state?: BehaviorSubject<Policy[]> }) {
  const service = mock<PolicyService>();

  const stateValue = config?.state ?? new BehaviorSubject<Policy[]>([null]);
  service.getAll$.mockReturnValue(stateValue);

  return service;
}

function mockGeneratorStrategy(config?: {
  userState?: SingleUserState<any>;
  policy?: PolicyType;
  evaluator?: any;
  defaults?: any;
}) {
  const durableState =
    config?.userState ?? new FakeSingleUserState<PasswordGenerationOptions>(SomeUser);
  const strategy = mock<GeneratorStrategy<any, any>>({
    // intentionally arbitrary so that tests that need to check
    // whether they're used properly are guaranteed to test
    // the value from `config`.
    durableState: jest.fn(() => durableState),
    defaults$: jest.fn(() => new BehaviorSubject(config?.defaults)),
    policy: config?.policy ?? PolicyType.DisableSend,
    toEvaluator: jest.fn(() =>
      pipe(map(() => config?.evaluator ?? mock<PolicyEvaluator<any, any>>())),
    ),
  });

  return strategy;
}

const SomeUser = "some user" as UserId;
const AnotherUser = "another user" as UserId;

describe("Password generator service", () => {
  describe("options$", () => {
    it("should retrieve durable state from the service", () => {
      const policy = mockPolicyService();
      const userState = new FakeSingleUserState<PasswordGenerationOptions>(SomeUser);
      const strategy = mockGeneratorStrategy({ userState });
      const service = new DefaultGeneratorService(strategy, policy);

      const result = service.options$(SomeUser);

      expect(strategy.durableState).toHaveBeenCalledWith(SomeUser);
      expect(result).toBe(userState.state$);
    });
  });

  describe("defaults$", () => {
    it("should retrieve default state from the service", async () => {
      const policy = mockPolicyService();
      const defaults = {};
      const strategy = mockGeneratorStrategy({ defaults });
      const service = new DefaultGeneratorService(strategy, policy);

      const result = await firstValueFrom(service.defaults$(SomeUser));

      expect(strategy.defaults$).toHaveBeenCalledWith(SomeUser);
      expect(result).toBe(defaults);
    });
  });

  describe("saveOptions()", () => {
    it("should trigger an options$ update", async () => {
      const policy = mockPolicyService();
      const userState = new FakeSingleUserState<PasswordGenerationOptions>(SomeUser, { length: 9 });
      const strategy = mockGeneratorStrategy({ userState });
      const service = new DefaultGeneratorService(strategy, policy);

      await service.saveOptions(SomeUser, { length: 10 });
      await awaitAsync();
      const options = await firstValueFrom(service.options$(SomeUser));

      expect(strategy.durableState).toHaveBeenCalledWith(SomeUser);
      expect(options).toEqual({ length: 10 });
    });
  });

  describe("evaluator$", () => {
    it("should initialize the password generator policy", async () => {
      const policy = mockPolicyService();
      const strategy = mockGeneratorStrategy({ policy: PolicyType.PasswordGenerator });
      const service = new DefaultGeneratorService(strategy, policy);

      await firstValueFrom(service.evaluator$(SomeUser));

      expect(policy.getAll$).toHaveBeenCalledWith(PolicyType.PasswordGenerator, SomeUser);
    });

    it("should map the policy using the generation strategy", async () => {
      const policyService = mockPolicyService();
      const evaluator = mock<PolicyEvaluator<any, any>>();
      const strategy = mockGeneratorStrategy({ evaluator });
      const service = new DefaultGeneratorService(strategy, policyService);

      const policy = await firstValueFrom(service.evaluator$(SomeUser));

      expect(policy).toBe(evaluator);
    });

    it("should update the evaluator when the password generator policy changes", async () => {
      // set up dependencies
      const state = new BehaviorSubject<Policy[]>([null]);
      const policy = mockPolicyService({ state });
      const strategy = mockGeneratorStrategy();
      const service = new DefaultGeneratorService(strategy, policy);

      // model responses for the observable update. The map is called multiple times,
      // and the array shift ensures reference equality is maintained.
      const firstEvaluator = mock<PolicyEvaluator<any, any>>();
      const secondEvaluator = mock<PolicyEvaluator<any, any>>();
      const evaluators = [firstEvaluator, secondEvaluator];
      strategy.toEvaluator.mockReturnValueOnce(pipe(map(() => evaluators.shift())));

      // act
      const evaluator$ = service.evaluator$(SomeUser);
      const firstResult = await firstValueFrom(evaluator$);
      state.next([null]);
      const secondResult = await firstValueFrom(evaluator$);

      // assert
      expect(firstResult).toBe(firstEvaluator);
      expect(secondResult).toBe(secondEvaluator);
    });

    it("should cache the password generator policy", async () => {
      const policy = mockPolicyService();
      const strategy = mockGeneratorStrategy({ policy: PolicyType.PasswordGenerator });
      const service = new DefaultGeneratorService(strategy, policy);

      await firstValueFrom(service.evaluator$(SomeUser));
      await firstValueFrom(service.evaluator$(SomeUser));

      expect(policy.getAll$).toHaveBeenCalledTimes(1);
    });

    it("should cache the password generator policy for each user", async () => {
      const policy = mockPolicyService();
      const strategy = mockGeneratorStrategy({ policy: PolicyType.PasswordGenerator });
      const service = new DefaultGeneratorService(strategy, policy);

      await firstValueFrom(service.evaluator$(SomeUser));
      await firstValueFrom(service.evaluator$(AnotherUser));

      expect(policy.getAll$).toHaveBeenNthCalledWith(1, PolicyType.PasswordGenerator, SomeUser);
      expect(policy.getAll$).toHaveBeenNthCalledWith(2, PolicyType.PasswordGenerator, AnotherUser);
    });
  });

  describe("enforcePolicy()", () => {
    it("should evaluate the policy using the generation strategy", async () => {
      const policy = mockPolicyService();
      const evaluator = mock<PolicyEvaluator<any, any>>();
      const strategy = mockGeneratorStrategy({ evaluator });
      const service = new DefaultGeneratorService(strategy, policy);

      await service.enforcePolicy(SomeUser, {});

      expect(evaluator.applyPolicy).toHaveBeenCalled();
      expect(evaluator.sanitize).toHaveBeenCalled();
    });
  });

  describe("generate()", () => {
    it("should invoke the generation strategy", async () => {
      const strategy = mockGeneratorStrategy();
      const policy = mockPolicyService();
      const service = new DefaultGeneratorService(strategy, policy);

      await service.generate({});

      expect(strategy.generate).toHaveBeenCalled();
    });
  });
});
