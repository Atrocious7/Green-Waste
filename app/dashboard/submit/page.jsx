"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
const MAX_UPLOAD_SIZE_BYTES = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_BYTES ?? 5 * 1024 * 1024);
const IDEMPOTENCY_STORAGE_PREFIX = "greensort-waste-submission:";
function getIdempotencyKey(file, fallback) {
    const fingerprint = `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
    const storageKey = `${IDEMPOTENCY_STORAGE_PREFIX}${fingerprint}`;
    try {
        const storedKey = sessionStorage.getItem(storageKey);
        if (storedKey)
            return { fingerprint, key: storedKey, storageKey };
        const key = crypto.randomUUID();
        sessionStorage.setItem(storageKey, key);
        return { fingerprint, key, storageKey };
    }
    catch {
        if (fallback?.fingerprint === fingerprint) {
            return { ...fallback, storageKey: null };
        }
        return { fingerprint, key: crypto.randomUUID(), storageKey: null };
    }
}
export default function SubmitWastePage() {
    const router = useRouter();
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fallbackIdempotencyKey = useRef(null);
    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);
    const handleFileChange = (event) => {
        const selectedFile = event.target.files?.[0] ?? null;
        if (!selectedFile) {
            setFile(null);
            setPreviewUrl(null);
            return;
        }
        if (!selectedFile.type.startsWith("image/")) {
            setError("Only image files are allowed.");
            setFile(null);
            setPreviewUrl(null);
            return;
        }
        if (selectedFile.size > MAX_UPLOAD_SIZE_BYTES) {
            setError(`Image must be ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)} MB or smaller.`);
            setFile(null);
            setPreviewUrl(null);
            return;
        }
        setError("");
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setFile(selectedFile);
        setPreviewUrl(URL.createObjectURL(selectedFile));
    };
    const handleRemoveFile = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(null);
        setFile(null);
        setError("");
    };
    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!file) {
            setError("Please choose an image before submitting.");
            return;
        }
        setIsSubmitting(true);
        setError("");
        try {
            const formData = new FormData();
            formData.append("file", file);
            const requestKey = getIdempotencyKey(file, fallbackIdempotencyKey.current);
            fallbackIdempotencyKey.current = requestKey;
            const response = await fetch("/api/waste-submissions", {
                method: "POST",
                headers: { "Idempotency-Key": requestKey.key },
                body: formData,
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || "Unable to submit the waste image.");
            }
            if (requestKey.storageKey)
                sessionStorage.removeItem(requestKey.storageKey);
            fallbackIdempotencyKey.current = null;
            toast.success(data?.message || "Waste submitted successfully.");
            router.push("/dashboard");
            router.refresh();
        }
        catch (submissionError) {
            const message = submissionError instanceof Error ? submissionError.message : "Something went wrong.";
            setError(message);
            toast.error(message);
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (<div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4"/>
            Back to dashboard
          </Link>
        </div>

        <Card className="overflow-hidden border-0 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <CardHeader className="space-y-2 border-b border-slate-200 bg-slate-50/80 px-6 py-5">
            <CardTitle className="text-2xl font-bold text-slate-900">Submit Waste</CardTitle>
            <CardDescription className="max-w-xl text-sm text-slate-600">
              Upload an image of segregated household waste for classification. Approved submissions earn Green Coins.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 p-4">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-emerald-200 bg-white p-6 text-center transition hover:border-emerald-300 hover:bg-emerald-50/70">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <UploadCloud className="h-5 w-5"/>
                  </div>
                  <div>
                    <p className="text-base font-medium text-slate-800">Choose an image</p>
                    <p className="text-sm text-slate-500">PNG, JPG, JPEG, WEBP up to {MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)} MB</p>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange}/>
                </label>
              </div>

              {previewUrl && file ? (<div className="space-y-3">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <Image src={previewUrl} alt="Waste preview" width={1200} height={800} unoptimized className="h-72 w-full object-cover"/>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={handleRemoveFile} className="gap-2 text-slate-700">
                      <Trash2 className="h-4 w-4"/>
                      Remove
                    </Button>
                  </div>
                </div>) : null}

              {error ? (<div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>) : null}

              <Button type="submit" className="w-full gap-2" disabled={isSubmitting || !file}>
                {isSubmitting ? (<>
                    <Loader2 className="h-4 w-4 animate-spin"/>
                    Submitting...
                  </>) : (<>
                    <ImagePlus className="h-4 w-4"/>
                    Submit Waste
                  </>)}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>);
}
