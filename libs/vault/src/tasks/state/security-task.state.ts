import { Jsonify } from "type-fest";

import { SECURITY_TASKS_DISK, UserKeyDefinition } from "@bitwarden/common/platform/state";

import { SecurityTaskData } from "../models/security-task.data";

export const SECURITY_TASKS = UserKeyDefinition.array<SecurityTaskData>(
  SECURITY_TASKS_DISK,
  "securityTasks",
  {
    deserializer: (task: Jsonify<SecurityTaskData>) => SecurityTaskData.fromJSON(task),
    clearOn: ["logout", "lock"],
  },
);
