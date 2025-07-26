import "reflect-metadata";
const requiredMetadataKey = Symbol("required");

export function required(target: object, propertyKey: string | symbol, parameterIndex: number) {
  const existingRequiredParameters: number[] =
    Reflect.getOwnMetadata(requiredMetadataKey, target, propertyKey) || [];
  existingRequiredParameters.push(parameterIndex);
  Reflect.defineMetadata(requiredMetadataKey, existingRequiredParameters, target, propertyKey);
}

export function validate(
  target: any,
  propertyName: string,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  descriptor: TypedPropertyDescriptor<Function>,
) {
  const method = descriptor.value!;

  descriptor.value = function (...args: any[]) {
    const requiredParameters: number[] = Reflect.getOwnMetadata(
      requiredMetadataKey,
      target,
      propertyName,
    );
    if (requiredParameters) {
      for (const parameterIndex of requiredParameters) {
        if (
          parameterIndex >= args.length ||
          args[parameterIndex] === undefined ||
          args[parameterIndex] === null
        ) {
          throw new Error("Missing required argument.");
        }
      }
    }
    return method.apply(this, args);
  };
}
