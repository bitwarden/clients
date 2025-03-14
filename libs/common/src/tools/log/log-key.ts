// eslint-disable-next-line -- `StateDefinition` used as a type
import { StateDefinition } from "../../platform/state/state-definition";
import { Classifier } from "../state/classifier";

import { EcsFormat } from "./ecs-format";

export type LogKey<LogFormat extends EcsFormat, N extends number = 100> = {
  target: "log";
  format: "classified_circular_buffer";
  size: N;
  key: string;
  state: StateDefinition;
  cleanupDelayMs?: number;
  classifier: Classifier<LogFormat, unknown, unknown>;

  /** For encrypted outputs, determines how much padding is applied to
   *  encoded inputs. When this isn't specified, each frame is 32 bytes
   *  long.
   */
  frame?: number;
};
