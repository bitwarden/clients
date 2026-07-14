import { BehaviorSubject, firstValueFrom } from "rxjs";

import { newGuid } from "@bitwarden/guid";

import { FakeStateProvider, mockAccountServiceWith } from "../../../../spec";
import { UserId } from "../../../types/guid";
import { StateDefinition, StateProvider, UserKeyDefinition } from "../../state";

import { RepositoryRecord, SdkRecordMapper } from "./client-managed-state";

type ClientType = string;
type SdkType = { value: string };

const TEST_STATE = new StateDefinition("test", "disk");
const TEST_KEY = new UserKeyDefinition<Record<string, ClientType>>(TEST_STATE, "testKey", {
  deserializer: (data) => data,
  clearOn: ["logout"],
});

function createMapper(): SdkRecordMapper<ClientType, SdkType> {
  return {
    userKeyDefinition: () => TEST_KEY,
    toSdk: (value: ClientType) => ({ value }),
    fromSdk: (sdk: SdkType) => sdk.value,
  };
}

describe("RepositoryRecord", () => {
  let stateProvider: FakeStateProvider;
  let userId: UserId;
  let mapper: SdkRecordMapper<ClientType, SdkType>;
  let repo: RepositoryRecord<ClientType, SdkType>;
  beforeEach(() => {
    userId = newGuid() as UserId;
    const accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);
    mapper = createMapper();
    repo = new RepositoryRecord(userId, stateProvider, mapper);
  });

  async function setState(record: Record<string, ClientType> | null) {
    await stateProvider.setUserState(TEST_KEY, record, userId);
  }

  async function getState(): Promise<Record<string, ClientType> | null> {
    const userState = stateProvider.getUser(userId, TEST_KEY);
    return await firstValueFrom(userState.state$);
  }

  describe("get", () => {
    it("returns null when state is empty", async () => {
      await setState({});

      const result = await repo.get("id-1");

      expect(result).toBeNull();
    });

    it("returns null for missing id", async () => {
      await setState({ "id-1": "value-1" });

      const result = await repo.get("id-2");

      expect(result).toBeNull();
    });

    it("returns mapped value for existing id", async () => {
      await setState({ "id-1": "value-1" });

      const result = await repo.get("id-1");

      expect(result).toEqual({ value: "value-1" });
    });
  });

  describe("list", () => {
    it("returns empty array when state is empty", async () => {
      await setState({});

      const result = await repo.list();

      expect(result).toEqual([]);
    });

    it("returns all mapped values", async () => {
      await setState({ "id-1": "value-1", "id-2": "value-2" });

      const result = await repo.list();

      expect(result).toEqual([{ value: "value-1" }, { value: "value-2" }]);
    });
  });

  describe("set", () => {
    it("adds new item to empty state", async () => {
      await setState({});

      await repo.set("id-1", { value: "value-1" });

      expect(await getState()).toEqual({ "id-1": "value-1" });
    });

    it("adds new item preserving existing", async () => {
      await setState({ "id-1": "value-1" });

      await repo.set("id-2", { value: "value-2" });

      expect(await getState()).toEqual({ "id-1": "value-1", "id-2": "value-2" });
    });

    it("overwrites existing item", async () => {
      await setState({ "id-1": "value-1" });

      await repo.set("id-1", { value: "updated" });

      expect(await getState()).toEqual({ "id-1": "updated" });
    });

    it("handles null initial state", async () => {
      await setState(null);

      await repo.set("id-1", { value: "value-1" });

      expect(await getState()).toEqual({ "id-1": "value-1" });
    });
  });

  describe("setBulk", () => {
    it("adds multiple items at once", async () => {
      await setState({});

      await repo.setBulk([
        ["id-1", { value: "value-1" }],
        ["id-2", { value: "value-2" }],
      ]);

      expect(await getState()).toEqual({ "id-1": "value-1", "id-2": "value-2" });
    });

    it("merges with existing state", async () => {
      await setState({ "id-1": "value-1" });

      await repo.setBulk([
        ["id-2", { value: "value-2" }],
        ["id-3", { value: "value-3" }],
      ]);

      expect(await getState()).toEqual({
        "id-1": "value-1",
        "id-2": "value-2",
        "id-3": "value-3",
      });
    });

    it("handles null initial state", async () => {
      await setState(null);

      await repo.setBulk([["id-1", { value: "value-1" }]]);

      expect(await getState()).toEqual({ "id-1": "value-1" });
    });
  });

  describe("remove", () => {
    it("no-ops when state is null", async () => {
      await setState(null);

      await repo.remove("id-1");

      expect(await getState()).toBeNull();
    });

    it("no-ops when id not found", async () => {
      await setState({ "id-1": "value-1" });

      await repo.remove("id-2");

      expect(await getState()).toEqual({ "id-1": "value-1" });
    });

    it("removes existing item", async () => {
      await setState({ "id-1": "value-1", "id-2": "value-2" });

      await repo.remove("id-1");

      expect(await getState()).toEqual({ "id-2": "value-2" });
    });
  });

  describe("removeBulk", () => {
    it("no-ops when state is null", async () => {
      await setState(null);

      await repo.removeBulk(["id-1", "id-2"]);

      expect(await getState()).toBeNull();
    });

    it("no-ops when no keys match", async () => {
      await setState({ "id-1": "value-1" });

      await repo.removeBulk(["id-2", "id-3"]);

      expect(await getState()).toEqual({ "id-1": "value-1" });
    });

    it("removes multiple items", async () => {
      await setState({ "id-1": "value-1", "id-2": "value-2", "id-3": "value-3" });

      await repo.removeBulk(["id-1", "id-3"]);

      expect(await getState()).toEqual({ "id-2": "value-2" });
    });

    it("ignores non-existent keys", async () => {
      await setState({ "id-1": "value-1", "id-2": "value-2" });

      await repo.removeBulk(["id-1", "id-99"]);

      expect(await getState()).toEqual({ "id-2": "value-2" });
    });
  });

  describe("removeAll", () => {
    it("clears all items", async () => {
      await setState({ "id-1": "value-1", "id-2": "value-2" });

      await repo.removeAll();

      expect(await getState()).toEqual({});
    });

    it("works on empty state", async () => {
      await setState({});

      await repo.removeAll();

      expect(await getState()).toEqual({});
    });
  });

  describe("delayed state propagation", () => {
    const PROPAGATION_DELAY_MS = 200;

    type StateRecord = Record<string, ClientType> | null;

    /**
     * Creates a mock StateProvider where state$ emissions are delayed,
     * simulating async propagation (e.g. storage write + re-read).
     */
    function createDelayedStateProvider(initialState: StateRecord = null): StateProvider {
      let currentValue: StateRecord = initialState;
      const subject = new BehaviorSubject<StateRecord>(initialState);

      const delayedUserState = {
        state$: subject.asObservable(),
        update: jest.fn(async (fn: (state: StateRecord) => StateRecord) => {
          const newState = fn(currentValue);
          currentValue = newState;
          setTimeout(() => subject.next(newState), PROPAGATION_DELAY_MS);
          return newState;
        }),
      };

      return {
        getUser: () => delayedUserState,
      } as unknown as StateProvider;
    }

    /**
     * Retries an assertion until it passes or the timeout is reached.
     * Used to verify that optimistic writes eventually propagate.
     */
    async function expectEventually(
      assertion: () => Promise<void>,
      timeoutMs: number = PROPAGATION_DELAY_MS + 500,
    ): Promise<void> {
      const start = Date.now();
      let lastError: Error;
      do {
        try {
          await assertion();
          return;
        } catch (e) {
          lastError = e as Error;
          await new Promise((r) => setTimeout(r, 10));
        }
      } while (Date.now() - start < timeoutMs);
      throw lastError;
    }

    describe("set", () => {
      it("atomic: get returns updated value after set", async () => {
        const delayedProvider = createDelayedStateProvider();
        const atomicRepo = new RepositoryRecord(userId, delayedProvider, mapper);

        await atomicRepo.set("id-1", { value: "value-1" });
        const result = await atomicRepo.get("id-1");

        expect(result).toEqual({ value: "value-1" });
      });

      it("optimistic: get returns stale value after set, then eventually propagates", async () => {
        const delayedProvider = createDelayedStateProvider();
        const optimisticRepo = new RepositoryRecord(userId, delayedProvider, mapper, true);

        await optimisticRepo.set("id-1", { value: "value-1" });

        expect(await optimisticRepo.get("id-1")).toBeNull();

        await expectEventually(async () => {
          expect(await optimisticRepo.get("id-1")).toEqual({ value: "value-1" });
        });
      });

      it("atomic: get returns overwritten value after set", async () => {
        const delayedProvider = createDelayedStateProvider({ "id-1": "value-1" });
        const atomicRepo = new RepositoryRecord(userId, delayedProvider, mapper);

        await atomicRepo.set("id-1", { value: "value-2" });
        const result = await atomicRepo.get("id-1");

        expect(result).toEqual({ value: "value-2" });
      });

      it("optimistic: get returns previous value after overwrite, then eventually propagates", async () => {
        const delayedProvider = createDelayedStateProvider({ "id-1": "value-1" });
        const optimisticRepo = new RepositoryRecord(userId, delayedProvider, mapper, true);

        await optimisticRepo.set("id-1", { value: "value-2" });

        expect(await optimisticRepo.get("id-1")).toEqual({ value: "value-1" });

        await expectEventually(async () => {
          expect(await optimisticRepo.get("id-1")).toEqual({ value: "value-2" });
        });
      });
    });

    describe("setBulk", () => {
      it("atomic: get returns updated values after setBulk", async () => {
        const delayedProvider = createDelayedStateProvider();
        const atomicRepo = new RepositoryRecord(userId, delayedProvider, mapper);

        await atomicRepo.setBulk([
          ["id-1", { value: "value-1" }],
          ["id-2", { value: "value-2" }],
        ]);

        expect(await atomicRepo.get("id-1")).toEqual({ value: "value-1" });
        expect(await atomicRepo.get("id-2")).toEqual({ value: "value-2" });
      });

      it("optimistic: get returns stale values after setBulk, then eventually propagates", async () => {
        const delayedProvider = createDelayedStateProvider();
        const optimisticRepo = new RepositoryRecord(userId, delayedProvider, mapper, true);

        await optimisticRepo.setBulk([
          ["id-1", { value: "value-1" }],
          ["id-2", { value: "value-2" }],
        ]);

        expect(await optimisticRepo.get("id-1")).toBeNull();
        expect(await optimisticRepo.get("id-2")).toBeNull();

        await expectEventually(async () => {
          expect(await optimisticRepo.get("id-1")).toEqual({ value: "value-1" });
          expect(await optimisticRepo.get("id-2")).toEqual({ value: "value-2" });
        });
      });

      it("atomic: get returns overwritten values after setBulk", async () => {
        const delayedProvider = createDelayedStateProvider({
          "id-1": "value-1",
          "id-2": "value-2",
        });
        const atomicRepo = new RepositoryRecord(userId, delayedProvider, mapper);

        await atomicRepo.setBulk([
          ["id-1", { value: "updated-1" }],
          ["id-2", { value: "updated-2" }],
        ]);

        expect(await atomicRepo.get("id-1")).toEqual({ value: "updated-1" });
        expect(await atomicRepo.get("id-2")).toEqual({ value: "updated-2" });
      });

      it("optimistic: get returns previous values after overwrite, then eventually propagates", async () => {
        const delayedProvider = createDelayedStateProvider({
          "id-1": "value-1",
          "id-2": "value-2",
        });
        const optimisticRepo = new RepositoryRecord(userId, delayedProvider, mapper, true);

        await optimisticRepo.setBulk([
          ["id-1", { value: "updated-1" }],
          ["id-2", { value: "updated-2" }],
        ]);

        expect(await optimisticRepo.get("id-1")).toEqual({ value: "value-1" });
        expect(await optimisticRepo.get("id-2")).toEqual({ value: "value-2" });

        await expectEventually(async () => {
          expect(await optimisticRepo.get("id-1")).toEqual({ value: "updated-1" });
          expect(await optimisticRepo.get("id-2")).toEqual({ value: "updated-2" });
        });
      });
    });

    describe("remove", () => {
      const initialState = { "id-1": "value-1" };

      it("atomic: get returns null after remove", async () => {
        const delayedProvider = createDelayedStateProvider(initialState);
        const atomicRepo = new RepositoryRecord(userId, delayedProvider, mapper);

        await atomicRepo.remove("id-1");
        const result = await atomicRepo.get("id-1");

        expect(result).toBeNull();
      });

      it("optimistic: get returns stale value after remove, then eventually propagates", async () => {
        const delayedProvider = createDelayedStateProvider(initialState);
        const optimisticRepo = new RepositoryRecord(userId, delayedProvider, mapper, true);

        await optimisticRepo.remove("id-1");

        expect(await optimisticRepo.get("id-1")).toEqual({ value: "value-1" });

        await expectEventually(async () => {
          expect(await optimisticRepo.get("id-1")).toBeNull();
        });
      });
    });

    describe("removeBulk", () => {
      const initialState = { "id-1": "value-1", "id-2": "value-2" };

      it("atomic: get returns null after removeBulk", async () => {
        const delayedProvider = createDelayedStateProvider(initialState);
        const atomicRepo = new RepositoryRecord(userId, delayedProvider, mapper);

        await atomicRepo.removeBulk(["id-1", "id-2"]);

        expect(await atomicRepo.get("id-1")).toBeNull();
        expect(await atomicRepo.get("id-2")).toBeNull();
      });

      it("optimistic: get returns stale values after removeBulk, then eventually propagates", async () => {
        const delayedProvider = createDelayedStateProvider(initialState);
        const optimisticRepo = new RepositoryRecord(userId, delayedProvider, mapper, true);

        await optimisticRepo.removeBulk(["id-1", "id-2"]);

        expect(await optimisticRepo.get("id-1")).toEqual({ value: "value-1" });
        expect(await optimisticRepo.get("id-2")).toEqual({ value: "value-2" });

        await expectEventually(async () => {
          expect(await optimisticRepo.get("id-1")).toBeNull();
          expect(await optimisticRepo.get("id-2")).toBeNull();
        });
      });
    });

    describe("removeAll", () => {
      const initialState = { "id-1": "value-1", "id-2": "value-2" };

      it("atomic: list returns empty after removeAll", async () => {
        const delayedProvider = createDelayedStateProvider(initialState);
        const atomicRepo = new RepositoryRecord(userId, delayedProvider, mapper);

        await atomicRepo.removeAll();

        expect(await atomicRepo.list()).toEqual([]);
      });

      it("optimistic: list returns stale values after removeAll, then eventually propagates", async () => {
        const delayedProvider = createDelayedStateProvider(initialState);
        const optimisticRepo = new RepositoryRecord(userId, delayedProvider, mapper, true);

        await optimisticRepo.removeAll();

        expect(await optimisticRepo.list()).toEqual([{ value: "value-1" }, { value: "value-2" }]);

        await expectEventually(async () => {
          expect(await optimisticRepo.list()).toEqual([]);
        });
      });
    });
  });
});
