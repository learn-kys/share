"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { API_ENDPOINTS } from "@/lib/config";

interface UploadData {
  files: Array<{ id: string; name: string; size: number; url: string }>;
  totalSize: number;
  expiresIn: string;
}

const SHARE_CODE_PAGE = "/code";

export default function SharePage() {
  const [uploadData, setUploadData] = useState<UploadData | null>(null);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

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

    const generateCodesAndQRs = async () => {
      const newCodes: Record<string, string> = {};
      const qrCodeMap: Record<string, string> = {};
      let hadError = false;

      await Promise.all(
        parsed.files.map(async (file) => {
          try {
            const response = await fetch(API_ENDPOINTS.SHARE_CODE_FILE, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fileId: file.id }),
            });

            if (!response.ok) {
              throw new Error("Unable to generate share code");
            }

            const payload = (await response.json()) as { code?: string };
            if (!payload.code) {
              throw new Error("Share code response missing code");
            }

            newCodes[file.id] = payload.code;

            const shareUrl = `${window.location.origin}${SHARE_CODE_PAGE}?code=${payload.code}`;
            qrCodeMap[file.id] = await QRCode.toDataURL(shareUrl);
          } catch (err) {
            hadError = true;
            console.error("Share code generation failed:", err);
          }
        }),
      );

      setCodes(newCodes);
      setQrCodes(qrCodeMap);
      setError(
        hadError
          ? "Some share codes could not be generated. Try again later."
          : null,
      );
    };

    void generateCodesAndQRs();
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

        {error && (
          <p className="text-destructive text-xs sm:text-sm mb-4">{error}</p>
        )}

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
                      {qrCodes[file.id] ? (
                        <img
                          src={qrCodes[file.id]}
                          alt={`QR code for ${file.name}`}
                          className="w-40 h-40 sm:w-48 sm:h-48 border-2 border-border rounded bg-white"
                        />
                      ) : (
                        <div className="w-40 h-40 sm:w-48 sm:h-48 border-2 border-border rounded animate-pulse bg-muted" />
                      )}
                      <p className="text-xs sm:text-sm text-muted-foreground text-center">
                        Scan this QR code to open the share code page
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

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
                              href={SHARE_CODE_PAGE}
                              className="underline hover:text-foreground"
                            >
                              the code page
                            </a>{" "}
                            on another device to download the file.
                          </p>
                        </>
                      )}
                      {!codes[file.id] && (
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Generating share code...
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

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
