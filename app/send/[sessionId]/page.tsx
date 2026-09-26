"use client";

import {
  type ChangeEvent,
  type DragEvent,
  Suspense,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { API_ENDPOINTS } from "@/lib/config";

const MAX_FILE_SIZE_MB = 500;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface SelectedItem {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl?: string;
  isImage: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SendPageInner({ sessionId }: { sessionId: string }) {
  const searchParams = useSearchParams();
  const urlTypeParam = searchParams.get("type");

  const [mode, setMode] = useState<"photos" | "files">(
    urlTypeParam === "files" ? "files" : "photos",
  );
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [items, setItems] = useState<SelectedItem[]>([]);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autoTriggerAttempted = useRef(false);

  // Background session validation
  useEffect(() => {
    let isMounted = true;
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
        const data = (await response.json()) as {
          closed?: boolean;
          type?: "photos" | "files";
        };
        if (data.closed) {
          throw new Error("This receive session is no longer active");
        }
        if (isMounted) {
          setSessionValid(true);
          // If URL had no type param, use the session type configured on server
          if (!urlTypeParam && data.type) {
            setMode(data.type);
          }
        }
      } catch (err) {
        if (isMounted) {
          setSessionValid(false);
          setSessionError(
            err instanceof Error ? err.message : "Session unavailable",
          );
        }
      }
    };

    void validate();
    return () => {
      isMounted = false;
    };
  }, [sessionId, urlTypeParam]);

  // Attempt automatic trigger on mount
  useEffect(() => {
    if (autoTriggerAttempted.current) return;
    autoTriggerAttempted.current = true;

    const timer = setTimeout(() => {
      try {
        fileInputRef.current?.click();
      } catch {
        // Silently handled if browser requires physical user gesture
      }
    }, 150);

    return () => clearTimeout(timer);
  }, []);

  // Cleanup object URLs for images on unmount
  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [items]);

  const openPicker = useCallback(() => {
    if (uploadStatus === "uploading") return;
    fileInputRef.current?.click();
  }, [uploadStatus]);

  const addFiles = useCallback((files: File[]) => {
    const oversized = files.find((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (oversized) {
      setUploadError(
        `"${oversized.name}" exceeds the ${MAX_FILE_SIZE_MB}MB limit.`,
      );
      return;
    }

    setUploadError(null);

    const newItems: SelectedItem[] = files.map((file) => {
      const isImg = file.type.startsWith("image/");
      return {
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        name: file.name,
        size: file.size,
        isImage: isImg,
        previewUrl: isImg ? URL.createObjectURL(file) : undefined,
      };
    });

    setItems((prev) => [...prev, ...newItems]);
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
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) addFiles(droppedFiles);
    },
    [addFiles],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const handleUpload = useCallback(async () => {
    if (items.length === 0) return;

    if (sessionValid === false) {
      setUploadError(sessionError || "Session is no longer valid.");
      return;
    }

    setUploadStatus("uploading");
    setUploadProgress(0);
    setUploadError(null);

    try {
      const formData = new FormData();
      for (const item of items) {
        formData.append("files", item.file);
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

        xhr.addEventListener("error", () => reject(new Error("Network upload error")));
        xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

        xhr.open(
          "POST",
          `${API_ENDPOINTS.RECEIVE_SESSION}/${sessionId}/upload`,
        );
        xhr.send(formData);
      });

      setSentCount(items.length);
      setUploadStatus("done");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setUploadStatus("error");
      setUploadProgress(0);
    }
  }, [items, sessionId, sessionValid, sessionError]);

  const handleSendMore = useCallback(() => {
    items.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setItems([]);
    setUploadStatus("idle");
    setUploadProgress(0);
    setUploadError(null);
    setSentCount(0);
  }, [items]);

  // Session invalid screen
  if (sessionValid === false && uploadStatus !== "done") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Session Unavailable</h1>
          <p className="text-muted-foreground text-sm">
            {sessionError || "The QR code has expired or the session was closed by the receiver."}
          </p>
          <Button asChild size="lg" className="mt-2">
            <a href="/">Go to OpenDrop</a>
          </Button>
        </div>
      </div>
    );
  }

  // Upload success screen
  if (uploadStatus === "done") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <div className="flex flex-col items-center gap-6 w-full max-w-md text-center">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-10 h-10 text-emerald-500"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold">
              {mode === "photos" ? "Photos" : "Files"} Sent!
            </h1>
            <p className="text-sm text-muted-foreground">
              {sentCount} {mode === "photos" ? (sentCount === 1 ? "photo" : "photos") : (sentCount === 1 ? "file" : "files")} delivered directly to the receiver.
            </p>
          </div>

          <Button
            onClick={handleSendMore}
            size="lg"
            className="w-full font-semibold"
          >
            Send More {mode === "photos" ? "Photos" : "Files"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-start min-h-screen bg-background px-4 py-8 sm:py-12 transition-colors ${isDragging ? "bg-muted/40 border-2 border-dashed border-primary" : ""
        }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Native input configured for either image/* (Instagram style) or * (Files) */}
      <input
        ref={fileInputRef}
        type="file"
        accept={mode === "photos" ? "image/*" : "*"}
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploadStatus === "uploading"}
      />

      <div className="w-full max-w-lg flex flex-col items-center gap-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {mode === "photos" ? "Send Photos" : "Send Files"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Delivering directly to the person who showed you the QR code
          </p>
        </div>

        {/* 0 items selected: Big 1-tap trigger */}
        {items.length === 0 && (
          <button
            type="button"
            onClick={openPicker}
            className="w-full group relative flex flex-col items-center justify-center gap-4 p-10 sm:p-14 border-2 border-dashed border-primary/40 hover:border-primary rounded-2xl bg-card hover:bg-muted/40 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
          >
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              {mode === "photos" ? (
                // Camera & Photo Icon
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="18" x="3" y="3" rx="4" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
              ) : (
                // File / Document Icon
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              )}
            </div>
            <div className="text-center space-y-1">
              <span className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                {mode === "photos" ? "Tap to Choose Photos" : "Tap to Choose Files"}
              </span>
            </div>
          </button>
        )}

        {/* Selected Items Previews */}
        {items.length > 0 && (
          <div className="w-full space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">
                {items.length} {mode === "photos" ? "photo" : "file"}
                {items.length === 1 ? "" : "s"} selected
              </span>
              <button
                type="button"
                onClick={openPicker}
                disabled={uploadStatus === "uploading"}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                + Add more
              </button>
            </div>

            {/* Photos Grid Mode (Instagram Style) */}
            {mode === "photos" ? (
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="relative aspect-square rounded-xl overflow-hidden bg-muted border border-border group"
                  >
                    {item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-card text-xs">
                        {item.name}
                      </div>
                    )}
                    {uploadStatus !== "uploading" && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center text-xs hover:bg-black transition-colors"
                        aria-label="Remove item"
                      >
                        ✕
                      </button>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-1 px-1.5 text-[10px] text-white truncate">
                      {formatFileSize(item.size)}
                    </div>
                  </div>
                ))}

                {uploadStatus !== "uploading" && (
                  <button
                    type="button"
                    onClick={openPicker}
                    className="aspect-square rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-all bg-card/50 cursor-pointer"
                  >
                    <span className="text-2xl font-light">+</span>
                    <span className="text-[11px] font-medium">Add Photo</span>
                  </button>
                )}
              </div>
            ) : (
              /* Files List Mode */
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 border border-border rounded-xl p-3 bg-card"
                  >
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-medium truncate">
                        {item.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(item.size)}
                      </span>
                    </div>
                    {uploadStatus !== "uploading" && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-muted-foreground hover:text-destructive text-sm px-2 py-1"
                        aria-label={`Remove ${item.name}`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Upload Progress Bar */}
            {uploadStatus === "uploading" && (
              <div className="w-full space-y-2 pt-2">
                <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-200 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground font-medium">
                  <span>Uploading to receiver...</span>
                  <span>{uploadProgress}%</span>
                </div>
              </div>
            )}

            {/* Send Button */}
            {uploadStatus !== "uploading" && (
              <Button
                onClick={handleUpload}
                size="xl"
                className="w-full font-semibold text-base sm:text-lg mt-4 shadow-sm"
              >
                Send {items.length} {mode === "photos" ? (items.length === 1 ? "Photo" : "Photos") : (items.length === 1 ? "File" : "Files")}
              </Button>
            )}
          </div>
        )}

        {/* Error message */}
        {uploadError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs sm:text-sm text-center w-full">
            {uploadError}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SendPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SendPageInner sessionId={sessionId} />
    </Suspense>
  );
}
