"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import { Modal, Button, Input, Badge } from "@/shared/components";
import { translate } from "@/i18n/runtime";

/**
 * Freebuff Multi-Account Auth Modal
 * Allows connecting multiple Freebuff accounts one by one via:
 * 1. Web Browser Login (OAuth device flow)
 * 2. Auto-Import from local Freebuff CLI credentials
 * 3. Manual Auth Token / JSON credentials import
 */
export default function FreebuffAuthModal({ isOpen, onSuccess, onClose, providerInfo }) {
  const [activeTab, setActiveTab] = useState("browser"); // "browser" | "autoImport" | "manual"
  const [accountLabel, setAccountLabel] = useState("");

  // Browser login state
  const [isGeneratingUrl, setIsGeneratingUrl] = useState(false);
  const [loginData, setLoginData] = useState(null); // { loginUrl, fingerprintId, fingerprintHash, expiresAt }
  const [isPolling, setIsPolling] = useState(false);
  const [pollError, setPollError] = useState(null);
  const [browserSuccessUser, setBrowserSuccessUser] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const pollingRef = useRef(null);

  // Auto-import state
  const [loadingAutoImport, setLoadingAutoImport] = useState(false);
  const [detectedAccounts, setDetectedAccounts] = useState([]);
  const [autoImportError, setAutoImportError] = useState(null);
  const [importingProfile, setImportingProfile] = useState(null);
  const [autoImportSuccess, setAutoImportSuccess] = useState(null);

  // Manual import state
  const [manualToken, setManualToken] = useState("");
  const [manualLabel, setManualLabel] = useState("");
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [manualError, setManualError] = useState(null);
  const [manualSuccess, setManualSuccess] = useState(null);

  // Reset state when modal closes
  const cleanupPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPolling(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      cleanupPolling();
      setLoginData(null);
      setBrowserSuccessUser(null);
      setPollError(null);
      setAutoImportSuccess(null);
      setManualSuccess(null);
      setManualError(null);
      setManualToken("");
      setManualLabel("");
      setAccountLabel("");
    }
  }, [isOpen, cleanupPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupPolling();
  }, [cleanupPolling]);

  // Start Browser Login Flow: generate new login URL
  const handleStartBrowserLogin = async () => {
    cleanupPolling();
    setIsGeneratingUrl(true);
    setPollError(null);
    setBrowserSuccessUser(null);

    try {
      const res = await fetch("/api/oauth/freebuff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (!res.ok || !data.loginUrl) {
        throw new Error(data.error || "Không thể tạo link đăng nhập");
      }

      setLoginData(data);
      startPolling(data);
    } catch (err) {
      setPollError(err.message || "Lỗi khi tạo phiên đăng nhập");
    } finally {
      setIsGeneratingUrl(false);
    }
  };

  // Start polling status
  const startPolling = (data) => {
    cleanupPolling();
    setIsPolling(true);

    pollingRef.current = setInterval(async () => {
      try {
        const params = new URLSearchParams({
          fingerprintId: data.fingerprintId,
          fingerprintHash: data.fingerprintHash,
          expiresAt: String(data.expiresAt || ""),
        });
        if (accountLabel.trim()) {
          params.set("label", accountLabel.trim());
        }

        const res = await fetch(`/api/oauth/freebuff/status?${params.toString()}`);
        const result = await res.json();

        if (result.status === "success") {
          cleanupPolling();
          setBrowserSuccessUser(result.user);
          onSuccess?.();
        } else if (result.status === "error") {
          cleanupPolling();
          setPollError(result.error || "Đăng nhập thất bại");
        }
      } catch (err) {
        // Continue polling on transient network glitch
      }
    }, 3000);
  };

  // Copy login URL
  const handleCopyUrl = () => {
    if (loginData?.loginUrl) {
      navigator.clipboard.writeText(loginData.loginUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  // Auto-Detect CLI accounts
  const fetchLocalAccounts = async () => {
    setLoadingAutoImport(true);
    setAutoImportError(null);
    try {
      const res = await fetch("/api/oauth/freebuff/auto-import");
      const data = await res.json();
      if (data.found && Array.isArray(data.accounts)) {
        setDetectedAccounts(data.accounts);
      } else {
        setDetectedAccounts([]);
      }
    } catch (err) {
      setAutoImportError("Không thể đọc cấu hình Freebuff CLI");
    } finally {
      setLoadingAutoImport(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === "autoImport") {
      fetchLocalAccounts();
    }
  }, [isOpen, activeTab]);

  // Import from CLI
  const handleImportCliAccount = async (profileKey) => {
    setImportingProfile(profileKey || "all");
    setAutoImportError(null);
    try {
      const res = await fetch("/api/oauth/freebuff/auto-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import thất bại");

      setAutoImportSuccess(`Đã import thành công ${data.importedCount || 1} tài khoản Freebuff`);
      onSuccess?.();
    } catch (err) {
      setAutoImportError(err.message || "Lỗi khi import tài khoản");
    } finally {
      setImportingProfile(null);
    }
  };

  // Manual Token Import
  const handleManualImport = async (e) => {
    e?.preventDefault();
    const token = manualToken.trim();
    if (!token) {
      setManualError("Vui lòng nhập Auth Token");
      return;
    }

    setIsSubmittingManual(true);
    setManualError(null);
    setManualSuccess(null);

    try {
      const res = await fetch("/api/oauth/freebuff/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authToken: token,
          name: manualLabel.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xác thực token thất bại");

      setManualSuccess(`Đã thêm tài khoản: ${data.connection?.name || "Freebuff"}`);
      setManualToken("");
      setManualLabel("");
      onSuccess?.();
    } catch (err) {
      setManualError(err.message || "Lỗi khi xác thực token");
    } finally {
      setIsSubmittingManual(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title={translate("Connect Freebuff Accounts (Multi-Account)") || "Đăng nhập tài khoản Freebuff (Từng Acc)"}
      onClose={() => {
        cleanupPolling();
        onClose();
      }}
    >
      <div className="flex flex-col gap-4 max-w-xl w-full">
        {/* Notice about multi-account benefits */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs leading-relaxed text-emerald-900 dark:text-emerald-300">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-base text-emerald-500 mt-0.5 shrink-0">
              workspace_premium
            </span>
            <div>
              <p className="font-semibold mb-0.5">
                Chế độ Multi-Account (Đăng nhập từng tài khoản)
              </p>
              <p className="text-text-muted dark:text-emerald-400/80">
                Mỗi tài khoản Freebuff có hạn mức gọi mô hình AI miễn phí độc lập hàng ngày (DeepSeek V4, GLM 5.3, MiMo 2.5, GPT 5.6 Luna...). Bạn có thể đăng nhập nhiều tài khoản; hệ thống sẽ tự động xoay vòng (rotate) để bạn có thêm nhiều lượt dùng miễn phí!
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex rounded-lg bg-sidebar p-1 border border-border">
          <button
            type="button"
            onClick={() => {
              setActiveTab("browser");
              cleanupPolling();
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-md transition-all ${
              activeTab === "browser"
                ? "bg-surface text-primary shadow-sm font-semibold"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <span className="material-symbols-outlined text-sm">open_in_browser</span>
            Đăng nhập Trình duyệt
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("autoImport");
              cleanupPolling();
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-md transition-all ${
              activeTab === "autoImport"
                ? "bg-surface text-primary shadow-sm font-semibold"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <span className="material-symbols-outlined text-sm">terminal</span>
            Import từ CLI
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("manual");
              cleanupPolling();
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-md transition-all ${
              activeTab === "manual"
                ? "bg-surface text-primary shadow-sm font-semibold"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <span className="material-symbols-outlined text-sm">key</span>
            Nhập Token thủ công
          </button>
        </div>

        {/* ─── TAB 1: BROWSER LOGIN ─── */}
        {activeTab === "browser" && (
          <div className="flex flex-col gap-3 py-1">
            {/* Step 1: Initial state - start login */}
            {!loginData && !browserSuccessUser && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    Tên gợi nhớ cho tài khoản này (tùy chọn)
                  </label>
                  <Input
                    placeholder="Ví dụ: Freebuff Acc 1, Gmail Cá nhân..."
                    value={accountLabel}
                    onChange={(e) => setAccountLabel(e.target.value)}
                  />
                </div>

                <div className="rounded-lg border border-border bg-sidebar/50 p-3 text-xs text-text-muted">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Bấm nút <strong>Bắt đầu đăng nhập tài khoản Freebuff</strong> bên dưới.</li>
                    <li>Trình duyệt sẽ mở trang xác thực chính thức của Freebuff (freebuff.com).</li>
                    <li>Đăng nhập tài khoản của bạn (Google / GitHub / Email).</li>
                    <li>Sau khi xác nhận, ToolnetAPI sẽ tự động lưu tài khoản vào danh sách!</li>
                  </ol>
                </div>

                {pollError && (
                  <div className="rounded-lg border border-error/30 bg-error/10 p-2.5 text-xs text-error">
                    {pollError}
                  </div>
                )}

                <Button
                  onClick={handleStartBrowserLogin}
                  disabled={isGeneratingUrl}
                  icon={isGeneratingUrl ? "progress_activity" : "login"}
                  variant="primary"
                  className="w-full justify-center py-2.5"
                >
                  {isGeneratingUrl ? "Đang tạo phiên đăng nhập..." : "Bắt đầu đăng nhập tài khoản Freebuff"}
                </Button>
              </div>
            )}

            {/* Step 2: Waiting for browser login */}
            {loginData && !browserSuccessUser && (
              <div className="flex flex-col gap-3">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
                  <div className="size-10 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl text-primary animate-spin">
                      progress_activity
                    </span>
                  </div>
                  <h4 className="font-semibold text-sm mb-1">
                    Đang chờ bạn đăng nhập trên trình duyệt...
                  </h4>
                  <p className="text-xs text-text-muted mb-3">
                    Vui lòng mở liên kết bên dưới và hoàn tất đăng nhập tài khoản Freebuff của bạn.
                  </p>

                  <div className="flex gap-2">
                    <a
                      href={loginData.loginUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white shadow hover:bg-primary/90 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                      Mở trang đăng nhập Freebuff ↗
                    </a>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleCopyUrl}
                      icon={copiedUrl ? "check" : "content_copy"}
                    >
                      {copiedUrl ? "Đã chép" : "Chép link"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
                  <span className="font-semibold">💡 Mẹo thêm tài khoản thứ 2, thứ 3...:</span>
                  <p className="mt-0.5">
                    Để đăng nhập tài khoản khác mà không bị tự động nhận diện tài khoản cũ, hãy mở liên kết trên trong <strong>Cửa sổ ẩn danh (Incognito Window)</strong> hoặc mở một hồ sơ trình duyệt khác.
                  </p>
                </div>

                <div className="flex justify-between items-center text-xs text-text-muted px-1">
                  <span>Trạng thái: Đang chờ xác nhận từ server...</span>
                  <button
                    type="button"
                    onClick={() => {
                      cleanupPolling();
                      setLoginData(null);
                    }}
                    className="text-text-muted hover:text-error underline"
                  >
                    Hủy phiên này
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Successfully authenticated an account! */}
            {browserSuccessUser && (
              <div className="flex flex-col gap-3">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                  <div className="size-12 mx-auto mb-2 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl text-emerald-600 dark:text-emerald-400">
                      check_circle
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-emerald-700 dark:text-emerald-300 mb-1">
                    Đăng nhập tài khoản thành công!
                  </h4>
                  <p className="text-xs text-text-muted">
                    Đã thêm tài khoản: <strong className="text-text-primary">{browserSuccessUser.name || "Freebuff"}</strong> ({browserSuccessUser.email || "Email"})
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1 justify-center"
                    icon="person_add"
                    onClick={() => {
                      setBrowserSuccessUser(null);
                      setLoginData(null);
                      setAccountLabel("");
                      handleStartBrowserLogin();
                    }}
                  >
                    Đăng nhập thêm tài khoản khác
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1 justify-center"
                    icon="done"
                    onClick={() => {
                      cleanupPolling();
                      onClose();
                    }}
                  >
                    Hoàn tất
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: AUTO-IMPORT FROM CLI ─── */}
        {activeTab === "autoImport" && (
          <div className="flex flex-col gap-3 py-1">
            {loadingAutoImport ? (
              <div className="py-8 text-center text-xs text-text-muted">
                <span className="material-symbols-outlined text-2xl text-primary animate-spin block mb-2">
                  progress_activity
                </span>
                Đang quét cấu hình Freebuff CLI trên máy chủ...
              </div>
            ) : detectedAccounts.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-text-muted">
                  Tìm thấy <strong>{detectedAccounts.length}</strong> tài khoản đã đăng nhập trong Freebuff CLI trên máy chủ:
                </p>

                {autoImportSuccess && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400">
                    {autoImportSuccess}
                  </div>
                )}
                {autoImportError && (
                  <div className="rounded-lg border border-error/30 bg-error/10 p-2.5 text-xs text-error">
                    {autoImportError}
                  </div>
                )}

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {detectedAccounts.map((acc, idx) => (
                    <div
                      key={acc.profileKey || idx}
                      className="flex items-center justify-between rounded-lg border border-border bg-sidebar/50 p-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="material-symbols-outlined text-primary text-xl shrink-0">
                          account_circle
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-text-primary truncate">
                            {acc.name || acc.profileKey}
                          </p>
                          <p className="text-[11px] text-text-muted truncate">
                            {acc.email || `ID: ${acc.id?.slice(0, 8)}`}
                          </p>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={importingProfile === acc.profileKey}
                        icon={importingProfile === acc.profileKey ? "progress_activity" : "download"}
                        onClick={() => handleImportCliAccount(acc.profileKey)}
                      >
                        {importingProfile === acc.profileKey ? "Đang import..." : "Import tài khoản"}
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    variant="primary"
                    disabled={importingProfile === "all"}
                    icon="playlist_add"
                    onClick={() => handleImportCliAccount(null)}
                  >
                    Import tất cả ({detectedAccounts.length})
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-text-muted space-y-2">
                <span className="material-symbols-outlined text-3xl text-text-muted/60 block mb-1">
                  folder_off
                </span>
                <p>Chưa tìm thấy thông tin đăng nhập Freebuff CLI trong <code>~/.config/manicode/credentials.json</code>.</p>
                <p className="text-[11px] text-text-muted/80">
                  Bạn có thể chạy lệnh <code>freebuff login</code> trên terminal máy chủ để đăng nhập trước, hoặc chuyển qua tab <strong>Đăng nhập Trình duyệt</strong> để đăng nhập trực tiếp tại đây.
                </p>
                <Button size="sm" variant="secondary" onClick={fetchLocalAccounts} icon="refresh">
                  Quét lại
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 3: MANUAL TOKEN IMPORT ─── */}
        {activeTab === "manual" && (
          <form onSubmit={handleManualImport} className="flex flex-col gap-3 py-1">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Freebuff Auth Token (hoặc chuỗi JSON credentials) <span className="text-error">*</span>
              </label>
              <textarea
                className="w-full rounded-lg border border-border bg-sidebar p-2.5 text-xs font-mono resize-y min-h-[90px] focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Dán authToken (uuid) hoặc nội dung file credentials.json..."
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                disabled={isSubmittingManual}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Tên gợi nhớ tài khoản (Label)
              </label>
              <Input
                placeholder="Ví dụ: Freebuff Acc 2"
                value={manualLabel}
                onChange={(e) => setManualLabel(e.target.value)}
                disabled={isSubmittingManual}
              />
            </div>

            {manualError && (
              <div className="rounded-lg border border-error/30 bg-error/10 p-2.5 text-xs text-error">
                {manualError}
              </div>
            )}

            {manualSuccess && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400">
                ✓ {manualSuccess}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={isSubmittingManual || !manualToken.trim()}
              icon={isSubmittingManual ? "progress_activity" : "save"}
              className="w-full justify-center py-2.5"
            >
              {isSubmittingManual ? "Đang xác thực tài khoản..." : "Xác thực & Thêm tài khoản"}
            </Button>
          </form>
        )}
      </div>
    </Modal>
  );
}

FreebuffAuthModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onSuccess: PropTypes.func,
  onClose: PropTypes.func.isRequired,
  providerInfo: PropTypes.object,
};
