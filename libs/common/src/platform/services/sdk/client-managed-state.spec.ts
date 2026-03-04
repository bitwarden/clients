import { firstValueFrom } from "rxjs";

import { newGuid } from "@bitwarden/guid";

import { FakeStateProvider, mockAccountServiceWith } from "../../../../spec";
import { UserId } from "../../../types/guid";
import { StateDefinition, UserKeyDefinition } from "../../state";

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
});
