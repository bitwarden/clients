import {
  AbstractStorageService,
  StorageUpdate,
} from "@bitwarden/common/platform/abstractions/storage.service";

type MemoryStoragePortMessage = {
  id?: string;
  key?: string;
  /**
   * We allow sending a string[] array since it is JSON safe and StorageUpdate since it's
   * a simple object with just two properties that are strings. Everything else is expected to
   * be JSON-ified.
   */
  data: string | string[] | StorageUpdate;
  originator: "foreground" | "background";
  action?:
    | keyof Pick<AbstractStorageService, "get" | "has" | "save" | "remove">
    | "subject_update"
    | "initialization";
};
