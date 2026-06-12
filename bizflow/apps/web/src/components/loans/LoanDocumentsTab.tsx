"use client";

import { useState } from "react";
import { useLoanDocuments, useUploadLoanDocument } from "@/hooks/useLoans";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { FormField, ModalInput, ModalSelect } from "@/components/ui/Modal";
import { Upload, FileText, Download, Calendar, HardDrive, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

export default function LoanDocumentsTab({ loanId }: { loanId: string }) {
  const { data: documents = [], isLoading } = useLoanDocuments(loanId);
  const uploadDoc = useUploadLoanDocument();

  const [uploading, setUploading] = useState(false);
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("AGREEMENT");
  
  // File state
  const [fileName, setFileName] = useState("");
  const [fileData, setFileData] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [fileSize, setFileSize] = useState<number | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit to 5MB for base64 prototype storage
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size exceeds 5MB limit");
      return;
    }

    setFileName(file.name);
    setMimeType(file.type);
    setFileSize(file.size);
    if (!docName) {
      // Auto-populate document name from filename without extension
      setDocName(file.name.replace(/\.[^/.]+$/, ""));
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFileData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileData) {
      toast.error("Please select a file to upload");
      return;
    }
    if (!docName.trim()) {
      toast.error("Please enter a document name");
      return;
    }

    setUploading(true);
    try {
      await uploadDoc.mutateAsync({
        loanId,
        data: {
          name: docName,
          docType,
          fileData,
          mimeType,
          fileSize,
        },
      });
      toast.success("Document uploaded successfully");
      
      // Reset form
      setDocName("");
      setDocType("OTHER");
      setFileName("");
      setFileData("");
      setMimeType("");
      setFileSize(null);
      
      // Reset file input element
      const fileInput = document.getElementById("loan-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (err: any) {
      toast.error(err.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const formatBytes = (bytes: number | null) => {
    if (bytes === null || bytes === undefined) return "Unknown size";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getDocTypeColor = (type: string) => {
    switch (type) {
      case "AGREEMENT": return "violet" as const;
      case "SANCTION": return "success" as const;
      case "KYC": return "warning" as const;
      case "PAN": return "info" as const;
      case "AADHAAR": return "info" as const;
      case "PROPERTY": return "danger" as const;
      default: return "default" as const;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Upload Column */}
      <div className="lg:col-span-1">
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-primary mb-4">Upload New Document</h3>
            <form onSubmit={handleUpload} className="space-y-4">
              <FormField label="Document Name" required>
                <ModalInput 
                  placeholder="e.g. Sanction Letter, ID Proof" 
                  value={docName} 
                  onChange={e => setDocName(e.target.value)} 
                  required
                />
              </FormField>

              <FormField label="Document Type" required>
                <ModalSelect value={docType} onChange={e => setDocType(e.target.value)}>
                  <option value="AGREEMENT">Loan Agreement</option>
                  <option value="SANCTION">Sanction Letter</option>
                  <option value="KYC">KYC Document</option>
                  <option value="PAN">PAN Card</option>
                  <option value="AADHAAR">Aadhaar Card</option>
                  <option value="PROPERTY">Property Collateral Docs</option>
                  <option value="OTHER">Other Attachment</option>
                </ModalSelect>
              </FormField>

              <FormField label="Select File" required>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-primary/10 border-dashed rounded-xl hover:border-violet-500/30 transition-colors relative cursor-pointer">
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-8 w-8 text-primary/30" />
                    <div className="flex text-xs text-primary/60">
                      <span className="relative rounded-md font-semibold text-violet-400 hover:text-violet-300">
                        Choose a file
                      </span>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-[10px] text-primary/40">PDF, PNG, JPG up to 5MB</p>
                    {fileName && (
                      <p className="text-xs font-mono text-emerald-400 mt-2 truncate max-w-xs">{fileName}</p>
                    )}
                  </div>
                  <input
                    id="loan-file-input"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleFileChange}
                    required
                  />
                </div>
              </FormField>

              <Button 
                type="submit" 
                className="w-full mt-4" 
                disabled={uploading}
                icon={<Upload size={14} />}
              >
                {uploading ? "Uploading..." : "Upload Document"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* List Column */}
      <div className="lg:col-span-2">
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-primary mb-4">Loan Attachments & Documents</h3>
            {isLoading ? (
              <div className="text-center py-12 text-primary/40 text-sm">Loading documents...</div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12 text-primary/40 text-sm">No documents attached to this loan.</div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc: any) => (
                  <div 
                    key={doc.id} 
                    className="flex items-center justify-between p-4.5 rounded-xl bg-primary/5 border border-primary/5 hover:border-primary/10 transition-all"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2.5 rounded-lg bg-violet-500/10 text-violet-400">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-primary truncate max-w-xs sm:max-w-md">{doc.name}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[11px] text-primary/40">
                          <span className="flex items-center gap-1 font-mono">
                            <HardDrive size={10} />
                            {formatBytes(doc.fileSize)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={10} />
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </span>
                          <Badge variant={getDocTypeColor(doc.docType)} className="px-1.5 py-0.2 text-[9px] uppercase">
                            {doc.docType}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <a 
                      href={doc.fileData} 
                      download={doc.name} 
                      className="p-2 rounded-lg bg-surface border border-primary/10 text-primary/60 hover:text-violet-400 hover:border-violet-500/20 hover:bg-violet-500/5 transition-all"
                      title="Download File"
                    >
                      <Download size={14} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
