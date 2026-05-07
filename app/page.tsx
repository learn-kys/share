"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_ENDPOINTS } from "@/lib/config";

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Warm-up request to avoid cold start delays
    fetch(API_ENDPOINTS.UPLOAD_BATCH, {
      method: "POST",
      body: new FormData()
    }).catch(() => {});
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files || files.length === 0) return;

    const oversizedFile = Array.from(files).find(
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

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round(
            (event.loaded / event.total) * 100,
          );
          setUploadProgress(percentComplete);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          sessionStorage.setItem("uploadData", JSON.stringify(data));
          window.location.href = "/share";
        } else {
          throw new Error("Upload failed");
        }
      });

      xhr.addEventListener("error", () => {
        throw new Error("Upload failed");
      });

      xhr.open("POST", API_ENDPOINTS.UPLOAD_BATCH);
      xhr.send(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4 sm:p-6 md:p-8">
      <div className="flex flex-col items-center gap-6 w-full max-w-2xl">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center leading-tight">
          Share Files, made easy..
        </h1>

        <div className="flex flex-col gap-3 w-full">
          <Button
            asChild
            size="2xl"
            className="font-semibold w-full text-base sm:text-lg"
            disabled={isLoading}
          >
            <label htmlFor="file-upload" className="cursor-pointer">
              {isLoading ? "Uploading..." : "Upload File"}
              <Input
                id="file-upload"
                type="file"
                multiple
                onChange={handleFileSelect}
                disabled={isLoading}
                className="hidden"
                accept="*"
              />
            </label>
          </Button>

          {isLoading && (
            <div className="w-full space-y-2">
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-center text-sm sm:text-base font-medium text-muted-foreground">
                {uploadProgress}% uploaded
              </p>
            </div>
          )}

          <Button
            asChild
            size="xl"
            variant="link"
            className="font-semibold w-full text-base sm:text-lg"
            disabled={isLoading}
          >
            <a href="/code">Get file by code</a>
          </Button>
        </div>

        {error && (
          <p className="text-destructive text-xs sm:text-sm text-center">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
