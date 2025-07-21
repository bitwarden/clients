export const EXTERNAL_SOURCE_TAG = Symbol("externalSource");

export const isExternalMessage = (message: Record<PropertyKey, unknown>) => {
  return message?.[EXTERNAL_SOURCE_TAG] === true;
};
