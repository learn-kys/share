"use client";

import { useCallback, useEffect, useState, DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFileUpload } from "./use-file-upload";

export default function Home() {
  const { error, handleFileSelect, handleFiles, isLoading, uploadProgress } =
    useFileUpload();
  const [isDragging, setIsDragging] = useState(false);

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
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (isLoading) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        await handleFiles(files);
      }
    },
    [handleFiles, isLoading]
  );

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (isLoading) return;
      const files = Array.from(e.clipboardData?.files || []);
      if (files.length > 0) {
        await handleFiles(files);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleFiles, isLoading]);

  return (
    <div
      className={`flex items-center justify-center min-h-screen p-4 sm:p-6 md:p-8 transition-colors ${
        isDragging ? "bg-muted/50 border-2 border-dashed border-primary" : "bg-background"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center gap-6 w-full max-w-2xl pointer-events-none">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center leading-tight text-muted-foreground">
          Share Files, made easy..
        </h1>

        <div className="flex flex-col gap-3 w-full pointer-events-auto">
          <Button
            asChild
            size="2xl"
            className="font-semibold w-full text-base sm:text-lg"
            disabled={isLoading}
          >
            <label htmlFor="file-upload" className="cursor-pointer">
              {isLoading ? "Uploading..." : "Upload File"}
              <Input
                id="file-upload"
                type="file"
                multiple
                onChange={handleFileSelect}
                disabled={isLoading}
                className="hidden"
                accept="*"
              />
            </label>
          </Button>
          
          {!isLoading && (
            <p className="text-center text-xs text-muted-foreground mt-[-4px] mb-2 pointer-events-none">
              or drag & drop / paste anywhere
            </p>
          )}

          {isLoading && (
            <div className="w-full space-y-2">
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-center text-sm sm:text-base font-medium text-muted-foreground">
                {uploadProgress}% uploaded
              </p>
            </div>
          )}

          <Button
            asChild
            size="xl"
            variant="link"
            className="font-semibold w-full text-base sm:text-lg"
            disabled={isLoading}
          >
            <a href="/code">Get by code</a>
          </Button>

          <Button
            asChild
            size="xl"
            variant="link"
            className="font-semibold w-full text-base sm:text-lg"
            disabled={isLoading}
          >
            <a href="/text">Share text</a>
          </Button>
        </div>

        {error && (
          <p className="text-destructive text-xs sm:text-sm text-center">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
