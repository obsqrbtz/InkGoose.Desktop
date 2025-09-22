export interface HttpClient {
  request<T>(url: string, options: RequestInit): Promise<T>;
  download(url: string): Promise<string>;
  upload(url: string, content: string): Promise<boolean>;
}

export interface FileTransferClient {
    download(url: string): Promise<string>;
    upload(url: string, content: string): Promise<boolean>;
}

export interface Logger {
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}