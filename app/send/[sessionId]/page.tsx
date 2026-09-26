"use client";

import {
  type ChangeEvent,
  type DragEvent,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_ENDPOINTS } from "@/lib/config";

const MAX_FILE_SIZE_MB = 500;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

type SendState = "validating" | "ready" | "uploading" | "done" | "error";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function SendPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const [sendState, setSendState] = useState<SendState>("validating");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>([]);
  const validatedRef = useRef(false);

  // Validate the session exists
  useEffect(() => {
    if (validatedRef.current) return;
    validatedRef.current = true;

    const validate = async () => {
      try {
        const response = await fetch(
          `${API_ENDPOINTS.RECEIVE_SESSION}/${sessionId}`,
        );
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(data?.error || "Session not found or expired");
        }

        const data = (await response.json()) as { closed?: boolean };
        if (data.closed) {
          throw new Error("This session has been closed");
        }

        setSendState("ready");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Session not found or expired",
        );
        setSendState("error");
      }
    };

    void validate();
  }, [sessionId]);

  const addFiles = useCallback(
    (files: File[]) => {
      if (sendState !== "ready") return;

      const oversized = files.find((f) => f.size > MAX_FILE_SIZE_BYTES);
      if (oversized) {
        setError(
          `"${oversized.name}" is larger than ${MAX_FILE_SIZE_MB} MB. Choose a smaller file.`,
        );
        return;
      }

      setError(null);
      setSelectedFiles((prev) => {
        const existingNames = new Set(prev.map((f) => f.name));
        const newFiles = files.filter((f) => !existingNames.has(f.name));
        return [...prev, ...newFiles];
      });
    },
    [sendState],
  );

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.currentTarget.files;
      if (!files || files.length === 0) return;
      addFiles(Array.from(files));
      e.currentTarget.value = "";
    },
    [addFiles],
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) addFiles(files);
    },
    [addFiles],
  );

  const handleSend = useCallback(async () => {
    if (selectedFiles.length === 0) return;

    setSendState("uploading");
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      for (const file of selectedFiles) {
        formData.append("files", file);
      }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (event) => {
          if (!event.lengthComputable) return;
          const pct = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(pct);
        });

        xhr.addEventListener("load", () => {
          if (xhr.status < 200 || xhr.status >= 300) {
            try {
              const errData = JSON.parse(xhr.responseText) as {
                error?: string;
              };
              reject(new Error(errData.error || "Upload failed"));
            } catch {
              reject(new Error("Upload failed"));
            }
            return;
          }
          resolve();
        });

        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        xhr.addEventListener("abort", () =>
          reject(new Error("Upload was cancelled")),
        );

        xhr.open(
          "POST",
          `${API_ENDPOINTS.RECEIVE_SESSION}/${sessionId}/upload`,
        );
        xhr.send(formData);
      });

      setUploadedFileNames(selectedFiles.map((f) => f.name));
      setSendState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setSendState("ready");
      setUploadProgress(0);
    }
  }, [selectedFiles, sessionId]);

  const handleSendMore = useCallback(() => {
    setSelectedFiles([]);
    setUploadedFileNames([]);
    setUploadProgress(0);
    setError(null);
    setSendState("ready");
  }, []);

  if (sendState === "validating") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">
            Validating session...
          </p>
        </div>
      </div>
    );
  }

  if (sendState === "error" && selectedFiles.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-center text-muted-foreground">
            Session Unavailable
          </h1>
          <p className="text-destructive text-sm text-center">{error}</p>
          <p className="text-muted-foreground text-xs text-center max-w-sm">
            The person who shared this QR code may have closed the session, or
            it may have expired.
          </p>
          <Button asChild size="lg">
            <a href="/">Go to OpenDrop</a>
          </Button>
        </div>
      </div>
    );
  }

  if (sendState === "done") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-8 h-8 text-green-500"
              role="img"
              aria-label="Success"
            >
              <title>Success</title>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-center">
            Files Sent!
          </h1>
          <div className="w-full space-y-1">
            {uploadedFileNames.map((name) => (
              <p
                key={name}
                className="text-sm text-muted-foreground text-center truncate"
              >
                {name}
              </p>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            The files have been delivered. The receiver can now download them.
          </p>
          <Button onClick={handleSendMore} size="lg" variant="secondary">
            Send More Files
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center min-h-screen p-4 sm:p-6 md:p-8 transition-colors ${
        isDragging
          ? "bg-muted/50 border-2 border-dashed border-primary"
          : "bg-background"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center gap-6 w-full max-w-lg">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center leading-tight text-muted-foreground">
          Send Files
        </h1>

        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Select files to send. They&apos;ll be delivered directly to the
          person who shared the QR code.
        </p>

        <div className="flex flex-col gap-3 w-full">
          <Button
            asChild
            size="2xl"
            className="font-semibold w-full text-base sm:text-lg"
            disabled={sendState === "uploading"}
          >
            <label htmlFor="send-file-upload" className="cursor-pointer">
              {sendState === "uploading" ? "Sending..." : "Select Files"}
              <Input
                id="send-file-upload"
                type="file"
                multiple
                onChange={handleFileSelect}
                disabled={sendState === "uploading"}
                className="hidden"
                accept="*"
              />
            </label>
          </Button>

          {sendState !== "uploading" && (
            <p className="text-center text-xs text-muted-foreground mt-[-4px] mb-2">
              or drag &amp; drop files anywhere
            </p>
          )}
        </div>

        {/* Selected files list */}
        {selectedFiles.length > 0 && sendState !== "uploading" && (
          <div className="w-full space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Selected ({selectedFiles.length})
            </h2>
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${file.size}`}
                className="flex items-center justify-between gap-3 border border-border rounded-lg p-3 bg-card"
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-medium truncate">
                    {file.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="text-muted-foreground hover:text-destructive transition-colors text-xs px-2 py-1"
                  aria-label={`Remove ${file.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
            <Button
              onClick={handleSend}
              size="xl"
              className="w-full font-semibold text-base sm:text-lg mt-2"
            >
              Send {selectedFiles.length} file
              {selectedFiles.length > 1 ? "s" : ""}
            </Button>
          </div>
        )}

        {/* Upload progress */}
        {sendState === "uploading" && (
          <div className="w-full space-y-2">
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-center text-sm font-medium text-muted-foreground">
              {uploadProgress}% uploaded
            </p>
          </div>
        )}

        {error && (
          <p className="text-destructive text-xs sm:text-sm text-center">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
