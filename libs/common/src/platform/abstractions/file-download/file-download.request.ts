export type FileDownloadRequest = {
  fileName: string;
  blobData: BlobPart;
  blobOptions?: BlobPropertyBag;
  downloadMethod?: "save" | "open";
};
