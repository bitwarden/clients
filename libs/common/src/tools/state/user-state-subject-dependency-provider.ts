import { Jsonify } from "type-fest";

import { StateProvider } from "../../platform/state";
import { LegacyEncryptorProvider } from "../cryptography/legacy-encryptor-provider";

export abstract class UserStateSubjectDependencyProvider {
  abstract encryptor: LegacyEncryptorProvider;
  abstract state: StateProvider;
  abstract log: <Context>(_context: Jsonify<Context>) => SemanticLogger;
}

export function disabledSemanticLoggerProvider<Context>(
  _context: Jsonify<Context>,
): SemanticLogger {
  return new DisabledSemanticLogger();
}

export function consoleSemanticLoggerProvider<Context>(context: Jsonify<Context>): SemanticLogger {
  return new ConsoleSemanticLogger(context);
}

export interface SemanticLogger {
  debug<T>(content: Jsonify<T>, message?: string): void;

  info<T>(content: Jsonify<T>, message?: string): void;

  warn<T>(content: Jsonify<T>, message?: string): void;

  error<T>(content: Jsonify<T>, message?: string): void;

  panic<T>(content: Jsonify<T>, message?: string): void;
}

export class DisabledSemanticLogger implements SemanticLogger {
  debug<T>(_content: Jsonify<T>, _message?: string): void {}

  info<T>(_content: Jsonify<T>, _message?: string): void {}

  warn<T>(_content: Jsonify<T>, _message?: string): void {}

  error<T>(_content: Jsonify<T>, _message?: string): void {}

  panic<T>(_content: Jsonify<T>, message?: string): void {
    throw new Error(message);
  }
}

const DEBUG = true;

export class ConsoleSemanticLogger<Context> implements SemanticLogger {
  constructor(context: Jsonify<Context>) {
    this.context = context && typeof context === "object" ? context : {};
  }

  readonly context: object;

  debug<T>(content: Jsonify<T>, message?: string): void {
    if (DEBUG === true) {
      this.log(content, "debug", message);
    }
  }

  info<T>(content: Jsonify<T>, message?: string): void {
    this.log(content, "info", message);
  }

  warn<T>(content: Jsonify<T>, message?: string): void {
    this.log(content, "warn", message);
  }

  error<T>(content: Jsonify<T>, message?: string): void {
    this.log(content, "error", message);
  }

  panic<T>(content: Jsonify<T>, message?: string): void {
    this.log(content, "error", message);
    throw new Error(message);
  }

  private log<T>(
    content: Jsonify<T>,
    level: "debug" | "info" | "warn" | "error",
    message?: string,
  ) {
    const log = {
      ...this.context,
      message,
      content: content ?? undefined,
      level,
    };

    if (typeof content == "string" && !message) {
      log.message = content;
      delete log.content;
    }

    // eslint-disable-next-line no-console -- this is a *console* logger
    console[level === "debug" ? "log" : level](log);
  }
}
