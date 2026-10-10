/**
 * Cursor helpers for the template picker. The cursor is the index of the next
 * item to load, which is also how many items are currently visible.
 */

/** Cursor after loading one more page. Never goes past `total`. */
export function nextCursor(current: number, total: number, pageSize: number): number {
  return Math.min(total, current + pageSize);
}

/**
 * Starting cursor: the first page, extended (in whole pages) so the selected
 * item is visible. `selectedIndex` is -1 when nothing in the list is selected.
 */
export function initialCursor(selectedIndex: number, total: number, pageSize: number): number {
  if (selectedIndex < pageSize) return Math.min(total, pageSize);
  return Math.min(total, Math.ceil((selectedIndex + 1) / pageSize) * pageSize);
}
