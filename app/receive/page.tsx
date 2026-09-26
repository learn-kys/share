"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { API_ENDPOINTS, WS_BASE_URL } from "@/lib/config";

interface ReceivedFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  uploadedAt: number;
}

type SessionState = "loading" | "ready" | "error";
type ReceiveType = "photos" | "files";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function ReceivePage() {
  const [sessionState, setSessionState] = useState<SessionState>("loading");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [receiveType, setReceiveType] = useState<ReceiveType>("photos");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const updateQR = useCallback(async (sid: string, type: ReceiveType) => {
    try {
      const sendUrl = `${window.location.origin}/send/${sid}?type=${type}`;
      const qr = await QRCode.toDataURL(sendUrl, {
        width: 320,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
      setQrDataUrl(qr);
    } catch {
      // silent
    }
  }, []);

  const handleTypeChange = useCallback(
    (type: ReceiveType) => {
      setReceiveType(type);
      if (sessionId) {
        void updateQR(sessionId, type);
      }
    },
    [sessionId, updateQR],
  );

  const pollSession = useCallback(async (sid: string) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.RECEIVE_SESSION}/${sid}`);
      if (!response.ok) return;
      const data = (await response.json()) as {
        files: ReceivedFile[];
      };
      setReceivedFiles(data.files);
    } catch {
      // silent
    }
  }, []);

  const initSession = useCallback(async () => {
    try {
      setSessionState("loading");
      setError(null);

      const response = await fetch(API_ENDPOINTS.RECEIVE_SESSION, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: receiveType }),
      });

      if (!response.ok) {
        throw new Error("Failed to create receive session");
      }

      const data = (await response.json()) as { sessionId: string };
      const sid = data.sessionId;
      setSessionId(sid);
      sessionIdRef.current = sid;

      await updateQR(sid, receiveType);
      setSessionState("ready");

      // Connect via WebSocket for real-time updates
      const ws = new WebSocket(WS_BASE_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "subscribe-receive-session",
            sessionId: sid,
          }),
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as {
            type: string;
            newFiles?: ReceivedFile[];
          };
          if (
            msg.type === "receive-session-files" &&
            Array.isArray(msg.newFiles)
          ) {
            setReceivedFiles((prev) => [...prev, ...msg.newFiles!]);
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        setTimeout(() => {
          if (sessionIdRef.current === sid) {
            void pollSession(sid);
          }
        }, 3000);
      };
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create session",
      );
      setSessionState("error");
    }
  }, [pollSession, receiveType, updateQR]);

  useEffect(() => {
    void initSession();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      sessionIdRef.current = null;
    };
  }, [initSession]);

  // Poll fallback
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => {
      void pollSession(sessionId);
    }, 5000);
    return () => clearInterval(interval);
  }, [sessionId, pollSession]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4 sm:p-6 md:p-8">
      <div className="flex flex-col items-center gap-6 w-full max-w-2xl">
        <div className="text-center space-y-1">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
            Receive Files &amp; Photos
          </h1>
          <p className="text-sm text-muted-foreground">
            Generate a QR code for someone nearby to scan and send directly to your device
          </p>
        </div>

        {/* Choice selector: What type of QR do you want? */}
        <div className="flex flex-col items-center gap-2 w-full max-w-sm">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Choose QR Type
          </label>
          <div className="grid grid-cols-2 p-1 bg-muted rounded-xl w-full border border-border">
            <button
              type="button"
              onClick={() => handleTypeChange("photos")}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                receiveType === "photos"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>📷</span> Photos Only
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange("files")}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                receiveType === "files"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>📁</span> Any Files
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {receiveType === "photos"
              ? "Scanner will directly open their Photo Gallery (Instagram-style)"
              : "Scanner will open their File Manager for any documents or files"}
          </p>
        </div>

        {sessionState === "loading" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-52 h-52 sm:w-60 sm:h-60 border-2 border-border rounded-2xl animate-pulse bg-muted flex items-center justify-center">
              <span className="text-xs text-muted-foreground">Generating QR code...</span>
            </div>
          </div>
        )}

        {sessionState === "error" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-destructive text-sm text-center">{error}</p>
            <Button onClick={initSession} size="lg">
              Try Again
            </Button>
          </div>
        )}

        {sessionState === "ready" && qrDataUrl && (
          <>
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-white rounded-2xl border-2 border-border shadow-md">
                <img
                  src={qrDataUrl}
                  alt={`Scan to send ${receiveType === "photos" ? "photos" : "files"}`}
                  className="w-52 h-52 sm:w-64 sm:h-64 rounded-lg"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                Scan with any phone camera — {receiveType === "photos" ? "opens photo gallery" : "opens file picker"} immediately.
              </p>
            </div>

            {/* Received files list */}
            <div className="w-full space-y-3">
              {receivedFiles.length > 0 && (
                <div className="border-t border-border pt-4">
                  <h2 className="text-lg sm:text-xl font-semibold mb-3">
                    Received {receiveType === "photos" ? "Photos" : "Files"} ({receivedFiles.length})
                  </h2>
                  <div className="space-y-2">
                    {receivedFiles.map((file) => {
                      const isImage =
                        file.mimeType?.startsWith("image/") ||
                        /\.(jpe?g|png|gif|webp|heic|svg)$/i.test(file.name);
                      return (
                        <div
                          key={file.id}
                          className="flex items-center justify-between gap-3 border border-border rounded-xl p-3 sm:p-4 bg-card animate-in fade-in slide-in-from-bottom-2 duration-300"
                        >
                          {isImage ? (
                            <img
                              src={file.url}
                              alt={file.name}
                              className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-cover border border-border shrink-0 bg-muted"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
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
                          )}
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm sm:text-base font-medium truncate">
                              {file.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                            </span>
                          </div>
                          <Button asChild size="sm" variant="secondary">
                            <a href={file.url} download={file.name}>
                              Download
                            </a>
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {receivedFiles.length === 0 && (
                <div className="text-center py-8 border border-dashed border-border rounded-xl">
                  <p className="text-muted-foreground text-sm font-medium">
                    Waiting for {receiveType === "photos" ? "photos" : "files"}...
                  </p>
                  <p className="text-muted-foreground/60 text-xs mt-1">
                    Items will show up here the instant they are sent
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        <a
          href="/"
          className="text-primary hover:underline text-sm sm:text-base mt-2"
        >
          ← Back to Home
        </a>
      </div>
    </div>
  );
}
