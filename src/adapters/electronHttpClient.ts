import { HttpClient } from "../../packages/core/platform/platform";

const handleError = (url: string, status: number, text: string) => {
    console.error('Sync API request failed:', url, 'status:', status, 'error:', text);

    try {
        const errorData = JSON.parse(text);
        throw new Error(errorData.errors?.[0] || errorData.message || text);
    } catch {
        throw new Error(text || `HTTP ${status}`);
    }
};

export const electronHttpClient: HttpClient = {
  async request<T>(url: string, options: RequestInit): Promise<T> {
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      handleError(url, response.status, errorText); // same as your original
    }

    const text = await response.text();
    return text ? JSON.parse(text) as T : ({} as T);
  },
  async download(url: string) {
    return await window.electronAPI.downloadFileContent(url);
  },
  async upload(url: string, content: string) {
    return await window.electronAPI.uploadFileContent(url, content);
  }
};
