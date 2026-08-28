"use client";

import { useState } from "react";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";

export function DocumentUploader({ onVerify }: { onVerify?: (docId: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "verifying" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setStatus("uploading");
    
    // Simulate uploading to storage (in a real app, upload to Supabase Storage first)
    setStatus("verifying");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/verify-document", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Verification failed");
      }

      const data = await res.json();
      setStatus("success");
      if (onVerify) onVerify(data.documentId);
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="border-2 border-dashed border-[#CBD5E1] rounded-lg p-6 bg-white text-center">
      {status === "idle" || status === "error" ? (
        <form onSubmit={handleUpload} className="flex flex-col items-center">
          <Upload className="w-10 h-10 text-[#64748B] mb-3" />
          <h3 className="text-[#0F172A] font-semibold mb-1">Upload KYC/KYB Document</h3>
          <p className="text-sm text-[#64748B] mb-4">PDF, JPG, or PNG</p>
          
          <input
            type="file"
            accept=".pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mb-4 text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
          />
          
          {status === "error" && (
            <div className="flex items-center text-red-600 mb-4 text-sm">
              <AlertCircle className="w-4 h-4 mr-2" />
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={!file}
            className="bg-[#0F172A] text-white px-6 py-2 rounded font-medium disabled:opacity-50"
          >
            Verify with AI
          </button>
        </form>
      ) : status === "success" ? (
        <div className="flex flex-col items-center py-6">
          <CheckCircle className="w-12 h-12 text-emerald-600 mb-3" />
          <h3 className="text-[#0F172A] font-semibold">Document Verified</h3>
          <p className="text-sm text-[#64748B]">Entities match successfully.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center py-6">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <h3 className="text-[#0F172A] font-semibold">
            {status === "uploading" ? "Uploading..." : "Verifying with AI..."}
          </h3>
        </div>
      )}
    </div>
  );
}
