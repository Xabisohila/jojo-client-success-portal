"use client";

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  page_size: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pages, total, page_size, onPageChange }: PaginationProps) {
  if (pages <= 1) return null;

  const start = (page - 1) * page_size + 1;
  const end = Math.min(page * page_size, total);

  const visiblePages = (): (number | "...")[] => {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, "...", pages];
    if (page >= pages - 3) return [1, "...", pages - 4, pages - 3, pages - 2, pages - 1, pages];
    return [1, "...", page - 1, page, page + 1, "...", pages];
  };

  return (
    <div className="flex items-center justify-between px-1 py-3">
      <p className="text-sm text-gray-500">
        Showing <span className="font-medium">{start}</span>–<span className="font-medium">{end}</span> of{" "}
        <span className="font-medium">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="px-2 py-1 rounded text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ‹ Prev
        </button>
        {visiblePages().map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-2 py-1 text-sm text-gray-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                p === page
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === pages}
          className="px-2 py-1 rounded text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
