"use client";

import PropTypes from "prop-types";
import { Input } from "@/shared/components";

/** Reusable endpoint row component */
export default function EndpointRow({ label, url, copyId, copied, onCopy, badge, actions }) {
  const isHighlighted = badge === "BASE" || badge === "CF" || badge === "TS";

  return (
    <div className="flex items-center gap-2 min-w-0 w-full">
      <span
        className={`text-xs font-mono px-2 py-1.5 rounded shrink-0 min-w-[96px] sm:min-w-[108px] text-center truncate ${
          isHighlighted
            ? "bg-primary/10 text-primary font-semibold"
            : "bg-surface-2 text-text-muted font-medium"
        }`}
        title={label}
      >
        {label}
      </span>
      <Input
        value={url}
        readOnly
        className="flex-1 min-w-0"
        inputClassName="py-1.5 px-2.5 font-mono text-xs sm:text-sm select-all"
      />
      <button
        type="button"
        onClick={() => onCopy(url, copyId)}
        className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary transition-colors shrink-0 flex items-center justify-center"
        title={`Copy ${label} URL`}
        aria-label={`Copy ${label} URL`}
      >
        <span className="material-symbols-outlined text-[18px]">
          {copied === copyId ? "check" : "content_copy"}
        </span>
      </button>
      {actions}
    </div>
  );
}

EndpointRow.propTypes = {
  label: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired,
  copyId: PropTypes.string.isRequired,
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
  badge: PropTypes.string,
  actions: PropTypes.node,
};

