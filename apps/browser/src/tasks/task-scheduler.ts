import { CachedServices } from "../platform/background/service-factories/factory-options";

import { UploadEventsTask } from "./upload-events-tasks";

export function registerTasks() {
  const serviceCache: CachedServices = {};

  UploadEventsTask.run(serviceCache);
}
