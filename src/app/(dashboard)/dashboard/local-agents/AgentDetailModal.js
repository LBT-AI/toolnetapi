"use client";

import { useState, useEffect } from "react";
import { Card, Button, Badge, Input, Modal } from "@/shared/components";

export default function AgentDetailModal({ agent, onClose, onCommand, onRevoke }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDetails();
  }, [agent.id]);

  const fetchDetails = async () => {
    try {
      const res = await fetch(`/api/agents/${agent.id}`);
      if (res.ok) {
        setDetails(await res.json());
      }
    } catch { }
    finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Agent Details" size="lg">
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Modal>
    );
  }

  const d = details || agent;
  const isOnline = d.status === "online";

  return (
    <Modal isOpen={true} onClose={onClose} title={d.name} size="lg">
      <div className="flex flex-col gap-6">
        {/* Status Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="size-12 flex items-center justify-center rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-primary text-[28px]">computer</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-lg text-text-main">{d.name}</h3>
                <Badge variant={isOnline ? "success" : "default"} size="md">{d.status}</Badge>
              </div>
              <p className="text-sm text-text-muted">{d.hostname} • {d.platform} • v{d.version}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isOnline && (
              <>
                <Button variant="primary" size="sm" onClick={() => onCommand(d.id, "START_MITM")}>
                  <span className="material-symbols-outlined text-[18px] mr-1">play_circle</span>
                  Start MITM
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onCommand(d.id, "STOP_MITM")}>
                  <span className="material-symbols-outlined text-[18px] mr-1">stop_circle</span>
                  Stop MITM
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onCommand(d.id, "TRUST_CERT")}>
                  <span className="material-symbols-outlined text-[18px] mr-1">verified_user</span>
                  Trust Cert
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onCommand(d.id, "RESTART")}>
                  <span className="material-symbols-outlined text-[18px] mr-1">restart_alt</span>
                  Restart Agent
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={() => onRevoke(d.id)} className="text-red-600">
              <span className="material-symbols-outlined text-[18px] mr-1">block</span>
              Revoke Agent
            </Button>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoCard title="Connection" items={[
            { label: "Agent ID", value: d.id, copyable: true },
            { label: "Status", value: d.status },
            { label: "Last Seen", value: d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : "Never" },
            { label: "Connected Since", value: d.createdAt ? new Date(d.createdAt).toLocaleString() : "Unknown" },
          ]} />
          <InfoCard title="MITM Status" items={[
            { label: "MITM Running", value: d.mitmRunning ? "Yes" : "No" },
            { label: "Certificate", value: d.certExists ? "Generated" : "Missing" },
            { label: "Certificate Trusted", value: d.certTrusted ? "Yes" : "No" },
            { label: "Enabled Tools", value: Object.entries(d.enabledTools || {}).filter(([,v]) => v).map(([k]) => k).join(", ") || "None" },
          ]} />
        </div>

        {/* Metadata */}
        {d.metadata && Object.keys(d.metadata).length > 0 && (
          <Card padding="md">
            <h4 className="font-medium text-text-main mb-3">Metadata</h4>
            <pre className="text-xs text-text-muted overflow-x-auto">{JSON.stringify(d.metadata, null, 2)}</pre>
          </Card>
        )}
      </div>
    </Modal>
  );
}

function InfoCard({ title, items }) {
  return (
    <Card padding="md">
      <h4 className="font-medium text-text-main mb-3">{title}</h4>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-text-muted">{item.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-main font-mono break-all">{item.value}</span>
              {item.copyable && (
                <button
                  onClick={() => navigator.clipboard.writeText(item.value)}
                  className="text-text-muted hover:text-primary text-xs"
                  title="Copy"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}