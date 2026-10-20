
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectSearchProps {
  label: string;
  /** Cada opção pode ser uma string simples ou um {value, label} — útil quando o texto buscável (label) difere do valor salvo no filtro (value), como em código + descrição. */
  options: string[] | MultiSelectOption[];
  selected: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}

/** Dropdown de seleção múltipla com busca interna. */
export function MultiSelectSearch({ label, options, selected, onChange, placeholder }: MultiSelectSearchProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const normalized: MultiSelectOption[] = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );

  const q = search.toLowerCase();
  const filtered = normalized.filter((o) => o.label.toLowerCase().includes(q));

  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
  };

  const labelFor = (v: string) => normalized.find((o) => o.value === v)?.label ?? v;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 h-8 px-3 text-xs border border-linha rounded-lg bg-white hover:bg-nevoa text-tinta min-w-[120px] max-w-[200px] truncate"
      >
        <span className="truncate">
          {selected.length === 0
            ? label
            : selected.length === 1
            ? labelFor(selected[0])
            : `${label} (${selected.length})`}
        </span>
        {selected.length > 0 && (
          <X
            size={10}
            className="flex-shrink-0 text-aco-claro hover:text-tinta"
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
          />
        )}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-linha rounded-lg shadow-lg min-w-[200px] max-h-60 flex flex-col">
          <div className="p-2 border-b border-nevoa">
            <input
              autoFocus
              type="text"
              placeholder={placeholder ?? "Buscar..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs px-2 py-1 border border-linha rounded focus:outline-none focus:ring-1 focus:ring-sinal-claro"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-aco-claro px-3 py-2">Nenhum resultado</p>
            ) : (
              filtered.map((o) => (
                <label
                  key={o.value}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-nevoa cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(o.value)}
                    onChange={() => toggle(o.value)}
                    className="w-3 h-3 accent-sinal"
                  />
                  <span className="text-xs text-tinta truncate">{o.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
