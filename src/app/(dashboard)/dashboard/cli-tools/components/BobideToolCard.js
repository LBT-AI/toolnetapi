"use client";

import { useState, useEffect, useRef } from "react";
import { Card, Button, ModelSelectModal, ManualConfigModal } from "@/shared/components";
import Image from "next/image";
import BaseUrlSelect from "./BaseUrlSelect";
import ApiKeySelect from "./ApiKeySelect";
import { matchKnownEndpoint } from "./cliEndpointMatch";

const CLOUD_URL = process.env.NEXT_PUBLIC_CLOUD_URL;

export default function BobideToolCard({
  tool,
  isExpanded,
  onToggle,
  baseUrl,
  hasActiveProviders,
  apiKeys,
  activeProviders,
  cloudEnabled,
  initialStatus,
  tunnelEnabled,
  tunnelPublicUrl,
  tailscaleEnabled,
  tailscaleUrl,
}) {
  const [bobStatus, setBobStatus] = useState(initialStatus || null);
  const [checkingBob, setCheckingBob] = useState(false);
  const [applying, setApplying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedApiKey, setSelectedApiKey] = useState("");
  const [modelList, setModelList] = useState([]);
  const [modelInput, setModelInput] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modelAliases, setModelAliases] = useState({});
  const [showManualConfigModal, setShowManualConfigModal] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const hasInitializedModel = useRef(false);

  const getConfigStatus = () => {
    if (!bobStatus?.installed) return null;
    const currentConfig = bobStatus.settings?.customModels?.find((m) =>
      m.id?.startsWith("custom:ToolNet API") || m.name?.includes("ToolNet API")
    );
    const providerConfig = bobStatus.settings?.providers?.["toolnetapi"] || bobStatus.settings?.providers?.["toolnet"];
    const targetUrl = currentConfig?.baseUrl || providerConfig?.baseUrl || bobStatus.settings?.["bob.api.baseUrl"];

    if (!targetUrl) return "not_configured";
    return matchKnownEndpoint(targetUrl, {
      tunnelPublicUrl,
      tailscaleUrl,
      cloudUrl: cloudEnabled ? CLOUD_URL : null,
    })
      ? "configured"
      : "other";
  };

  const configStatus = getConfigStatus();

  const fetchModelAliases = useCallback(async () => {
    try {
      const res = await fetch("/api/models/alias");
      const data = await res.json();
      if (res.ok) setModelAliases(data.aliases || {});
    } catch (error) {
      console.log("Error fetching model aliases:", error);
    }
  }, []);

  const checkBobStatus = useCallback(async () => {
    setCheckingBob(true);
    try {
      const res = await fetch("/api/cli-tools/bobide-settings");
      const data = await res.json();
      setBobStatus(data);
    } catch (error) {
      setBobStatus({ installed: false, error: error.message });
    } finally {
      setCheckingBob(false);
    }
  }, []);

  useEffect(() => {
    if (apiKeys?.length > 0 && !selectedApiKey) {
      setSelectedApiKey(apiKeys[0].key);
    }
  }, [apiKeys, selectedApiKey]);

  useEffect(() => {
    if (initialStatus) setBobStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    if (isExpanded) {
      if (!bobStatus) checkBobStatus();
      fetchModelAliases();
    }
  }, [isExpanded, bobStatus, checkBobStatus, fetchModelAliases]);

  // Pre-fill model list from existing config
  useEffect(() => {
    if (bobStatus?.installed && !hasInitializedModel.current) {
      hasInitializedModel.current = true;
      const existingModels = (bobStatus.settings?.customModels || [])
        .filter((m) => m.id?.startsWith("custom:ToolNet API") || m.name?.includes("ToolNet API"))
        .sort((a, b) => (a.index || 0) - (b.index || 0))
        .map((m) => m.model);

      if (existingModels.length > 0) {
        setModelList(existingModels);
      } else if (bobStatus.settings?.providers?.["toolnetapi"]?.models?.length > 0) {
        setModelList(bobStatus.settings.providers["toolnetapi"].models);
      } else if (tool?.defaultModels?.length > 0) {
        setModelList(tool.defaultModels.map((m) => m.defaultValue || m.id));
      }
    }
  }, [bobStatus, tool]);

  const getEffectiveBaseUrl = () => {
    const url = customBaseUrl || `${baseUrl}/v1`;
    return url.endsWith("/v1") ? url : `${url}/v1`;
  };

  const getDisplayUrl = () => customBaseUrl || `${baseUrl}/v1`;

  const handleApply = async () => {
    setApplying(true);
    setMessage(null);
    try {
      const keyToUse =
        selectedApiKey && selectedApiKey.trim()
          ? selectedApiKey
          : !cloudEnabled
          ? "sk_toolnetapi"
          : selectedApiKey;

      const res = await fetch("/api/cli-tools/bobide-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: getEffectiveBaseUrl(),
          apiKey: keyToUse,
          models: modelList.length > 0 ? modelList : (modelInput ? [modelInput] : ["bob-architect-pro"]),
          activeModel: modelList[0] || modelInput || "bob-architect-pro",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "IBM Bob settings applied successfully!" });
        checkBobStatus();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to apply settings" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setApplying(false);
    }
  };

  const handleReset = async () => {
    setRestoring(true);
    setMessage(null);
    try {
      const res = await fetch("/api/cli-tools/bobide-settings", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "IBM Bob settings reset successfully!" });
        setModelList([]);
        checkBobStatus();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to reset settings" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setRestoring(false);
    }
  };

  const handleAddModel = (modelValue) => {
    if (!modelValue || !modelValue.trim()) return;
    const trimmed = modelValue.trim();
    if (!modelList.includes(trimmed)) {
      setModelList((prev) => [...prev, trimmed]);
    }
    setModelInput("");
  };

  const handleRemoveModel = (index) => {
    setModelList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMakeDefault = (index) => {
    if (index === 0) return;
    setModelList((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      return [item, ...copy];
    });
  };

  const getManualConfigs = () => {
    const keyToUse =
      selectedApiKey && selectedApiKey.trim()
        ? selectedApiKey
        : !cloudEnabled
        ? "sk_toolnetapi"
        : "<API_KEY_FROM_DASHBOARD>";
    const effectiveUrl = getEffectiveBaseUrl();
    const effectiveModels = modelList.length > 0 ? modelList : ["bob-architect-pro", "claude-sonnet-4-6"];

    return [
      {
        filename: "~/.bob/settings.json",
        content: JSON.stringify(
          {
            "bob.api.baseUrl": effectiveUrl,
            "bob.api.apiKey": keyToUse,
            "bob.defaultModel": effectiveModels[0],
            customModels: effectiveModels.map((m, i) => ({
              id: `custom:ToolNet API-${i}`,
              name: `ToolNet API - ${m}`,
              model: m,
              baseUrl: effectiveUrl,
              apiKey: keyToUse,
              provider: "openai",
              index: i,
              maxOutputTokens: 131072,
            })),
            providers: {
              toolnetapi: {
                type: "openai-compatible",
                baseUrl: effectiveUrl,
                apiKey: keyToUse,
                models: effectiveModels,
                defaultModel: effectiveModels[0],
              },
            },
          },
          null,
          2
        ),
      },
      {
        filename: "~/.bob/mcp_settings.json",
        content: JSON.stringify(
          {
            mcpServers: {
              toolnetapi: {
                url: `${effectiveUrl}/mcp`,
                headers: {
                  Authorization: `Bearer ${keyToUse}`,
                },
              },
            },
          },
          null,
          2
        ),
      },
    ];
  };

  return (
    <Card padding="xs" className="overflow-hidden">
      <div
        className="flex items-start justify-between gap-3 hover:cursor-pointer sm:items-center"
        onClick={onToggle}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="size-8 flex items-center justify-center shrink-0">
            <Image
              src="/providers/bobide.png"
              alt={tool.name}
              width={32}
              height={32}
              className="size-8 object-contain rounded-lg"
              sizes="32px"
              onError={(e) => {
                e.target.style.display = "none";
              }}
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="font-medium text-sm">{tool.name}</h3>
              {configStatus === "configured" && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-500/10 text-green-600 dark:text-green-400 rounded-full">
                  Connected
                </span>
              )}
              {configStatus === "not_configured" && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-full">
                  Not configured
                </span>
              )}
              {configStatus === "other" && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full">
                  Other
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted truncate">{tool.description}</p>
          </div>
        </div>
        <span
          className={`material-symbols-outlined text-text-muted text-[20px] transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border flex flex-col gap-4">
          {checkingBob && (
            <div className="flex items-center gap-2 text-text-muted">
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              <span>Checking IBM Bob...</span>
            </div>
          )}

          {!checkingBob && bobStatus && !bobStatus.installed && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-yellow-500">warning</span>
                  <div className="flex-1">
                    <p className="font-medium text-yellow-600 dark:text-yellow-400">
                      IBM Bob not detected locally
                    </p>
                    <p className="text-sm text-text-muted">
                      Manual configuration is available if ToolNet API is running on a remote host or server.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-9">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowManualConfigModal(true)}
                    className="!bg-yellow-500/20 !border-yellow-500/40 !text-yellow-700 dark:!text-yellow-300 hover:!bg-yellow-500/30"
                  >
                    <span className="material-symbols-outlined text-[18px] mr-1">content_copy</span>
                    Manual Config
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowInstallGuide(!showInstallGuide)}
                  >
                    <span className="material-symbols-outlined text-[18px] mr-1">
                      {showInstallGuide ? "expand_less" : "help"}
                    </span>
                    {showInstallGuide ? "Hide" : "How to Install"}
                  </Button>
                </div>
              </div>

              {showInstallGuide && (
                <div className="p-4 bg-surface border border-border rounded-lg">
                  <h4 className="font-medium mb-3 text-sm">Installation Guide for IBM Bob</h4>
                  <p className="text-xs text-text-muted mb-2">
                    Download and install IBM Bob IDE from the official website:
                  </p>
                  <a
                    href="https://ibm.com/bob"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary underline block mb-3"
                  >
                    https://ibm.com/bob
                  </a>
                  <p className="text-xs text-text-muted mb-1">Bob config directories:</p>
                  <code className="block p-2 bg-black/5 dark:bg-white/5 rounded text-xs font-mono mb-2">
                    ~/.bob/settings.json (or ~/.bobide/settings.json)
                  </code>
                </div>
              )}
            </div>
          )}

          {!checkingBob && bobStatus?.installed && (
            <>
              {tool.notes?.length > 0 && (
                <div className="flex flex-col gap-2">
                  {tool.notes.map((note, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-2 rounded p-2 text-xs ${
                        note.type === "warning"
                          ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      <span className="material-symbols-outlined mt-0.5 text-[14px]">
                        {note.type === "warning" ? "warning" : "info"}
                      </span>
                      <span>{note.text}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr] sm:items-center sm:gap-2">
                  <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">
                    Select Endpoint
                  </span>
                  <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">
                    arrow_forward
                  </span>
                  <BaseUrlSelect
                    value={customBaseUrl || getDisplayUrl()}
                    onChange={setCustomBaseUrl}
                    requiresExternalUrl={tool.requiresExternalUrl}
                    tunnelEnabled={tunnelEnabled}
                    tunnelPublicUrl={tunnelPublicUrl}
                    tailscaleEnabled={tailscaleEnabled}
                    tailscaleUrl={tailscaleUrl}
                  />
                </div>

                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
                  <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">
                    API Key
                  </span>
                  <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">
                    arrow_forward
                  </span>
                  <ApiKeySelect
                    value={selectedApiKey}
                    onChange={setSelectedApiKey}
                    apiKeys={apiKeys}
                    cloudEnabled={cloudEnabled}
                  />
                </div>

                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
                  <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">
                    Add Model
                  </span>
                  <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">
                    arrow_forward
                  </span>
                  <div className="relative w-full min-w-0">
                    <input
                      type="text"
                      value={modelInput}
                      onChange={(e) => setModelInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddModel(modelInput);
                        }
                      }}
                      placeholder="provider/model-id or select"
                      className="w-full min-w-0 pl-2 pr-7 py-2 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 sm:py-1.5"
                    />
                    {modelInput && (
                      <button
                        onClick={() => setModelInput("")}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-red-500 rounded transition-colors"
                        title="Clear"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleAddModel(modelInput)}
                      disabled={!modelInput}
                    >
                      Add
                    </Button>
                    <button
                      onClick={() => setModalOpen(true)}
                      disabled={!activeProviders?.length}
                      className={`rounded border px-2 py-2 text-xs transition-colors sm:py-1.5 whitespace-nowrap ${
                        activeProviders?.length
                          ? "bg-surface border-border text-text-main hover:border-primary cursor-pointer"
                          : "opacity-50 cursor-not-allowed border-border"
                      }`}
                    >
                      Browse
                    </button>
                  </div>
                </div>

                {/* Configured Models List */}
                {modelList.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5 rounded-lg border border-border bg-surface/30 p-2.5">
                    <div className="flex items-center justify-between text-xs text-text-muted">
                      <span className="font-semibold text-text-main">
                        Models to configure ({modelList.length})
                      </span>
                      <span className="text-[10px]">Top model is default</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {modelList.map((m, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
                            idx === 0 ? "bg-primary/10 border border-primary/20" : "bg-surface border border-border/50"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {idx === 0 ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-primary text-white">
                                Default
                              </span>
                            ) : (
                              <span className="text-[10px] text-text-muted font-mono">{idx + 1}</span>
                            )}
                            <span className="font-mono truncate">{m}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {idx > 0 && (
                              <button
                                onClick={() => handleMakeDefault(idx)}
                                className="text-[10px] text-primary hover:underline px-1"
                                title="Set as default"
                              >
                                Set default
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveModel(idx)}
                              className="text-text-muted hover:text-red-500 p-0.5 rounded"
                              title="Remove"
                            >
                              <span className="material-symbols-outlined text-[14px]">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {message && (
                <div
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                    message.type === "success"
                      ? "bg-green-500/10 text-green-600"
                      : "bg-red-500/10 text-red-600"
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {message.type === "success" ? "check_circle" : "error"}
                  </span>
                  <span>{message.text}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApply}
                  disabled={modelList.length === 0 && !modelInput}
                  loading={applying}
                >
                  <span className="material-symbols-outlined text-[14px] mr-1">save</span>
                  Apply
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={restoring || !bobStatus?.hasToolNetAPI}
                  loading={restoring}
                >
                  <span className="material-symbols-outlined text-[14px] mr-1">restore</span>
                  Reset
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowManualConfigModal(true)}
                >
                  <span className="material-symbols-outlined text-[14px] mr-1">content_copy</span>
                  Manual Config
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {modalOpen && (
        <ModelSelectModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSelect={(model) => {
            handleAddModel(model.value);
            setModalOpen(false);
          }}
          selectedModel={modelList[0] || ""}
          activeProviders={activeProviders}
          modelAliases={modelAliases}
          title="Select Model for IBM Bob"
        />
      )}

      <ManualConfigModal
        isOpen={showManualConfigModal}
        onClose={() => setShowManualConfigModal(false)}
        title="IBM Bob - Manual Configuration"
        configs={getManualConfigs()}
      />
    </Card>
  );
}
