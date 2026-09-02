'use client';

import { useState, useMemo, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, ChevronLeft, ChevronRight, ChevronsUpDown, ArrowUp, ArrowDown, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  className?: string;
  hideOnMobile?: boolean;
  /** If true, this column is treated as the card's primary/title cell on mobile. Defaults to the first non-hidden column. */
  mobilePrimary?: boolean;
  /** If true, this column's content is rendered prominently (e.g. status) on mobile. */
  mobileHighlight?: boolean;
  /** If true, this column is displayed as a full-width footer row in the mobile card (ideal for action buttons). */
  mobileFooter?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchKeys?: (keyof T)[];
  searchPlaceholder?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  toolbar?: ReactNode;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  searchKeys,
  searchPlaceholder = 'Search...',
  pageSize = 10,
  onRowClick,
  emptyMessage = 'No records found.',
  toolbar,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search || !searchKeys) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      searchKeys.some((k) => String(row[k] ?? '').toLowerCase().includes(q))
    );
  }, [data, search, searchKeys]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const vals = [...filtered].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return vals;
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Categorise columns for mobile card rendering
  const visibleColumns = columns.filter((c) => !c.hideOnMobile);
  const primaryCol =
    visibleColumns.find((c) => c.mobilePrimary) ?? visibleColumns[0] ?? null;
  const footerCols = visibleColumns.filter((c) => c.mobileFooter);
  const highlightCols = visibleColumns.filter(
    (c) => c.mobileHighlight && c !== primaryCol && !c.mobileFooter
  );
  const bodyCols = visibleColumns.filter(
    (c) => c !== primaryCol && !c.mobileFooter && !c.mobileHighlight
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        {searchKeys && (
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={searchPlaceholder}
              className="pl-8 h-9"
            />
          </div>
        )}
        {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
      </div>

      {/* ── Desktop table (md+) ── */}
      <div className="table-scroll-wrapper rounded-md border border-border overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={cn(col.className)}
                  >
                    {col.sortable ? (
                      <button
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        {col.header}
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Inbox className="h-5 w-5" />
                      <span className="text-sm">{emptyMessage}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((row) => (
                  <TableRow
                    key={row.id}
                    onClick={() => onRowClick?.(row)}
                    className={cn(onRowClick && 'cursor-pointer')}
                  >
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={cn(col.hideOnMobile && 'hidden md:table-cell', col.className)}
                      >
                        {col.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Mobile card layout (<md) ── */}
      <div className="md:hidden space-y-2">
        {paged.length === 0 ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground py-10">
            <Inbox className="h-5 w-5" />
            <span className="text-sm">{emptyMessage}</span>
          </div>
        ) : (
          paged.map((row) => (
            <div
              key={row.id}
              onClick={() => onRowClick?.(row)}
              className={cn(
                'rounded-lg border border-border bg-card p-3 space-y-2',
                onRowClick && 'cursor-pointer active:bg-secondary/60'
              )}
            >
              {/* Primary / title row */}
              {primaryCol && (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">{primaryCol.cell(row)}</div>
                  {/* Highlight cols (e.g. status badge) shown inline with primary on mobile */}
                  {highlightCols.length > 0 && (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {highlightCols.map((col) => (
                        <div key={col.key}>{col.cell(row)}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Body label-value pairs */}
              {bodyCols.length > 0 && (
                <div className="space-y-1.5">
                  {bodyCols.map((col) => (
                    <div key={col.key} className="flex items-start gap-2">
                      <span className="text-xs text-muted-foreground shrink-0 w-20">{col.header}</span>
                      <div className="text-xs min-w-0 flex-1">{col.cell(row)}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer / actions row */}
              {footerCols.length > 0 && (
                <div className="pt-1 border-t border-border flex flex-wrap gap-1.5">
                  {footerCols.map((col) => (
                    <div key={col.key} className="flex-1 min-w-0">{col.cell(row)}</div>
                  ))}
                </div>
              )}

              {/* Fallback: if no column flags are set (all columns are body cols after primary),
                  show the status+actions columns without labels since they have enough visual hierarchy */}
              {footerCols.length === 0 && highlightCols.length === 0 && bodyCols.length === 0 && primaryCol && (
                // All remaining visible columns are rendered in a compact grid
                <div className="space-y-1.5">
                  {visibleColumns.filter(c => c !== primaryCol).map((col) => (
                    <div key={col.key} className="flex items-start gap-2">
                      <span className="text-xs text-muted-foreground shrink-0 w-20">{col.header}</span>
                      <div className="text-xs min-w-0 flex-1">{col.cell(row)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {sorted.length > pageSize && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
