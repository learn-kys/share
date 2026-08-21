"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { API_ENDPOINTS } from "@/lib/config";

export default function TextSharePage() {
  const [text, setText] = useState("");
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setText("");
    setShareCode(null);
    setQrCode(null);
    setError(null);
    setIsLoading(false);
  };

  const handleShare = async () => {
    if (!text.trim()) {
      setError("Enter some text to share.");
      return;
    }


    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.SHARE_CODE_TEXT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || "Failed to create share code");
      }

      const payload = (await response.json()) as { code?: string };
      if (!payload.code) {
        throw new Error("Share code response missing code");
      }

      const shareUrl = `${window.location.origin}/code?code=${payload.code}`;
      const qrDataUrl = await QRCode.toDataURL(shareUrl);
      setShareCode(payload.code);
      setQrCode(qrDataUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create share code",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4 sm:p-6 md:p-8">
      <div className="flex flex-col gap-6 w-full max-w-2xl">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center leading-tight text-muted-foreground">
          Share Text
        </h1>

        <div className="flex flex-col gap-3 w-full">
          <textarea
            value={text}
            onChange={(event) => {
              if (shareCode) return;
              setText(event.target.value);
            }}
            placeholder="Type or paste the text you want to share..."
            className="w-full min-h-[160px] rounded-none border border-input bg-transparent px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
            disabled={isLoading || Boolean(shareCode)}
          />

          <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
            <span>
              {text.length.toLocaleString()} characters
            </span>
            {shareCode && (
              <button
                type="button"
                onClick={() => {
                  setShareCode(null);
                  setQrCode(null);
                  setError(null);
                }}
                className="underline hover:text-foreground"
              >
                Edit text
              </button>
            )}
          </div>

          <Button
            onClick={handleShare}
            size="2xl"
            disabled={
              isLoading ||
              !text.trim() ||
              Boolean(shareCode)
            }
            className="w-full font-semibold text-base sm:text-lg"
          >
            {isLoading ? "Sharing..." : "Share Text"}
          </Button>
        </div>

        {error && (
          <p className="text-destructive text-xs sm:text-sm text-center">
            {error}
          </p>
        )}

        {shareCode && (
          <div className="border rounded-lg p-4 sm:p-6 border-border space-y-6">
            <div className="flex flex-col gap-3">
              <h2 className="text-base sm:text-lg font-semibold">Share Code</h2>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-muted p-3 sm:p-4 rounded-md border-2 border-border">
                <span className="text-xl sm:text-2xl font-bold font-mono text-primary break-all">
                  {shareCode}
                </span>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(shareCode);
                    alert("Code copied!");
                  }}
                  className="w-full sm:w-auto sm:ml-auto text-sm sm:text-base"
                  size="sm"
                >
                  Copy
                </Button>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Enter this code on the code page to view the text.
              </p>
            </div>

            {qrCode && (
              <div className="flex flex-col items-center gap-4">
                <Image
                  src={qrCode}
                  alt="QR code for text share"
                  width={192}
                  height={192}
                  className="w-40 h-40 sm:w-48 sm:h-48 border-2 border-border rounded"
                  unoptimized
                />
                <p className="text-xs sm:text-sm text-muted-foreground text-center">
                  Scan this QR code to open the share code page.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <h3 className="text-sm sm:text-base font-semibold">Text</h3>
              <div className="bg-muted p-3 sm:p-4 rounded-md border border-border text-sm sm:text-base whitespace-pre-wrap break-words">
                {text}
              </div>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(text);
                  alert("Text copied!");
                }}
                variant="secondary"
                size="sm"
              >
                Copy text
              </Button>
            </div>

            <Button onClick={reset} variant="secondary" size="lg">
              Share another text
            </Button>
          </div>
        )}

        <a
          href="/"
          className="text-primary hover:underline text-base sm:text-lg text-center"
        >
          ← Back to Home
        </a>
      </div>
    </div>
  );
}
