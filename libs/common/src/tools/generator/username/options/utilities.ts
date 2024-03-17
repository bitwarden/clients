import { DefaultOptions, Forwarders } from "./constants";
import { ApiOptions, ForwarderId } from "./forwarder-options";
import { MaybeLeakedOptions, UsernameGeneratorOptions } from "./generator-options";

/** runs the callback on each forwarder configuration */
export function forAllForwarders<T>(
  options: UsernameGeneratorOptions,
  callback: (options: ApiOptions, id: ForwarderId) => T,
) {
  const results = [];
  for (const forwarder of Object.values(Forwarders).map((f) => f.id)) {
    const forwarderOptions = getForwarderOptions(forwarder, options);
    if (forwarderOptions) {
      results.push(callback(forwarderOptions, forwarder));
    }
  }
  return results;
}

/** Gets the options for the specified forwarding service with defaults applied.
 *  This method mutates `options`.
 * @param service Identifies the service whose options should be loaded.
 * @param options The options to load from.
 * @returns A reference to the options for the specified service.
 */
export function getForwarderOptions(
  service: string,
  options: UsernameGeneratorOptions,
): ApiOptions & MaybeLeakedOptions {
  if (service === Forwarders.AddyIo.id) {
    return falsyDefault(options.forwarders.addyIo, DefaultOptions.forwarders.addyIo);
  } else if (service === Forwarders.DuckDuckGo.id) {
    return falsyDefault(options.forwarders.duckDuckGo, DefaultOptions.forwarders.duckDuckGo);
  } else if (service === Forwarders.Fastmail.id) {
    return falsyDefault(options.forwarders.fastMail, DefaultOptions.forwarders.fastMail);
  } else if (service === Forwarders.FirefoxRelay.id) {
    return falsyDefault(options.forwarders.firefoxRelay, DefaultOptions.forwarders.firefoxRelay);
  } else if (service === Forwarders.ForwardEmail.id) {
    return falsyDefault(options.forwarders.forwardEmail, DefaultOptions.forwarders.forwardEmail);
  } else if (service === Forwarders.SimpleLogin.id) {
    return falsyDefault(options.forwarders.simpleLogin, DefaultOptions.forwarders.simpleLogin);
  } else {
    return null;
  }
}

/**
 * Recursively applies default values from `defaults` to falsy or
 * missing properties in  `value`.
 *
 * @remarks This method is not aware of the
 * object's prototype or metadata, such as readonly or frozen fields.
 * It should only be used on plain objects.
 *
 * @param value - The value to fill in. This parameter is mutated.
 * @param defaults - The default values to use.
 * @returns the mutated `value`.
 */
export function falsyDefault<T>(value: T, defaults: Partial<T>): T {
  // iterate keys in defaults because `value` may be missing keys
  for (const key in defaults) {
    if (defaults[key] instanceof Object) {
      // `any` type is required because typescript can't predict the type of `value[key]`.
      const target: any = value[key] || (defaults[key] instanceof Array ? [] : {});
      value[key] = falsyDefault(target, defaults[key]);
    } else if (!value[key]) {
      value[key] = defaults[key];
    }
  }

  return value;
}
