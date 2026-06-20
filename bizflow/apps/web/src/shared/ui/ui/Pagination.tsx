import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPage: (p: number) => void;
}

export default function Pagination({ page, totalPages, total, limit, onPage }: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end   = Math.min(page * limit, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 sm:px-5 py-3 border-t border-primary/10">
      <p className="text-xs text-primary/40">
        Showing <span className="font-medium text-primary/60">{start}–{end}</span> of{" "}
        <span className="font-medium text-primary/60">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="p-1.5 rounded-lg hover:bg-primary/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-primary/50"
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce<(number | "...")[]>((acc, p, i, arr) => {
            if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
            acc.push(p);
            return acc;
          }, [])
          .map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="px-1 text-primary/30 text-xs">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPage(p as number)}
                className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${
                  p === page
                    ? "bg-violet-600 text-white shadow-sm shadow-violet-500/30"
                    : "hover:bg-primary/5 text-primary/50 hover:text-primary"
                }`}
              >
                {p}
              </button>
            )
          )}
        <button
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="p-1.5 rounded-lg hover:bg-primary/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-primary/50"
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
