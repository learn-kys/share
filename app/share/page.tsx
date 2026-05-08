"use client";

// @ts-ignore
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { generateShareCode, getShareCodeKey } from "@/lib/share-code";

interface UploadData {
  files: Array<{ id: string; name: string; size: number; url: string }>;
  totalSize: number;
  expiresIn: string;
}

interface ShareCodeSessionEntry {
  uploadSignature: string;
  codes: Record<string, string>;
}

const CODE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours (matches server link expiry)
const MAX_CODE_GENERATION_ATTEMPTS = 20;
const SHARE_CODES_SESSION_KEY = "shareCodes";

function storeCode(url: string): string {
  const entry = {
    url,
    expiresAt: Date.now() + CODE_EXPIRY_MS,
  };

  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
    const code = generateShareCode();
    const storageKey = getShareCodeKey(code);

    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, JSON.stringify(entry));
      return code;
    }
  }

  const code = generateShareCode();
  localStorage.setItem(getShareCodeKey(code), JSON.stringify(entry));
  return code;
}

function createUploadSignature(data: UploadData): string {
  return data.files.map((file) => `${file.id}:${file.url}`).join("|");
}

function loadSessionCodes(data: UploadData): Record<string, string> {
  const raw = sessionStorage.getItem(SHARE_CODES_SESSION_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as ShareCodeSessionEntry;
    if (parsed.uploadSignature !== createUploadSignature(data)) return {};
    return parsed.codes;
  } catch (err) {
    console.error("Invalid share code session cache:", err);
    sessionStorage.removeItem(SHARE_CODES_SESSION_KEY);
    return {};
  }
}

function saveSessionCodes(data: UploadData, codes: Record<string, string>) {
  const entry: ShareCodeSessionEntry = {
    uploadSignature: createUploadSignature(data),
    codes,
  };
  sessionStorage.setItem(SHARE_CODES_SESSION_KEY, JSON.stringify(entry));
}

function isValidStoredCode(code: string, expectedUrl: string): boolean {
  const raw = localStorage.getItem(getShareCodeKey(code));
  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw) as { url?: string; expiresAt?: number };
    if (typeof parsed.expiresAt !== "number" || Date.now() > parsed.expiresAt) {
      localStorage.removeItem(getShareCodeKey(code));
      return false;
    }

    return parsed.url === expectedUrl;
  } catch (err) {
    console.error("Invalid share code local cache:", err);
    localStorage.removeItem(getShareCodeKey(code));
    return false;
  }
}

export default function SharePage() {
  const [uploadData, setUploadData] = useState<UploadData | null>(null);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [codes, setCodes] = useState<Record<string, string>>({});

  useEffect(() => {
    const data = sessionStorage.getItem("uploadData");
    if (!data) {
      window.location.href = "/";
      return;
    }

    let parsed: UploadData;
    try {
      parsed = JSON.parse(data) as UploadData;
    } catch (err) {
      console.error("Invalid uploadData in session storage:", err);
      sessionStorage.removeItem("uploadData");
      window.location.href = "/";
      return;
    }

    setUploadData(parsed);

    // Reuse existing codes from session storage when possible, then fill missing ones.
    const generateCodesAndQRs = async () => {
      const newCodes: Record<string, string> = {};
      const qrCodeMap: Record<string, string> = {};
      const cachedCodes = loadSessionCodes(parsed);

      for (const file of parsed.files) {
        const cachedCode = cachedCodes[file.id];
        const code =
          cachedCode && isValidStoredCode(cachedCode, file.url)
            ? cachedCode
            : storeCode(file.url);

        newCodes[file.id] = code;

        // Generate QR code
        try {
          qrCodeMap[file.id] = await QRCode.toDataURL(file.url);
        } catch (err) {
          console.error("QR generation failed:", err);
        }
      }

      setCodes(newCodes);
      setQrCodes(qrCodeMap);
      saveSessionCodes(parsed, newCodes);
    };

    generateCodesAndQRs();
  }, []);

  if (!uploadData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 sm:mb-8">
          Share it via:
        </h1>

        <div className="space-y-4 sm:space-y-6">
          {uploadData.files.map((file) => (
            <div
              key={file.id}
              className="border rounded-lg p-4 sm:p-6 border-border"
            >
              <h2 className="text-sm sm:text-base mb-6 sm:mb-10 text-muted-foreground truncate">
                {file.name}
              </h2>

              <Accordion type="multiple" defaultValue={[`qr-${file.id}`]}>
                {/* QR Code Accordion - Open by Default */}
                <AccordionItem value={`qr-${file.id}`}>
                  <AccordionTrigger className="hover:no-underline">
                    <span className="text-base sm:text-lg font-semibold">
                      Scan QR Code
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-col items-center gap-4 py-4">
                      {qrCodes[file.id] && (
                        <img
                          src={qrCodes[file.id]}
                          alt={`QR code for ${file.name}`}
                          className="w-40 h-40 sm:w-48 sm:h-48 border-2 border-border rounded"
                        />
                      )}
                      <p className="text-xs sm:text-sm text-muted-foreground text-center">
                        Scan this QR code to download the file directly
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/*
                <AccordionItem
                  className="mt-4 sm:mt-8"
                  value={`code-${file.id}`}
                >
                  <AccordionTrigger className="hover:no-underline">
                    <span className="text-base sm:text-lg font-semibold">
                      Share Code
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-col gap-4 py-4">
                      {codes[file.id] && (
                        <>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-muted p-3 sm:p-4 rounded-md border-2 border-border">
                            <span className="text-xl sm:text-2xl font-bold font-mono text-primary break-all">
                              {codes[file.id]}
                            </span>
                            <Button
                              onClick={() => {
                                navigator.clipboard.writeText(codes[file.id]);
                                alert("Code copied!");
                              }}
                              className="w-full sm:w-auto sm:ml-auto text-sm sm:text-base"
                              size="sm"
                            >
                              Copy
                            </Button>
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            Enter this code at{" "}
                            <a
                              href="/"
                              className="underline hover:text-foreground"
                            >
                              home page
                            </a>{" "}
                            on other device to download the file.
                          </p>
                        </>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
                */}

                {/* Copy URL Accordion - Closed by Default */}
                <AccordionItem
                  className="mt-4 sm:mt-8"
                  value={`url-${file.id}`}
                >
                  <AccordionTrigger className="hover:no-underline">
                    <span className="text-base sm:text-lg font-semibold">
                      Copy URL
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-col gap-4 py-4">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-muted p-3 sm:p-4 rounded-md border-2 border-border">
                        <span className="text-sm sm:text-base font-mono text-primary break-all flex-1">
                          {file.url}
                        </span>
                        <Button
                          onClick={() => {
                            navigator.clipboard.writeText(file.url);
                            alert("URL copied!");
                          }}
                          className="w-full sm:w-auto sm:ml-auto text-sm sm:text-base"
                          size="sm"
                        >
                          Copy
                        </Button>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Share this direct download URL with anyone.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="text-xs sm:text-sm text-muted-foreground mt-6 sm:mt-16">
                link expires in: {uploadData.expiresIn}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Button
            variant="secondary"
            asChild
            className="text-sm sm:text-base"
            size="lg"
          >
            <a
              href="/"
              onClick={() => {
                sessionStorage.removeItem("uploadData");
                sessionStorage.removeItem(SHARE_CODES_SESSION_KEY);
              }}
            >
              Upload More Files
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
