// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as fs from "fs";
import * as path from "path";

import * as lowdb from "lowdb";
import * as FileSync from "lowdb/adapters/FileSync";
import * as lock from "proper-lockfile";
import { OperationOptions } from "retry";
import { Subject } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  AbstractStorageService,
  StorageUpdate,
} from "@bitwarden/common/platform/abstractions/storage.service";
import { sequentialize } from "@bitwarden/common/platform/misc/sequentialize";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { NodeUtils } from "@bitwarden/node/node-utils";

const retries: OperationOptions = {
  retries: 50,
  minTimeout: 100,
  maxTimeout: 250,
  factor: 2,
};

export class LowdbStorageService implements AbstractStorageService {
  protected dataFilePath: string;
  private db: lowdb.LowdbSync<any>;
  private defaults: any;
  private ready = false;
  private updatesSubject = new Subject<StorageUpdate>();
  updates$;

  constructor(
    protected logService: LogService,
    defaults?: any,
    private dir?: string,
    private allowCache = false,
    private requireLock = false,
  ) {
    this.defaults = defaults;
    this.updates$ = this.updatesSubject.asObservable();
  }

  @sequentialize(() => "lowdbStorageInit")
  async init() {
    if (this.ready) {
      return;
    }

    this.logService.info("Initializing lowdb storage service.");
    let adapter: lowdb.AdapterSync<any>;
    if (Utils.isNode && this.dir != null) {
      if (!fs.existsSync(this.dir)) {
        this.logService.warning(`Could not find dir, "${this.dir}"; creating it instead.`);
        NodeUtils.mkdirpSync(this.dir, "700");
        this.logService.info(`Created dir "${this.dir}".`);
      }
      this.dataFilePath = path.join(this.dir, "data.json");
      if (!fs.existsSync(this.dataFilePath)) {
        this.logService.warning(
          `Could not find data file, "${this.dataFilePath}"; creating it instead.`,
        );
        fs.writeFileSync(this.dataFilePath, "", { mode: 0o600 });
        fs.chmodSync(this.dataFilePath, 0o600);
        this.logService.info(`Created data file "${this.dataFilePath}" with chmod 600.`);
      } else {
        this.logService.info(`db file "${this.dataFilePath} already exists"; using existing db`);
      }
      await this.lockDbFile(() => {
        adapter = new FileSync(this.dataFilePath);
      });
    }
    try {
      this.logService.info("Attempting to create lowdb storage adapter.");
      this.db = lowdb(adapter);
      this.logService.info("Successfully created lowdb storage adapter.");
    } catch (e) {
      if (e instanceof SyntaxError) {
        this.logService.warning(
          `Error creating lowdb storage adapter, "${e.message}"; emptying data file.`,
        );
        if (fs.existsSync(this.dataFilePath)) {
          const backupPath = this.dataFilePath + ".bak";
          this.logService.warning(`Writing backup of data file to ${backupPath}`);
          await fs.copyFile(this.dataFilePath, backupPath, () => {
            this.logService.warning(
              `Error while creating data file backup, "${e.message}". No backup may have been created.`,
            );
          });
        }
        adapter.write({});
        this.db = lowdb(adapter);
      } else {
        this.logService.error(`Error creating lowdb storage adapter, "${e.message}".`);
        throw e;
      }
    }

    if (this.defaults != null) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.lockDbFile(() => {
        this.logService.info("Writing defaults.");
        this.readForNoCache();
        this.db.defaults(this.defaults).write();
        this.logService.info("Successfully wrote defaults to db.");
      });
    }

    this.ready = true;
  }

  get valuesRequireDeserialization(): boolean {
    return true;
  }

  async get<T>(key: string): Promise<T> {
    await this.waitForReady();
    return this.lockDbFile(() => {
      this.readForNoCache();
      const val = this.db.get(key).value();
      this.logService.debug(`Successfully read ${key} from db`);
      if (val == null) {
        return null;
      }
      return val as T;
    });
  }

  has(key: string): Promise<boolean> {
    return this.get(key).then((v) => v != null);
  }

  async save(key: string, obj: any): Promise<void> {
    await this.waitForReady();
    return this.lockDbFile(() => {
      this.readForNoCache();
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.db.set(key, obj).write();
      this.updatesSubject.next({ key, updateType: "save" });
      this.logService.debug(`Successfully wrote ${key} to db`);
      return;
    });
  }

  async remove(key: string): Promise<void> {
    await this.waitForReady();
    return this.lockDbFile(() => {
      this.readForNoCache();
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.db.unset(key).write();
      this.updatesSubject.next({ key, updateType: "remove" });
      this.logService.debug(`Successfully removed ${key} from db`);
      return;
    });
  }

  protected async lockDbFile<T>(action: () => T): Promise<T> {
    if (this.requireLock && !Utils.isNullOrWhitespace(this.dataFilePath)) {
      this.logService.info("acquiring db file lock");
      return await lock.lock(this.dataFilePath, { retries: retries }).then((release) => {
        try {
          return action();
        } finally {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          release();
        }
      });
    } else {
      return action();
    }
  }

  private readForNoCache() {
    if (!this.allowCache) {
      this.db.read();
    }
  }

  private async waitForReady() {
    if (!this.ready) {
      await this.init();
    }
  }
}
