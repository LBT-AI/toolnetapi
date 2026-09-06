"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, Button, Badge, Input, Modal } from "@/shared/components";
import AgentCard from "./AgentCard";
import PairingModal from "./PairingModal";
import AgentDetailModal from "./AgentDetailModal";

export default function LocalAgentsPageClient() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pairingCode, setPairingCode] = useState(null);
  const [pairingExpires, setPairingExpires] = useState(null);
  const [showPairModal, setShowPairModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [commandLoading, setCommandLoading] = useState(false);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch { }
    finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 10000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  const handleAddAgent = async () => {
    try {
      const res = await fetch("/api/agents/pairing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostname: "dashboard",
          platform: "web",
          deviceName: "Web Dashboard"
        })
      });
      if (res.ok) {
        const data = await res.json();
        setPairingCode(data.code);
        setPairingExpires(data.expiresAt);
        setShowPairModal(true);
      }
    } catch { }
  };

  const handleSendCommand = async (agentId, command, payload = {}) => {
    setCommandLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, payload })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Command failed");
      }
      fetchAgents();
    } catch (e) {
      alert(`Command failed: ${e.message}`);
    } finally {
      setCommandLoading(false);
    }
  };

  const handleRevokeAgent = async (agentId) => {
    if (!confirm("Revoke this agent? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
      if (res.ok) fetchAgents();
    } catch { }
  };

  const formatTime = (iso) => {
    if (!iso) return "Never";
    const date = new Date(iso);
    return date.toLocaleString();
  };

  const getStatusBadge = (status) => {
    const variants = {
      online: "success",
      offline: "default",
      revoked: "destructive",
      connecting: "warning"
    };
    return <Badge variant={variants[status] || "default"} size="sm">{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-main">Local Agents</h1>
          <p className="text-sm text-text-muted">
            Manage Windows MITM agents connected to this ToolNet instance
          </p>
        </div>
        <Button variant="primary" onClick={handleAddAgent} loading={commandLoading}>
          <span className="material-symbols-outlined text-[18px] mr-2">add</span>
          Add Local Agent
        </Button>
      </div>

      {/* Agents List */}
      {agents.length === 0 ? (
        <Card padding="lg" className="text-center">
          <div className="flex flex-col items-center gap-4">
            <span className="material-symbols-outlined text-4xl text-text-muted">computer</span>
            <div>
              <h3 className="font-medium text-text-main">No Local Agents connected</h3>
              <p className="text-sm text-text-muted mt-1">
                Click "Add Local Agent" to pair a Windows machine running ToolNet Local Agent
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              formatTime={formatTime}
              getStatusBadge={getStatusBadge}
              onDetail={() => {
                setSelectedAgent(agent);
                setShowDetailModal(true);
              }}
              onCommand={handleSendCommand}
              onRevoke={handleRevokeAgent}
            />
          ))}
        </div>
      )}

      {/* Pairing Modal */}
      {showPairModal && (
        <PairingModal
          code={pairingCode}
          expiresAt={pairingExpires}
          onClose={() => setShowPairModal(false)}
        />
      )}

      {/* Agent Detail Modal */}
      {showDetailModal && selectedAgent && (
        <AgentDetailModal
          agent={selectedAgent}
          onClose={() => { setShowDetailModal(false); setSelectedAgent(null); }}
          onCommand={handleSendCommand}
          onRevoke={handleRevokeAgent}
        />
      )}
    </div>
  );
}

// Need to import CardSkeleton
import { CardSkeleton } from "@/shared/components";