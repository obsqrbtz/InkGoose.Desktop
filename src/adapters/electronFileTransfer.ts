import { FileTransferClient } from "../../packages/core/platform/platform";

export const electronFileTransfer: FileTransferClient = {
  download: (url: string) => window.electronAPI.downloadFileContent(url),
  upload: (url: string, content: string) => window.electronAPI.uploadFileContent(url, content),
};