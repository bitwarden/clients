import { Jsonify } from "type-fest";

/** Semantic/structural logging component */
export interface SemanticLogger {
  /** Logs a message at debug priority.
   *  Debug messages are used for diagnostics, and are typically disabled
   *  in production builds.
   *  @param message - a message to record in the log's `message` field.
   */
  debug(message: string): void;

  // FIXME: replace Jsonify<T> parameter with structural logging schema type
  /** Logs the content at debug priority.
   *  Debug messages are used for diagnostics, and are typically disabled
   *  in production builds.
   *  @param content - JSON content included in the log's `content` field.
   *  @param message - a message to record in the log's `message` field.
   */
  debug<T>(content: Jsonify<T>, message?: string): void;

  /** combined signature for overloaded methods */
  debug<T>(content: Jsonify<T> | string, message?: string): void;

  /** Logs a message at informational priority.
   *  Information messages are used for status reports.
   *  @param message - a message to record in the log's `message` field.
   */
  info(message: string): void;

  /** Logs the content at informational priority.
   *  Information messages are used for status reports.
   *  @param content - JSON content included in the log's `content` field.
   *  @param message - a message to record in the log's `message` field.
   */
  info<T>(content: Jsonify<T>, message?: string): void;

  /** combined signature for overloaded methods */
  info<T>(content: Jsonify<T> | string, message?: string): void;

  /** Logs a message at warn priority.
   *  Warn messages are used to indicate a operation that may affect system
   *  stability occurred.
   *  @param message - a message to record in the log's `message` field.
   */
  warn(message: string): void;

  /** Logs the content at warn priority.
   *  Warn messages are used to indicate a operation that may affect system
   *  stability occurred.
   *  @param content - JSON content included in the log's `content` field.
   *  @param message - a message to record in the log's `message` field.
   */
  warn<T>(content: Jsonify<T>, message?: string): void;

  /** combined signature for overloaded methods */
  warn<T>(content: Jsonify<T> | string, message?: string): void;

  /** Logs a message at error priority.
   *  Error messages are used to indicate a operation that affects system
   *  stability occurred and the system was able to recover.
   *  @param message - a message to record in the log's `message` field.
   */
  error(message: string): void;

  /** Logs the content at debug priority.
   *  Error messages are used to indicate a operation that affects system
   *  stability occurred and the system was able to recover.
   *  @param content - JSON content included in the log's `content` field.
   *  @param message - a message to record in the log's `message` field.
   */
  error<T>(content: Jsonify<T>, message?: string): void;

  /** combined signature for overloaded methods */
  error<T>(content: Jsonify<T> | string, message?: string): void;

  /** Logs a message at panic priority and throws an error.
   *  Panic messages are used to indicate a operation that affects system
   *  stability occurred and the system cannot recover. Panic messages
   *  log an error and throw an `Error`.
   *  @param message - a message to record in the log's `message` field.
   */
  panic(message: string): never;

  /** Logs the content at debug priority and throws an error.
   *  Panic messages are used to indicate a operation that affects system
   *  stability occurred and the system cannot recover. Panic messages
   *  log an error and throw an `Error`.
   *  @param content - JSON content included in the log's `content` field.
   *  @param message - a message to record in the log's `message` field.
   */
  panic<T>(content: Jsonify<T>, message?: string): never;

  /** combined signature for overloaded methods */
  panic<T>(content: Jsonify<T> | string, message?: string): never;
}
