"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_ENDPOINTS } from "@/lib/config";

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const UPLOAD_PROGRESS_CAP = 92;
const PROCESSING_PROGRESS_CAP = 98;

const getOptimisticStep = (progress: number) => {
  const base =
    progress < 35 ? 3 :
    progress < 70 ? 1.5 :
    progress < 90 ? 0.75 : 0.25;

  return base * (0.3 + Math.random() * 1.5); // ±50–150% of base
};

export function useFileUpload() {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const optimisticTimerRef = useRef<number | null>(null);

  const stopOptimisticProgress = useCallback(() => {
    if (optimisticTimerRef.current === null) return;

    window.clearTimeout(optimisticTimerRef.current); 
    optimisticTimerRef.current = null;
  }, []);

  const startOptimisticProgress = useCallback((cap: number) => {
  stopOptimisticProgress();

  const scheduleNext = () => {
    const delay = 150 + Math.random() * 350; // 150–500ms
    optimisticTimerRef.current = window.setTimeout(() => {
      setUploadProgress((current) => {
        if (current >= cap) return current;
        return Math.min(cap, current + getOptimisticStep(current));
      });
      scheduleNext();
    }, delay);
  };

  scheduleNext();
}, [stopOptimisticProgress]);

  useEffect(() => {
    const formData = new FormData();

    void fetch(API_ENDPOINTS.UPLOAD_BATCH, {
      method: "POST",
      body: formData,
    }).catch((requestError: unknown) => {
      console.error("Upload warmup request failed:", requestError);
    });
  }, []);

  useEffect(() => {
    return () => {
      stopOptimisticProgress();
    };
  }, [stopOptimisticProgress]);

  const uploadFiles = useCallback(
    (files: File[]) => {
      return new Promise<unknown>((resolve, reject) => {
        const formData = new FormData();

        files.forEach((file) => {
          formData.append("files", file);
        });

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (event) => {
          if (!event.lengthComputable) return;

          const percentComplete = Math.round(
            (event.loaded / event.total) * UPLOAD_PROGRESS_CAP,
          );

          setUploadProgress((currentProgress) =>
            Math.max(currentProgress, percentComplete),
          );

          if (event.loaded === event.total) {
            startOptimisticProgress(PROCESSING_PROGRESS_CAP);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new Error("Upload failed"));
            return;
          }

          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error("Upload response was not valid JSON"));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Upload failed"));
        });

        xhr.addEventListener("abort", () => {
          reject(new Error("Upload was cancelled"));
        });

        xhr.open("POST", API_ENDPOINTS.UPLOAD_BATCH);
        xhr.send(formData);
      });
    },
    [startOptimisticProgress],
  );

  const handleFileSelect = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.currentTarget.files;
      if (!files || files.length === 0) return;

      const selectedFiles = Array.from(files);
      const oversizedFile = selectedFiles.find(
        (file) => file.size > MAX_FILE_SIZE_BYTES,
      );

      if (oversizedFile) {
        alert(
          `"${oversizedFile.name}" is larger than ${MAX_FILE_SIZE_MB} MB. Please choose a smaller file.`,
        );
        e.currentTarget.value = "";
        return;
      }

      setIsLoading(true);
      setUploadProgress(0);
      setError(null);
      startOptimisticProgress(UPLOAD_PROGRESS_CAP);

      try {
        const data = await uploadFiles(selectedFiles);

        stopOptimisticProgress();
        setUploadProgress(100);
        sessionStorage.setItem("uploadData", JSON.stringify(data));
        window.location.href = "/share";
      } catch (err) {
        stopOptimisticProgress();
        setError(err instanceof Error ? err.message : "Upload failed");
        setIsLoading(false);
        setUploadProgress(0);
        e.currentTarget.value = "";
      }
    },
    [startOptimisticProgress, stopOptimisticProgress, uploadFiles],
  );

  return {
    error,
    handleFileSelect,
    isLoading,
    uploadProgress: Math.round(uploadProgress),
  };
}
