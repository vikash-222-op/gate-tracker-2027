import React from 'react';
import { Trash2, X, CheckSquare } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  totalVisibleCount: number;
  onSelectAllVisible?: () => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  itemLabel?: string;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  totalVisibleCount,
  onSelectAllVisible,
  onClearSelection,
  onDeleteSelected,
  itemLabel = 'records'
}) => {
  if (selectedCount === 0) return null;

  const isAllVisibleSelected = totalVisibleCount > 0 && selectedCount >= totalVisibleCount;

  return (
    <div className="bg-indigo-50/90 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800/80 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
          <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
            {selectedCount} {itemLabel} selected
          </span>
        </div>

        {onSelectAllVisible && !isAllVisibleSelected && totalVisibleCount > selectedCount && (
          <button
            type="button"
            onClick={onSelectAllVisible}
            className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Select all {totalVisibleCount} visible</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClearSelection}
          className="px-2.5 py-1 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/60 transition-colors flex items-center gap-1 cursor-pointer"
          title="Clear Selection"
        >
          <X className="w-3.5 h-3.5" />
          <span>Clear</span>
        </button>

        <button
          type="button"
          onClick={onDeleteSelected}
          className="px-3 py-1 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Selected</span>
        </button>
      </div>
    </div>
  );
};
