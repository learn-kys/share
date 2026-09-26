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
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);

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
      });

      if (!response.ok) {
        throw new Error("Failed to create receive session");
      }

      const data = (await response.json()) as { sessionId: string };
      const sid = data.sessionId;
      setSessionId(sid);
      sessionIdRef.current = sid;

      // Generate QR code pointing to the send page
      const sendUrl = `${window.location.origin}/send/${sid}`;
      const qr = await QRCode.toDataURL(sendUrl, {
        width: 300,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
      setQrDataUrl(qr);
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
        // Attempt reconnect after a short delay if session is still active
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
  }, [pollSession]);

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

  // Also poll every 5s as a fallback for WebSocket failures
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
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center leading-tight text-muted-foreground">
          Receive Files
        </h1>

        {sessionState === "loading" && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-border rounded animate-pulse bg-muted" />
            <p className="text-sm text-muted-foreground">
              Creating receive session...
            </p>
          </div>
        )}

        {sessionState === "error" && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-destructive text-sm text-center">{error}</p>
            <Button onClick={initSession} size="lg">
              Try Again
            </Button>
          </div>
        )}

        {sessionState === "ready" && qrDataUrl && (
          <>
            <div className="flex flex-col items-center gap-4">
              <div className="p-3 bg-white rounded-lg border-2 border-border">
                <img
                  src={qrDataUrl}
                  alt="Scan this QR code to send files"
                  className="w-48 h-48 sm:w-56 sm:h-56"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                Show this QR code to anyone — they scan it, select files, and
                the files land right here on your device.
              </p>
            </div>

            {/* Received files list */}
            <div className="w-full space-y-3">
              {receivedFiles.length > 0 && (
                <div className="border-t border-border pt-4">
                  <h2 className="text-lg sm:text-xl font-semibold mb-3">
                    Received Files ({receivedFiles.length})
                  </h2>
                  <div className="space-y-2">
                    {receivedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between gap-3 border border-border rounded-lg p-3 sm:p-4 bg-card animate-in fade-in slide-in-from-bottom-2 duration-300"
                      >
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
                    ))}
                  </div>
                </div>
              )}

              {receivedFiles.length === 0 && (
                <div className="text-center py-8 border border-dashed border-border rounded-lg">
                  <p className="text-muted-foreground text-sm">
                    Waiting for files...
                  </p>
                  <p className="text-muted-foreground/60 text-xs mt-1">
                    Files will appear here as soon as someone sends them
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        <a
          href="/"
          className="text-primary hover:underline text-base sm:text-lg"
        >
          ← Back to Home
        </a>
      </div>
    </div>
  );
}
