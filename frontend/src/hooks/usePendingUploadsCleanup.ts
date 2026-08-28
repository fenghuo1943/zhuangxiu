import { useCallback, useRef } from 'react';
import { cleanupUploadedDiaryImages } from '../api/diaries';

export interface UsePendingUploadsCleanupOptions {
  onCleanupError?: (error: unknown) => void;
}

export function usePendingUploadsCleanup(options: UsePendingUploadsCleanupOptions = {}) {
  const pendingUrlsRef = useRef<string[]>([]);
  const { onCleanupError } = options;

  const trackUploadedUrls = useCallback((urls: string[]) => {
    if (!urls.length) return;
    pendingUrlsRef.current = [...pendingUrlsRef.current, ...urls];
  }, []);

  const removeTrackedUrl = useCallback((url: string) => {
    pendingUrlsRef.current = pendingUrlsRef.current.filter(u => u !== url);
  }, []);

  const clearTrackedUrls = useCallback(() => {
    pendingUrlsRef.current = [];
  }, []);

  const cleanupPendingUploads = useCallback(async () => {
    const pendingUrls = [...pendingUrlsRef.current];
    pendingUrlsRef.current = [];
    if (!pendingUrls.length) return;

    try {
      await cleanupUploadedDiaryImages(pendingUrls);
    } catch (error) {
      onCleanupError?.(error);
      console.warn('清理未保存的上传图片失败:', error);
    }
  }, [onCleanupError]);

  return {
    pendingUrlsRef,
    trackUploadedUrls,
    removeTrackedUrl,
    clearTrackedUrls,
    cleanupPendingUploads,
  };
}
