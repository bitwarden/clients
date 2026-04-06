import { mock } from "jest-mock-extended";

import { awaitAsync } from "../../../spec";
import { ClientType } from "../../enums";
import { CURRENT_VERSION } from "../../state-migrations";
import { MigrationBuilder } from "../../state-migrations/migration-builder";
import { LogService } from "../abstractions/log.service";
import { AbstractStorageService } from "../abstractions/storage.service";

import { MigrationBuilderService } from "./migration-builder.service";
import { MigrationRunner } from "./migration-runner";

describe("MigrationRunner", () => {
  const storage = mock<AbstractStorageService>();
  const logService = mock<LogService>();
  const migrationBuilderService = mock<MigrationBuilderService>();
  const mockMigrationBuilder = mock<MigrationBuilder>();

  migrationBuilderService.build.mockReturnValue(mockMigrationBuilder);

  const sut = new MigrationRunner(storage, logService, migrationBuilderService, ClientType.Web);

  describe("migrate", () => {
    it("should not run migrations if state is empty", async () => {
      storage.get.mockReturnValueOnce(null);
      await sut.run();
      expect(migrationBuilderService.build).not.toHaveBeenCalled();
    });

    it("should set to current version if state is empty", async () => {
      storage.get.mockReturnValueOnce(null);
      await sut.run();
      expect(storage.save).toHaveBeenCalledWith("stateVersion", CURRENT_VERSION);
    });

    it("should run migration if there is a stateVersion", async () => {
      storage.get.mockResolvedValueOnce(12);

      await sut.run();

      expect(mockMigrationBuilder.migrate).toHaveBeenCalled();
    });
  });

  describe("waitForCompletion", () => {
    it("should wait until stateVersion is current before completing", async () => {
      let stateVersion: number | null = null;

      storage.get.mockImplementation((key) => {
        if (key === "stateVersion") {
          return Promise.resolve(stateVersion);
        }
      });

      let promiseCompleted = false;

      const completionPromise = sut.waitForCompletion().then(() => (promiseCompleted = true));

      await awaitAsync(10);

      expect(promiseCompleted).toBe(false);

      stateVersion = CURRENT_VERSION;
      await completionPromise;
    });

    // Skipped for CI since this test takes a while to complete, remove `.skip` to test
    it.skip(
      "will complete after 8 second step wait if migrations still aren't complete",
      async () => {
        storage.get.mockImplementation((key) => {
          if (key === "stateVersion") {
            return Promise.resolve(null);
          }
        });

        let promiseCompleted = false;

        void sut.waitForCompletion().then(() => (promiseCompleted = true));

        await awaitAsync(2 + 4 + 8 + 16);

        expect(promiseCompleted).toBe(false);

        await awaitAsync(32 + 64 + 128 + 256);

        expect(promiseCompleted).toBe(false);

        await awaitAsync(512 + 1024 + 2048 + 4096);

        expect(promiseCompleted).toBe(false);

        const SKEW = 20;

        await awaitAsync(8192 + SKEW);

        expect(promiseCompleted).toBe(true);
      },
      // Have to combine all the steps into the timeout to get this to run
      2 + 4 + 8 + 16 + 32 + 64 + 128 + 256 + 512 + 1024 + 2048 + 4096 + 8192 + 100,
    );
  });
});
