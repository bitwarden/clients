import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
// FIXME: use index.ts imports once policy abstractions and models
// implement ADR-0002
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { UserId } from "@bitwarden/common/types/guid";

import { FakeStateProvider, mockAccountServiceWith } from "../../../../../common/spec";

import { GENERATOR_SETTINGS } from "./key-definitions";

import {
  GeneratorNavigationEvaluator,
  DefaultGeneratorNavigationService,
  DefaultGeneratorNavigation,
} from ".";

const SomeUser = "some user" as UserId;

describe("DefaultGeneratorNavigationService", () => {
  describe("options$", () => {
    it("emits options", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const settings = { type: "password" as const };
      await stateProvider.setUserState(GENERATOR_SETTINGS, settings, SomeUser);
      const navigation = new DefaultGeneratorNavigationService(stateProvider, null);

      const result = await firstValueFrom(navigation.options$(SomeUser));

      expect(result).toEqual(settings);
    });
  });

  describe("defaults$", () => {
    it("emits default options", async () => {
      const navigation = new DefaultGeneratorNavigationService(null, null);

      const result = await firstValueFrom(navigation.defaults$(SomeUser));

      expect(result).toEqual(DefaultGeneratorNavigation);
    });
  });

  describe("evaluator$", () => {
    it("emits a GeneratorNavigationEvaluator", async () => {
      const policyService = mock<PolicyService>({
        getAll$() {
          return of([]);
        },
      });
      const navigation = new DefaultGeneratorNavigationService(null, policyService);

      const result = await firstValueFrom(navigation.evaluator$(SomeUser));

      expect(result).toBeInstanceOf(GeneratorNavigationEvaluator);
    });
  });

  describe("enforcePolicy", () => {
    it("applies policy", async () => {
      const policyService = mock<PolicyService>({
        getAll$(_type: PolicyType, _user: UserId) {
          return of([
            new Policy({
              id: "" as any,
              organizationId: "" as any,
              enabled: true,
              type: PolicyType.PasswordGenerator,
              data: { overridePasswordType: "password" },
            }),
          ]);
        },
      });
      const navigation = new DefaultGeneratorNavigationService(null, policyService);
      const options = {};

      const result = await navigation.enforcePolicy(SomeUser, options);

      expect(result).toMatchObject({ type: "password" });
    });
  });

  describe("saveOptions", () => {
    it("updates options$", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const navigation = new DefaultGeneratorNavigationService(stateProvider, null);
      const settings = { type: "password" as const };

      await navigation.saveOptions(SomeUser, settings);
      const result = await firstValueFrom(navigation.options$(SomeUser));

      expect(result).toEqual(settings);
    });
  });
});
