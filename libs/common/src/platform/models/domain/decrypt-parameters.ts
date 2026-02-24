export type CbcDecryptParameters<T> = {
  encKey: T;
  data: T;
  iv: T;
  macKey?: T;
  mac?: T;
  macData: T;
};

/// WARNING: THIS IS EXTREMELY DANGEROUS. DO NOT USE THIS IF YOU DON'T KNOW WHAT YOU ARE DOING!!!!!!!!
/// https://crypto.stackexchange.com/questions/20941/why-shouldnt-i-use-ecb-encryption
/// This is only meant for import with legacy systems
export type EcbDecryptParameters<T> = {
  encKey: T;
  data: T;
};
