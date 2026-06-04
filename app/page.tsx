"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFileUpload } from "./use-file-upload";

export default function Home() {
  const { error, handleFileSelect, isLoading, uploadProgress } =
    useFileUpload();

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4 sm:p-6 md:p-8">
      <div className="flex flex-col items-center gap-6 w-full max-w-2xl">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center leading-tight text-muted-foreground">
          Share Files, made easy..
        </h1>

        <div className="flex flex-col gap-3 w-full">
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
