// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as fs from "fs";
import * as path from "path";

import { LowSync } from "lowdb";
import { JSONFileSync } from "lowdb/node";
import * as lock from "proper-lockfile";
import { OperationOptions } from "retry";
import { Subject } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  AbstractStorageService,
  StorageUpdate,
} from "@bitwarden/common/platform/abstractions/storage.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { NodeUtils } from "@bitwarden/node/node-utils";

type LowdbData = Record<string, unknown>;

const retries: OperationOptions = {
  retries: 50,
  minTimeout: 100,
  maxTimeout: 250,
  factor: 2,
};

export class LowdbStorageService implements AbstractStorageService {
  protected dataFilePath: string;
  private db: LowSync<LowdbData>;
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

  async init() {
    if (this.ready) {
      return;
    }

    this.logService.info("Initializing lowdb storage service.");
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
        fs.writeFileSync(this.dataFilePath, "{}", { mode: 0o600 });
        fs.chmodSync(this.dataFilePath, 0o600);
        this.logService.info(`Created data file "${this.dataFilePath}" with chmod 600.`);
      } else {
        this.logService.info(`db file "${this.dataFilePath}" already exists; using existing db`);
      }
    }

    const adapter = new JSONFileSync<LowdbData>(this.dataFilePath);
    this.db = new LowSync<LowdbData>(adapter, {} as LowdbData);

    try {
      this.logService.info("Loading lowdb data.");
      await this.lockDbFile(() => {
        this.db.read();
      });
      this.logService.info("Successfully loaded lowdb data.");
    } catch (e) {
      if (e instanceof SyntaxError) {
        this.logService.warning(`Error parsing lowdb data, "${e.message}"; emptying data file.`);
        if (fs.existsSync(this.dataFilePath)) {
          const backupPath = this.dataFilePath + ".bak";
          this.logService.warning(`Writing backup of data file to ${backupPath}`);
          try {
            fs.copyFileSync(this.dataFilePath, backupPath);
          } catch (copyErr) {
            this.logService.warning(
              `Error while creating data file backup, "${(copyErr as Error).message}". No backup may have been created.`,
            );
          }
        }
        fs.writeFileSync(this.dataFilePath, "{}");
        this.db.data = {} as LowdbData;
      } else {
        this.logService.error(`Error loading lowdb data, "${(e as Error).message}".`);
        throw e;
      }
    }

    if (this.defaults != null) {
      await this.lockDbFile(() => {
        this.logService.info("Writing defaults.");
        this.db.data = { ...this.defaults, ...this.db.data };
        this.db.write();
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
      const val = this.db.data?.[key];
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
      this.db.data[key] = obj;
      this.db.write();
      this.updatesSubject.next({ key, updateType: "save" });
      this.logService.debug(`Successfully wrote ${key} to db`);
    });
  }

  async remove(key: string): Promise<void> {
    await this.waitForReady();
    return this.lockDbFile(() => {
      this.readForNoCache();
      delete this.db.data[key];
      this.db.write();
      this.updatesSubject.next({ key, updateType: "remove" });
      this.logService.debug(`Successfully removed ${key} from db`);
    });
  }

  protected async lockDbFile<T>(action: () => Promise<T> | T): Promise<T> {
    if (this.requireLock && !Utils.isNullOrWhitespace(this.dataFilePath)) {
      this.logService.info("acquiring db file lock");
      const release = await lock.lock(this.dataFilePath, { retries: retries });
      try {
        return await action();
      } finally {
        await release();
      }
    } else {
      return await action();
    }
  }

  private readForNoCache(): void {
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
