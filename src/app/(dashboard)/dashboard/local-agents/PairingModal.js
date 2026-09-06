"use client";

import { Card, Button, Input } from "@/shared/components";

export default function PairingModal({ code, expiresAt, onClose }) {
  const copyCode = () => {
    navigator.clipboard.writeText(code);
  };

  const timeLeft = expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 0;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 flex w-full max-w-md flex-col gap-4 rounded-xl border border-border bg-surface p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-text-main">Pair Local Agent</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-main">
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>

        <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <span className="material-symbols-outlined text-blue-500 text-[24px] mt-0.5">info</span>
          <div className="text-sm text-text-muted">
            <p className="font-medium">Run this command on the Windows machine:</p>
            <pre className="mt-2 p-3 bg-surface rounded font-mono text-xs overflow-x-auto">
{`toolnet-agent pair --server https://api.toolnet.tech`}
            </pre>
            <p className="mt-2">Then enter the pairing code below:</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-main w-24">Pairing Code</span>
            <div className="flex-1 flex items-center gap-2">
              <Input
                readOnly
                value={code}
                className="font-mono text-center text-lg tracking-widest bg-surface/50"
              />
              <Button variant="ghost" size="sm" onClick={copyCode}>
                <span className="material-symbols-outlined text-[18px]">content_copy</span>
              </Button>
            </div>
          </label>
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            <span>Expires in {minutes}:{seconds.toString().padStart(2, "0")}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="primary" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}