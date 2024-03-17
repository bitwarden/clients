/**
 * include structuredClone in test environment.
 * @jest-environment ../../../../shared/test.environment.ts
 */

import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { FakeSingleUserState, awaitAsync } from "../../../spec";
import { PolicyService } from "../../admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "../../admin-console/enums";
// FIXME: use index.ts imports once policy abstractions and models
// implement ADR-0002
import { Policy } from "../../admin-console/models/domain/policy";
import { SingleUserState } from "../../platform/state";
import { UserId } from "../../types/guid";

import { GeneratorStrategy, PolicyEvaluator } from "./abstractions";
import { PasswordGenerationOptions } from "./password";

import { DefaultGeneratorService } from ".";

function mockPolicyService(config?: { state?: BehaviorSubject<Policy> }) {
  const service = mock<PolicyService>();

  // FIXME: swap out the mock return value when `getAll$` becomes available
  const stateValue = config?.state ?? new BehaviorSubject<Policy>(null);
  service.get$.mockReturnValue(stateValue);

  // const stateValue = config?.state ?? new BehaviorSubject<Policy[]>(null);
  // service.getAll$.mockReturnValue(stateValue);

  return service;
}

function mockGeneratorStrategy(config?: {
  userState?: SingleUserState<any>;
  policy?: PolicyType;
  evaluator?: any;
}) {
  const durableState =
    config?.userState ?? new FakeSingleUserState<PasswordGenerationOptions>(SomeUser);
  const strategy = mock<GeneratorStrategy<any, any>>({
    // intentionally arbitrary so that tests that need to check
    // whether they're used properly are guaranteed to test
    // the value from `config`.
    durableState: jest.fn(() => durableState),
    policy: config?.policy ?? PolicyType.DisableSend,
    evaluator: jest.fn(() => config?.evaluator ?? mock<PolicyEvaluator<any, any>>()),
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

      // FIXME: swap out the expect when `getAll$` becomes available
      expect(policy.get$).toHaveBeenCalledWith(PolicyType.PasswordGenerator);
      //expect(policy.getAll$).toHaveBeenCalledWith(PolicyType.PasswordGenerator, SomeUser);
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
      const state = new BehaviorSubject<Policy>(null);
      const policy = mockPolicyService({ state });
      const strategy = mockGeneratorStrategy();
      const service = new DefaultGeneratorService(strategy, policy);

      // model responses for the observable update
      const firstEvaluator = mock<PolicyEvaluator<any, any>>();
      strategy.evaluator.mockReturnValueOnce(firstEvaluator);
      const secondEvaluator = mock<PolicyEvaluator<any, any>>();
      strategy.evaluator.mockReturnValueOnce(secondEvaluator);

      // act
      const evaluator$ = service.evaluator$(SomeUser);
      const firstResult = await firstValueFrom(evaluator$);
      state.next(null);
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

      // FIXME: swap out the expect when `getAll$` becomes available
      expect(policy.get$).toHaveBeenCalledTimes(1);
      //expect(policy.getAll$).toHaveBeenCalledTimes(1);
    });

    it("should cache the password generator policy for each user", async () => {
      const policy = mockPolicyService();
      const strategy = mockGeneratorStrategy({ policy: PolicyType.PasswordGenerator });
      const service = new DefaultGeneratorService(strategy, policy);

      await firstValueFrom(service.evaluator$(SomeUser));
      await firstValueFrom(service.evaluator$(AnotherUser));

      // FIXME: enable this test when `getAll$` becomes available
      // expect(policy.getAll$).toHaveBeenNthCalledWith(1, PolicyType.PasswordGenerator, SomeUser);
      // expect(policy.getAll$).toHaveBeenNthCalledWith(2, PolicyType.PasswordGenerator, AnotherUser);
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
