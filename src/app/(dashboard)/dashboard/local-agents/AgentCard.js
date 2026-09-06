"use client";

import { Card, Button, Badge } from "@/shared/components";

export default function AgentCard({ agent, formatTime, getStatusBadge, onDetail, onCommand, onRevoke }) {
  const isOnline = agent.status === "online";
  const lastSeen = agent.lastSeenAt ? new Date(agent.lastSeenAt).getTime() : 0;
  const stale = isOnline && (Date.now() - lastSeen > 60000); // 60s stale

  return (
    <Card padding="md" className="hover:border-primary/30 transition-colors">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 flex items-center justify-center rounded-lg bg-primary/10">
            <span className="material-symbols-outlined text-primary text-[24px]">computer</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-text-main">{agent.name}</h3>
              {getStatusBadge(agent.status)}
              {stale && <Badge variant="warning" size="sm">Stale</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted mt-1">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">memory</span>
                {agent.platform}
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">dns</span>
                {agent.hostname}
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">tag</span>
                v{agent.version}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onDetail(agent)}>
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            Details
          </Button>
          {isOnline && (
            <>
              <Button variant="ghost" size="sm" onClick={() => onCommand(agent.id, "START_MITM")} loading={false}>
                <span className="material-symbols-outlined text-[18px]">play_circle</span>
                Start MITM
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onCommand(agent.id, "STOP_MITM")} loading={false}>
                <span className="material-symbols-outlined text-[18px]">stop_circle</span>
                Stop MITM
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => onRevoke(agent.id)} className="text-red-600 hover:bg-red-500/10">
            <span className="material-symbols-outlined text-[18px]">block</span>
            Revoke
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted mt-2 pt-2 border-t border-border/50">
        <span>Created: {formatTime(agent.createdAt)}</span>
        <span>Last seen: {formatTime(agent.lastSeenAt)}</span>
        {agent.revokedAt && <span className="text-red-600">Revoked: {formatTime(agent.revokedAt)}</span>}
      </div>
    </Card>
  );
}