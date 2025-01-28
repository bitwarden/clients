export type CbcDecryptParameters<T> = {
  encKey: T;
  data: T;
  iv: T;
  macKey?: T;
  mac?: T;
  macData: T;
};

export type EcbDecryptParameters<T> = {
  encKey: T;
  data: T;
};
