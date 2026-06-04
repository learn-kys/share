"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_ENDPOINTS } from "@/lib/config";
import { SHARE_CODE_LENGTH } from "@/lib/share-code";

export default function CodePage() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resolvedText, setResolvedText] = useState<string | null>(null);
  const autoRunRef = useRef(false);

  const retrieveByCode = useCallback(async (targetCode: string) => {
    if (targetCode.length !== SHARE_CODE_LENGTH) return;

    setError(null);
    setResolvedText(null);
    setLoading(true);

    try {
      const response = await fetch(
        `${API_ENDPOINTS.SHARE_CODE_LOOKUP}/${targetCode}`,
      );

      if (!response.ok) {
        if (response.status === 410) {
          setError("Code has expired");
          return;
        }
        if (response.status === 404) {
          setError("Code not found or invalid");
          return;
        }
        setError("Unable to retrieve share");
        return;
      }

      const payload = (await response.json()) as
        | { type: "file"; downloadUrl?: string }
        | { type: "text"; text?: string };

      if (payload.type === "file" && payload.downloadUrl) {
        window.location.href = payload.downloadUrl;
        return;
      }

      if (payload.type === "text" && typeof payload.text === "string") {
        setResolvedText(payload.text);
        return;
      }

      setError("Share data was incomplete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to retrieve share");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRetrieve = () => {
    if (code.length !== SHARE_CODE_LENGTH) return;
    void retrieveByCode(code);
  };

  useEffect(() => {
    const incoming = searchParams.get("code");
    if (!incoming || autoRunRef.current) return;
    const normalized = incoming.replace(/\D/g, "").slice(0, SHARE_CODE_LENGTH);
    if (normalized.length !== SHARE_CODE_LENGTH) return;
    autoRunRef.current = true;
    setCode(normalized);
    void retrieveByCode(normalized);
  }, [retrieveByCode, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4 sm:p-6 md:p-8">
      <div className="flex flex-col items-center gap-6 w-full max-w-sm">
        <h1 className="text-2xl sm:text-3xl font-bold text-center leading-tight">
          Enter Share Code
        </h1>

        <div className="w-full">
          <Input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) =>
              setCode(
                e.target.value.replace(/\D/g, "").slice(0, SHARE_CODE_LENGTH),
              )
            }
            onKeyDown={(e) => e.key === "Enter" && handleRetrieve()}
            placeholder="Enter 4-digit code"
            maxLength={SHARE_CODE_LENGTH}
            size="2xl"
            className="text-center font-mono text-lg sm:text-2xl"
          />
        </div>

        <Button
          onClick={handleRetrieve}
          size="2xl"
          disabled={code.length !== SHARE_CODE_LENGTH || loading}
          className="w-full font-semibold text-base sm:text-lg"
        >
          {loading ? "Retrieving..." : "Retrieve"}
        </Button>

        {error && (
          <p className="text-destructive text-xs sm:text-sm text-center">
            {error}
          </p>
        )}

        {resolvedText && (
          <div className="w-full border rounded-lg border-border p-4 space-y-3">
            <div className="bg-muted p-3 rounded-md border border-border text-sm sm:text-base whitespace-pre-wrap break-words">
              {resolvedText}
            </div>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(resolvedText);
                alert("Text copied!");
              }}
              size="sm"
              variant="secondary"
              className="w-full"
            >
              Copy text
            </Button>
          </div>
        )}

        <a
          href="/"
          className="text-primary hover:underline text-base sm:text-lg"
        >
          ← Back to Upload
        </a>
      </div>
    </div>
  );
}
