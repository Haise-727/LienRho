import { DocumentUploader } from "@/components/verification/DocumentUploader";

export default function KYCPage() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">KYC Document Verification</h1>
      <DocumentUploader />
    </div>
  );
}
