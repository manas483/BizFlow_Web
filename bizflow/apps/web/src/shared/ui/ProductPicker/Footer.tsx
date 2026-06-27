import React from "react";

interface FooterProps {
  selectedCount: number;
  onCancel: () => void;
  onAdd: () => void;
  footerActions?: React.ReactNode;
}

export const Footer: React.FC<FooterProps> = ({
  selectedCount,
  onCancel,
  onAdd,
  footerActions,
}) => {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-t flex-shrink-0 bg-primary/5 select-none"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs sm:text-sm text-primary/60">
          Selected:{" "}
          <strong className="text-violet-400 font-bold font-mono">
            {selectedCount}
          </strong>{" "}
          {selectedCount === 1 ? "Product" : "Products"}
        </span>
        {footerActions}
      </div>

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all bg-white/5 border border-white/10 text-primary/70 hover:bg-white/10 hover:text-white"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onAdd}
          disabled={selectedCount <= 0}
          className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white transition-all bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 shadow-lg shadow-violet-500/20 disabled:opacity-40 disabled:hover:from-violet-600 disabled:hover:to-purple-700 disabled:cursor-not-allowed hover:-translate-y-0.5"
        >
          Add {selectedCount > 0 ? `${selectedCount} ` : ""}Products
        </button>
      </div>
    </div>
  );
};
