import { Download, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { ATTACHMENT_ACCEPT, humanSize } from "@/lib/attachments";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { AttachmentMeta } from "./types";

/** The finding's attachments, with download, remove and upload. */
export function AttachmentsSection({
  projectId,
  editingId,
  attachments,
  uploading,
  uploadFile,
  deleteAttachment,
}: {
  projectId: string;
  editingId: string;
  attachments: AttachmentMeta[];
  uploading: boolean;
  uploadFile: (file: File) => void;
  deleteAttachment: (aid: string) => void;
}) {
  return (
    <div className="space-y-2 border-t pt-4">
      <Label className="flex items-center gap-1.5">
        <Paperclip className="size-4" /> Attachments
      </Label>
      {attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No attachments yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
            >
              <div className="min-w-0">
                <div className="truncate">{a.filename}</div>
                <div className="text-xs text-muted-foreground">
                  {humanSize(a.size)} · {a.uploadedByLabel || "—"}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={`/api/projects/${projectId}/findings/${editingId}/attachments/${a.id}`}
                  className={buttonVariants({ variant: "ghost", size: "icon" })}
                  aria-label={`Download ${a.filename}`}
                >
                  <Download className="size-4" />
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteAttachment(a.id)}
                  aria-label={`Remove ${a.filename}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <label className={`${buttonVariants({ variant: "outline", size: "sm" })} cursor-pointer`}>
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {uploading ? "Uploading…" : "Upload file"}
        <input
          type="file"
          className="hidden"
          accept={ATTACHMENT_ACCEPT}
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
            e.target.value = "";
          }}
        />
      </label>
      <p className="text-xs text-muted-foreground">DOCX, PDF, or image files. Max 15 MB.</p>
    </div>
  );
}
