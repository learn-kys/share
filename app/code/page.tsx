"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CODE_STORAGE_PREFIX = "opendrop_code_";

export default function CodePage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRetrieve = () => {
    setError(null);
    setLoading(true);

    const stored = localStorage.getItem(CODE_STORAGE_PREFIX + code);
    if (!stored) {
      setError("Code not found or invalid");
      setLoading(false);
      return;
    }

    const entry = JSON.parse(stored);

    // Check if code has expired
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(CODE_STORAGE_PREFIX + code);
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
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyPress={(e) => e.key === "Enter" && handleRetrieve()}
            placeholder="Enter 6-digit code"
            maxLength={6}
            size="2xl"
            className="text-center font-mono text-lg sm:text-2xl"
          />
        </div>

        <Button
          onClick={handleRetrieve}
          size="2xl"
          disabled={code.length !== 6 || loading}
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
