/** "Report" link + dialog, used on posts, threads, resources and chat messages (task 3.4). */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { ReportReason, ReportTarget } from "@forkvlift/shared";
import { Button, Modal, cn, useToast } from "@forkvlift/ui";
import { api } from "../lib/api";
import { useSession } from "./session";

const REASONS: { id: ReportReason; label: string }[] = [
  { id: "spam", label: "Spam or ads" },
  { id: "harassment", label: "Harassment or hate" },
  { id: "malware", label: "Malware or a risky script" },
  { id: "stolen_code", label: "Stolen code or license problem" },
  { id: "other", label: "Something else" },
];

export function ReportButton({ targetType, targetId, label = "Report", className }: { targetType: ReportTarget; targetId: string; label?: string; className?: string }) {
  const { user } = useSession();
  const { show: toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [note, setNote] = useState("");
  const send = useMutation({
    mutationFn: () => api.call("createReport", { body: { targetType, targetId, reason, note } }),
    onSuccess: () => {
      setOpen(false);
      setNote("");
      toast("Thanks. A moderator will take a look.", { tone: "success" });
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Couldn't send the report.", { tone: "danger" }),
  });
  if (!user) return null;

  return (
    <>
      <button type="button" className={cn("text-xs text-muted hover:text-fg hover:underline", className)} onClick={() => setOpen(true)}>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Report to moderators">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold">What's wrong?</legend>
            {REASONS.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm">
                <input type="radio" name="reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} />
                {r.label}
              </label>
            ))}
          </fieldset>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Anything else? (optional)</span>
            <textarea className="w-full rounded-pixel border border-border bg-surface p-2" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={send.isPending}>Send report</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
