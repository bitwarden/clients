import { MockProxy, any } from "jest-mock-extended";

import { MigrationHelper } from "../migration-helper";
import { mockMigrationHelper } from "../migration-helper.spec";

import {
  ANONYMOUS_APP_ID_KEY,
  APP_ID_KEY,
  AppIdMigrator,
} from "./33-move-app-id-to-state-providers";

function exampleJSON() {
  return {
    appId: "appId",
    anonymousAppId: "anonymousAppId",
    otherStuff: "otherStuff1",
  };
}

function missingAppIdJSON() {
  return {
    anonymousAppId: "anonymousAppId",
    otherStuff: "otherStuff1",
  };
}

function missingAnonymousAppIdJSON() {
  return {
    appId: "appId",
    otherStuff: "otherStuff1",
  };
}

function missingBothJSON() {
  return {
    otherStuff: "otherStuff1",
  };
}

function rollbackJSON() {
  return {
    global_applicationId_appId: "appId",
    global_applicationId_anonymousAppId: "anonymousAppId",
    otherStuff: "otherStuff1",
  };
}

describe("AppIdMigrator", () => {
  let helper: MockProxy<MigrationHelper>;
  let sut: AppIdMigrator;

  describe("migrate with both ids", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(exampleJSON(), 32);
      sut = new AppIdMigrator(32, 33);
    });

    it("removes appId", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("appId", null);
    });

    it("removes anonymousAppId", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("anonymousAppId", null);
    });

    it("sets appId", async () => {
      await sut.migrate(helper);
      expect(helper.setToGlobal).toHaveBeenCalledWith(APP_ID_KEY, "appId");
    });

    it("sets anonymousAppId", async () => {
      await sut.migrate(helper);
      expect(helper.setToGlobal).toHaveBeenCalledWith(ANONYMOUS_APP_ID_KEY, "anonymousAppId");
    });
  });

  describe("migrate with missing appId", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(missingAppIdJSON(), 32);
      sut = new AppIdMigrator(32, 33);
    });

    it("does not set appId", async () => {
      await sut.migrate(helper);
      expect(helper.setToGlobal).not.toHaveBeenCalledWith(APP_ID_KEY, any());
    });

    it("removes anonymousAppId", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("anonymousAppId", null);
    });

    it("does not set appId", async () => {
      await sut.migrate(helper);
      expect(helper.setToGlobal).not.toHaveBeenCalledWith(APP_ID_KEY, any());
    });

    it("sets anonymousAppId", async () => {
      await sut.migrate(helper);
      expect(helper.setToGlobal).toHaveBeenCalledWith(ANONYMOUS_APP_ID_KEY, "anonymousAppId");
    });
  });

  describe("migrate with missing anonymousAppId", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(missingAnonymousAppIdJSON(), 32);
      sut = new AppIdMigrator(32, 33);
    });

    it("sets appId", async () => {
      await sut.migrate(helper);
      expect(helper.setToGlobal).toHaveBeenCalledWith(APP_ID_KEY, "appId");
    });

    it("does not set anonymousAppId", async () => {
      await sut.migrate(helper);
      expect(helper.setToGlobal).not.toHaveBeenCalledWith(ANONYMOUS_APP_ID_KEY, any());
    });

    it("removes appId", async () => {
      await sut.migrate(helper);
      expect(helper.set).toHaveBeenCalledWith("appId", null);
    });

    it("does not remove anonymousAppId", async () => {
      await sut.migrate(helper);
      expect(helper.set).not.toHaveBeenCalledWith("anonymousAppId", any());
    });
  });

  describe("migrate with missing appId and anonymousAppId", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(missingBothJSON(), 32);
      sut = new AppIdMigrator(32, 33);
    });

    it("does not set appId", async () => {
      await sut.migrate(helper);
      expect(helper.setToGlobal).not.toHaveBeenCalledWith(APP_ID_KEY, any());
    });

    it("does not set anonymousAppId", async () => {
      await sut.migrate(helper);
      expect(helper.setToGlobal).not.toHaveBeenCalledWith(ANONYMOUS_APP_ID_KEY, any());
    });

    it("does not remove appId", async () => {
      await sut.migrate(helper);
      expect(helper.set).not.toHaveBeenCalledWith("appId", any());
    });

    it("does not remove anonymousAppId", async () => {
      await sut.migrate(helper);
      expect(helper.set).not.toHaveBeenCalledWith("anonymousAppId", any());
    });
  });

  describe("rollback with both Ids", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(rollbackJSON(), 33);
      sut = new AppIdMigrator(32, 33);
    });

    it("removes appId", async () => {
      await sut.rollback(helper);
      expect(helper.setToGlobal).toHaveBeenCalledWith(APP_ID_KEY, null);
    });

    it("sets appId", async () => {
      await sut.rollback(helper);
      expect(helper.set).toHaveBeenCalledWith("appId", "appId");
    });

    it("removes anonymousAppId", async () => {
      await sut.rollback(helper);
      expect(helper.setToGlobal).toHaveBeenCalledWith(ANONYMOUS_APP_ID_KEY, null);
    });

    it("sets anonymousAppId", async () => {
      await sut.rollback(helper);
      expect(helper.set).toHaveBeenCalledWith("anonymousAppId", "anonymousAppId");
    });
  });

  describe("rollback missing both Ids", () => {
    beforeEach(() => {
      helper = mockMigrationHelper(missingBothJSON(), 33);
      sut = new AppIdMigrator(32, 33);
    });

    it("does not set appId for providers", async () => {
      await sut.rollback(helper);
      expect(helper.setToGlobal).not.toHaveBeenCalledWith(APP_ID_KEY, any());
    });

    it("does not set anonymousAppId for providers", async () => {
      await sut.rollback(helper);
      expect(helper.setToGlobal).not.toHaveBeenCalledWith(ANONYMOUS_APP_ID_KEY, any());
    });

    it("does not revert appId", async () => {
      await sut.rollback(helper);
      expect(helper.set).not.toHaveBeenCalledWith("appId", any());
    });

    it("does not revert anonymousAppId", async () => {
      await sut.rollback(helper);
      expect(helper.set).not.toHaveBeenCalledWith("anonymousAppId", any());
    });
  });
});
