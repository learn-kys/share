"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getShareCodeKey, SHARE_CODE_LENGTH } from "@/lib/share-code";

export default function CodePage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRetrieve = () => {
    if (code.length !== SHARE_CODE_LENGTH) return;

    setError(null);
    setLoading(true);

    const stored = localStorage.getItem(getShareCodeKey(code));
    if (!stored) {
      setError("Code not found or invalid");
      setLoading(false);
      return;
    }

    const entry = JSON.parse(stored);

    // Check if code has expired
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(getShareCodeKey(code));
      setError("Code has expired");
      setLoading(false);
      return;
    }

    // Redirect to the download link
    window.location.href = entry.url;
  };

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
          {loading ? "Retrieving..." : "Retrieve File"}
        </Button>

        {error && (
          <p className="text-destructive text-xs sm:text-sm text-center">
            {error}
          </p>
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
