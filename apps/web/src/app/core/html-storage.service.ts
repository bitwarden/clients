// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

import {
  AbstractStorageService,
  StorageUpdate,
} from "@bitwarden/common/platform/abstractions/storage.service";
import { HtmlStorageLocation } from "@bitwarden/common/platform/enums";
import { StorageOptions } from "@bitwarden/common/platform/models/domain/storage-options";

@Injectable()
export class HtmlStorageService implements AbstractStorageService {
  private updatesSubject = new Subject<StorageUpdate>();

  get defaultOptions(): StorageOptions {
    return { htmlStorageLocation: HtmlStorageLocation.Session };
  }

  get valuesRequireDeserialization(): boolean {
    return true;
  }
  updates$;

  constructor() {
    this.updates$ = this.updatesSubject.asObservable();
  }

  get<T>(key: string, options: StorageOptions = this.defaultOptions): Promise<T> {
    let json: string = null;
    switch (options.htmlStorageLocation) {
      case HtmlStorageLocation.Local:
        json = window.localStorage.getItem(key);
        break;
      case HtmlStorageLocation.Session:
      default:
        json = window.sessionStorage.getItem(key);
        break;
    }

    if (json != null) {
      const obj = JSON.parse(json);
      return Promise.resolve(obj as T);
    }
    return Promise.resolve(null);
  }

  async has(key: string, options: StorageOptions = this.defaultOptions): Promise<boolean> {
    return (await this.get(key, options)) != null;
  }

  save(key: string, obj: any, options: StorageOptions = this.defaultOptions): Promise<any> {
    if (obj == null) {
      return this.remove(key, options);
    }

    if (obj instanceof Set) {
      obj = Array.from(obj);
    }

    const json = JSON.stringify(obj);
    switch (options.htmlStorageLocation) {
      case HtmlStorageLocation.Local:
        window.localStorage.setItem(key, json);
        break;
      case HtmlStorageLocation.Session:
      default:
        window.sessionStorage.setItem(key, json);
        break;
    }
    this.updatesSubject.next({ key, updateType: "save" });
    return Promise.resolve();
  }

  remove(key: string, options: StorageOptions = this.defaultOptions): Promise<any> {
    switch (options.htmlStorageLocation) {
      case HtmlStorageLocation.Local:
        window.localStorage.removeItem(key);
        break;
      case HtmlStorageLocation.Session:
      default:
        window.sessionStorage.removeItem(key);
        break;
    }
    this.updatesSubject.next({ key, updateType: "remove" });
    return Promise.resolve();
  }
}
