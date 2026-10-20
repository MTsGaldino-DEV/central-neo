import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  label?: string;
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  label = "itens",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50/60 flex-shrink-0">
      <p className="text-xs text-slate-500">
        Mostrando{" "}
        <span className="font-semibold text-slate-700">
          {start}–{end}
        </span>{" "}
        de{" "}
        <span className="font-semibold text-slate-700">{totalItems}</span>{" "}
        {label}
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Página anterior"
        >
          <ChevronLeft size={15} />
        </button>

        <span className="px-3 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg">
          {page} / {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Próxima página"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
