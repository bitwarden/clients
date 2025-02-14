import { EcsFormat } from "./core";

export type ErrorFormat = EcsFormat & {
  /** Error indicators collected by the provider */
  error: {
    /** content from the message field of the error */
    message: string,

    /** content from the error's stack trace */
    stack_trace: string,

    /** the type of the error, for example the error's class name */
    type: string
  },
};
