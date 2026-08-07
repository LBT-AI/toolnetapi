"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, Button, Input, Select, ConfirmModal, Loading } from "@/shared/components";
import { classifyModelToGroup, ALIBABA_GROUP_NAMES } from "@/shared/constants/alibabaModelGroup";

const GROUP_NAMES = ALIBABA_GROUP_NAMES;

const GROUP_META = {
  light: { icon: "bolt", desc: "Fast / cheap models for everyday chat", color: "text-sky-500" },
  code: { icon: "code", desc: "Coding models", color: "text-emerald-500" },
  reasoning: { icon: "psychology", desc: "Reasoning / thinking models", color: "text-violet-500" },
  vision: { icon: "image", desc: "Vision / multimodal models", color: "text-amber-500" },
  fallback: { icon: "shield", desc: "Last-resort models when others fail", color: "text-rose-500" },
};

export default function AlibabaModelPoolPage() {
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState("");
  const [pools, setPools] = useState([]);
  const [status, setStatus] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelFetchError, setModelFetchError] = useState("");
  const [savingGroup, setSavingGroup] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const [defaults, setDefaults] = useState({ quotaLimit: 1000000, quotaPeriodDays: 30 });
  const [notice, setNotice] = useState("");

  // Load alims-intl connections once on mount (`.then` chain so no synchronous setState in the effect)
  useEffect(() => {
    let active = true;
    fetch("/api/providers")
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!active || !data) return;
        const conns = (data.connections || []).filter(c => c.provider === "alims-intl");
        setConnections(conns);
        setSelectedConnection(prev => prev || conns[0]?.id || "");
      })
      .catch(error => console.error("Error fetching connections:", error))
      .finally(() => { if (active) setLoadingConnections(false); });
    return () => { active = false; };
  }, []);

  const fetchPools = useCallback(async (connectionId) => {
    if (!connectionId) return;
    try {
      const [poolsRes, statusRes] = await Promise.all([
        fetch(`/api/alibaba-model-pool?connectionId=${connectionId}`),
        fetch(`/api/alibaba-model-pool?connectionId=${connectionId}&status=1`),
      ]);
      const poolsData = await poolsRes.json();
      const statusData = statusRes.ok ? await statusRes.json() : { status: null };
      setPools(poolsData.pools || []);
      setStatus(statusData.status || null);
      if (poolsData.defaults) setDefaults(poolsData.defaults);
    } catch (error) {
      console.error("Error fetching pools:", error);
    }
  }, []);

  const fetchAvailableModels = useCallback(async (connectionId) => {
    if (!connectionId) return;
    setLoadingModels(true);
    setModelFetchError("");
    try {
      const res = await fetch(`/api/providers/${connectionId}/models`);
      if (!res.ok) {
        setModelFetchError(`Failed to fetch models (${res.status})`);
        setAvailableModels([]);
        return;
      }
      const data = await res.json();
      const models = (data.models || []).map(m => m.id || m.model || m).filter(Boolean);
      setAvailableModels([...new Set(models)]);
    } catch (error) {
      console.error("Error fetching models:", error);
      setModelFetchError("Failed to fetch model list");
      setAvailableModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    if (selectedConnection) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchPools(selectedConnection);
      fetchAvailableModels(selectedConnection);
    }
  }, [selectedConnection, fetchPools, fetchAvailableModels]);

  const handleSaveGroup = async (groupName, models, quotaLimit, quotaPeriodDays) => {
    setSavingGroup(groupName);
    setNotice("");
    try {
      const res = await fetch("/api/alibaba-model-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: selectedConnection,
          groupName,
          models,
          quotaLimit,
          quotaPeriodDays,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setNotice(`Failed to save "${groupName}": ${err.error || res.status}`);
        return;
      }
      await fetchPools(selectedConnection);
    } catch (error) {
      setNotice(`Failed to save "${groupName}": ${error.message}`);
    } finally {
      setSavingGroup("");
    }
  };

  const handleDeleteGroup = (pool) => {
    setConfirmState({
      title: `Delete "${pool.groupName}" group`,
      message: `Remove this group (${pool.models.length} models) from the connection?`,
      confirmText: "Delete",
      onConfirm: async () => {
        setConfirmState(null);
        try {
          const res = await fetch(`/api/alibaba-model-pool?id=${pool.id}`, { method: "DELETE" });
          if (!res.ok) {
            const err = await res.json();
            setNotice(`Failed to delete: ${err.error || res.status}`);
            return;
          }
          await fetchPools(selectedConnection);
        } catch (error) {
          setNotice(`Failed to delete: ${error.message}`);
        }
      },
    });
  };

  const handleResetCooldowns = async () => {
    try {
      const res = await fetch(`/api/alibaba-model-pool?connectionId=${selectedConnection}&action=reset-cooldowns`, { method: "PATCH" });
      if (!res.ok) {
        const err = await res.json();
        setNotice(`Failed to reset: ${err.error || res.status}`);
        return;
      }
      setNotice("Cooldowns reset — all models available again");
      await fetchPools(selectedConnection);
    } catch (error) {
      setNotice(`Failed to reset: ${error.message}`);
    }
  };

  if (loadingConnections) {
    return (
      <div className="flex flex-col gap-6 px-1 sm:px-0">
        <Card><div className="py-16 flex justify-center"><Loading /></div></Card>
      </div>
    );
  }

  const connectionName = connections.find(c => c.id === selectedConnection)?.name || selectedConnection.slice(0, 8);

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-text-main flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">swap_driving_apps</span>
            Alibaba Model Pool
          </h2>
          <p className="text-sm text-text-muted mt-1">
            One Alibaba Studio key, 223 models with individual quotas. Group models and the gateway
            rotates across them — skipping models that are over quota, on cooldown, or just errored.
          </p>
          <ul className="text-sm text-text-muted mt-2 flex flex-col gap-1">
            <li><span className="font-medium text-text-main">Selection</span> — skips over-quota & recently-errored models, then round-robins the rest</li>
            <li><span className="font-medium text-text-main">Auto fallback</span> — quota / rate-limit / model-unavailable errors rotate to the next model</li>
            <li><span className="font-medium text-text-main">Usage</span> — recorded per model, not just per key</li>
          </ul>
        </div>
      </div>

      {/* Connection selector */}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          <div className="flex-1">
            <Select
              label="Alibaba Studio Connection"
              value={selectedConnection}
              onChange={(e) => setSelectedConnection(e.target.value)}
              options={connections.map(c => ({ value: c.id, label: c.name || c.email || c.id }))}
              placeholder="Select a connection"
            />
          </div>
          <Button variant="outline" icon="refresh" onClick={() => { fetchPools(selectedConnection); fetchAvailableModels(selectedConnection); }}>
            Refresh
          </Button>
          <Button variant="secondary" icon="restart_alt" onClick={handleResetCooldowns}>
            Reset cooldowns
          </Button>
        </div>
        {connections.length === 0 && (
          <p className="text-sm text-text-muted mt-3">
            No Alibaba Studio (alims-intl) connections found. Add one in{" "}
            <span className="font-medium text-text-main">Providers</span> first.
          </p>
        )}
        {notice && (
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-3">{notice}</p>
        )}
      </Card>

      {/* Model picker from the live /v1/models list */}
      <Card padding="sm">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-main flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-primary">dataset</span>
              Models on {connectionName} ({availableModels.length})
            </p>
            {modelFetchError && <p className="text-xs text-amber-600 dark:text-amber-400">{modelFetchError} — you can still type model ids manually below.</p>}
          </div>
          {loadingModels && <span className="material-symbols-outlined animate-spin text-text-muted text-[18px]">progress_activity</span>}
        </div>
        {availableModels.length > 0 && (
          <p className="text-xs text-text-muted mb-3">
            Click a model to add it to the active group list. The suggested group is auto-detected from the model name.
          </p>
        )}
      </Card>

      {/* Group cards */}
      <div className="flex flex-col gap-4">
        {GROUP_NAMES.map((groupName) => {
          const pool = pools.find(p => p.groupName === groupName) || null;
          const meta = GROUP_META[groupName];
          return (
            <GroupCard
              key={pool ? `pool-${pool.id}` : `empty-${groupName}`}
              groupName={groupName}
              icon={meta.icon}
              desc={meta.desc}
              color={meta.color}
              pool={pool}
              status={status?.[groupName] || null}
              availableModels={availableModels}
              defaults={defaults}
              saving={savingGroup === groupName}
              onSave={handleSaveGroup}
              onDelete={pool ? () => handleDeleteGroup(pool) : null}
            />
          );
        })}
      </div>

      {/* How to call */}
      <Card padding="sm">
        <p className="text-xs text-text-muted">
          <span className="font-medium text-text-main">Usage:</span> call any pool group as a model name, e.g.{" "}
          <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-[11px] dark:bg-white/10">alims-intl/code</code> or{" "}
          <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-[11px] dark:bg-white/10">alims-intl/light</code>, or add it to a Combo like any other model. Requests rotate across the group models automatically.
        </p>
      </Card>

      <ConfirmModal
        isOpen={!!confirmState}
        onClose={() => setConfirmState(null)}
        onConfirm={confirmState?.onConfirm}
        title={confirmState?.title || "Confirm"}
        message={confirmState?.message}
        confirmText={confirmState?.confirmText}
        variant="danger"
      />
    </div>
  );
}

