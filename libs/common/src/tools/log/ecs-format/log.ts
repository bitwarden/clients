import { EcsFormat } from "./core";

export type LogFormat = EcsFormat & {
  /** Log metadata */
  log: {
    /** original log level of the event */
    level: "debug" | "info" | "warn" | "error",

    /** source of the event; this is usually a type name */
    logger: string,

    // FIXME: if it becomes possible to include line/file numbers,
    // add the origin fields from here:
    //   https://www.elastic.co/guide/en/ecs/current/ecs-log.html
  }
}
