/**
 * Persisted collapse state for the editor's generation-result right pane.
 * Kept out of the component file so the module exports only plain functions
 * (React Fast Refresh requires component files to export components only).
 */

const COLLAPSE_KEY = 'sd-prompt-builder:result-pane-collapsed'
export const NARROW_QUERY = '(max-width: 1279px)'

/**
 * With no stored preference, default to collapsed on narrow laptops (the left
 * sidebar + a 320px pane would otherwise squeeze the editing column).
 */
export function readResultPaneCollapsed() {
  try {
    const v = localStorage.getItem(COLLAPSE_KEY)
    if (v === '1') return true
    if (v === '0') return false
  } catch { /* ignore */ }
  try { return window.matchMedia(NARROW_QUERY).matches } catch { return false }
}

export function writeResultPaneCollapsed(collapsed) {
  try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0') } catch { /* ignore */ }
}