function GroupCard({ groupName, icon, desc, color, pool, status, availableModels, defaults, saving, onSave, onDelete }) {
  // Remounted by parent via `key` whenever `pool` (or the empty-group state) changes,
  // so initial state always matches the pool without a state-sync effect.
  const [modelsText, setModelsText] = useState(pool?.models?.join("\n") || "");
  const [quotaLimit, setQuotaLimit] = useState(pool?.quotaLimit ?? defaults.quotaLimit ?? 1000000);
  const [quotaPeriodDays, setQuotaPeriodDays] = useState(pool?.quotaPeriodDays ?? defaults.quotaPeriodDays ?? 30);
  const [expanded, setExpanded] = useState(false);

  const models = modelsText.split("\n").map(m => m.trim()).filter(Boolean);

  const addModel = (modelId) => {
    if (models.includes(modelId)) return;
    setModelsText(modelsText ? `${modelsText}\n${modelId}` : modelId);
  };

  const modelCount = pool?.models?.length ?? 0;
  const statusModels = status?.models || [];

  return (
    <Card padding="sm" className="group">
      <div className="flex min-w-0 flex-col gap-3">
        {/* Header row */}
        <div className="flex min-w-0 items-center gap-3">
          <div className={`size-8 rounded-lg bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0 ${color}`}>
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text-main capitalize">{groupName}</p>
            <p className="text-xs text-text-muted truncate">{desc}</p>
          </div>
          {modelCount > 0 && (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              {modelCount} model{modelCount === 1 ? "" : "s"}
            </span>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="shrink-0 p-1 rounded text-text-muted hover:bg-black/5 dark:hover:bg-white/10 hover:text-primary transition-colors"
            title={expanded ? "Collapse" : "Expand"}
          >
            <span className="material-symbols-outlined text-[18px] transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
              expand_more
            </span>
          </button>
        </div>

        {/* Compact model list when collapsed */}
        {!expanded && (
          <div className="flex flex-wrap items-center gap-1">
            {modelCount === 0 ? (
              <span className="text-xs text-text-muted italic">Empty — expand to add models</span>
            ) : (
              pool.models.slice(0, 6).map((m) => {
                const st = statusModels.find(s => s.id === m);
                const unavailable = st && !st.available;
                return (
                  <span
                    key={m}
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] ${
                      unavailable
                        ? "bg-rose-500/10 text-rose-500 line-through"
                        : "bg-black/5 text-text-muted dark:bg-white/5"
                    }`}
                    title={unavailable ? (st?.overQuota ? `over quota (${formatTokens(st.quotaUsed)}/${formatTokens(st.quotaLimit)})` : `cooldown until ${st?.cooldownUntil}`) : `${formatTokens(st?.quotaUsed || 0)}/${formatTokens(st?.quotaLimit || 0)}`}
                  >
                    {m}
                  </span>
                );
              })
            )}
            {modelCount > 6 && <span className="text-[10px] text-text-muted">+{modelCount - 6} more</span>}
          </div>
        )}

        {/* Expanded editor */}
        {expanded && (
          <div className="flex flex-col gap-3 border-t border-border-subtle pt-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Models (one per line)</label>
              <textarea
                value={modelsText}
                onChange={(e) => setModelsText(e.target.value)}
                rows={5}
                spellCheck={false}
                placeholder={"qwen3-coder-plus\nqwen3-coder-flash\n..."}
                className="w-full px-3 py-2 text-sm font-mono text-text-main bg-surface-2 border border-transparent rounded-[10px] focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/40 resize-y"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Per-model token quota"
                type="number"
                value={quotaLimit}
                onChange={(e) => setQuotaLimit(e.target.value)}
                hint="Skip a model once its usage reaches this. 0 = unlimited."
              />
              <Input
                label="Quota period (days)"
                type="number"
                value={quotaPeriodDays}
                onChange={(e) => setQuotaPeriodDays(e.target.value)}
                hint="Rolling window over which usage counts toward the quota."
              />
            </div>

            {/* Quick-add from fetched models */}
            {availableModels.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">Add from model list</label>
                <div className="flex max-h-32 flex-wrap items-center gap-1 overflow-y-auto">
                  {availableModels.map((m) => {
                    const suggested = classifyModelToGroup(m);
                    const matchesGroup = suggested === groupName || (groupName === "fallback" && !suggested);
                    const added = models.includes(m);
                    return (
                      <button
                        key={m}
                        onClick={() => addModel(m)}
                        disabled={added}
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors ${
                          added
                            ? "bg-primary/10 text-primary"
                            : matchesGroup
                              ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                              : "bg-black/5 text-text-muted hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
                        }`}
                        title={suggested ? `suggested group: ${suggested}` : "no suggested group"}
                      >
                        {added && <span className="material-symbols-outlined text-[12px]">check</span>}
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Save / delete */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => onSave(groupName, models, parseInt(quotaLimit, 10) || 0, parseInt(quotaPeriodDays, 10) || 0)}
                disabled={models.length === 0}
                loading={saving}
                icon="save"
                size="sm"
              >
                Save group
              </Button>
              {onDelete && (
                <Button variant="danger" icon="delete" size="sm" onClick={onDelete}>
                  Delete
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function formatTokens(n) {
  if (n == null) return "0";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}
