"use client";

import hljs from "highlight.js";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_ENDPOINTS } from "@/lib/config";
import { SHARE_CODE_LENGTH } from "@/lib/share-code";
import "highlight.js/styles/github-dark.css";

function CodePageInner() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resolvedText, setResolvedText] = useState<string | null>(null);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const autoRunRef = useRef(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      // fallback for older browsers
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    });

    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2500);
  }, []);

  const retrieveByCode = useCallback(
    async (targetCode: string) => {
      if (targetCode.length !== SHARE_CODE_LENGTH) return;

      setError(null);
      setResolvedText(null);
      setHighlightedHtml(null);
      setDetectedLanguage(null);
      setCopied(false);
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
          const text = payload.text;
          setResolvedText(text);
          copyToClipboard(text);

          // Attempt to detect code
          const result = hljs.highlightAuto(text);
          // If the relevance score is decent and it's not detected as simple text/plaintext
          if (
            result.language &&
            result.language !== "plaintext" &&
            result.relevance > 5
          ) {
            setHighlightedHtml(result.value);
            setDetectedLanguage(result.language);
          }

          return;
        }

        setError("Share data was incomplete");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to retrieve share",
        );
      } finally {
        setLoading(false);
      }
    },
    [copyToClipboard],
  );

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

  // cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4 sm:p-6 md:p-8">
      <div className="flex flex-col items-center gap-6 w-full max-w-sm md:max-w-3xl">
        <h1 className="text-2xl sm:text-3xl font-bold text-center leading-tight">
          Enter Share Code
        </h1>

        <div className="w-full max-w-sm mx-auto">
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

        <div className="w-full max-w-sm mx-auto">
          <Button
            onClick={handleRetrieve}
            size="2xl"
            disabled={code.length !== SHARE_CODE_LENGTH || loading}
            className="w-full font-semibold text-base sm:text-lg"
          >
            {loading ? "Retrieving..." : "Retrieve"}
          </Button>
        </div>

        {/* Copied banner — shown right after successful text retrieval */}
        {copied && (
          <div className="w-full max-w-sm mx-auto flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2.5 text-green-600 dark:text-green-400 text-sm font-medium">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="size-4 shrink-0"
              role="img"
              aria-label="Success"
            >
              <title>Success</title>
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                clipRule="evenodd"
              />
            </svg>
            Text copied to clipboard!
          </div>
        )}

        {error && (
          <p className="text-destructive text-xs sm:text-sm text-center">
            {error}
          </p>
        )}

        {resolvedText && (
          <div className="w-full border rounded-lg border-border p-4 space-y-3">
            {detectedLanguage ? (
              <div className="relative rounded-md overflow-hidden border border-border">
                <div className="flex items-center justify-between px-4 py-2 bg-muted/80 text-xs font-mono text-muted-foreground border-b border-border">
                  <span>{detectedLanguage}</span>
                </div>
                <div className="p-4 bg-[#0d1117] overflow-x-auto text-sm sm:text-base">
                  <pre>
                    <code
                      className={`hljs language-${detectedLanguage}`}
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: output from highlight.js is safe
                      dangerouslySetInnerHTML={{
                        __html: highlightedHtml || "",
                      }}
                    />
                  </pre>
                </div>
              </div>
            ) : (
              <div className="bg-muted p-3 rounded-md border border-border text-sm sm:text-base whitespace-pre-wrap break-words">
                {resolvedText}
              </div>
            )}
            <div className="w-full max-w-sm mx-auto">
              <Button
                onClick={() => copyToClipboard(resolvedText)}
                size="sm"
                variant="secondary"
                className="w-full"
              >
                {copied ? "Copied!" : "Copy again"}
              </Button>
            </div>
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

export default function CodePage() {
  return (
    <Suspense>
      <CodePageInner />
    </Suspense>
  );
}
