import { useRef } from "react";

/**
 * Tracks whether a form value has changed since it was opened, so a dialog
 * can confirm before discarding an in-progress edit on an outside click or
 * Escape (shadcn's Dialog closes on both by default with no warning).
 *
 * Call `snapshot()` right after setting the form's initial values (on open),
 * check `isDirty()` before honoring a close, and `clear()` once the dialog
 * is actually closed.
 */
export function useDirtyForm<T>(value: T) {
  const baseline = useRef<string | null>(null);

  // Takes an explicit value (rather than always reading the hook's own
  // `value` prop) because callers snapshot right after `setForm(x)` in the
  // same event handler, before the state update has actually flushed.
  const snapshot = (v: T = value) => {
    baseline.current = JSON.stringify(v);
  };
  const isDirty = () => baseline.current !== null && JSON.stringify(value) !== baseline.current;
  const clear = () => {
    baseline.current = null;
  };

  return { snapshot, isDirty, clear };
}

const DISCARD_MESSAGE = "Discard unsaved changes?";

/** Wraps a Dialog's onOpenChange so closing while dirty asks for confirmation first. */
export function guardedOpenChange(
  isDirty: () => boolean,
  setOpen: (open: boolean) => void,
  onClose?: () => void,
) {
  return (open: boolean) => {
    if (!open) {
      if (isDirty() && !window.confirm(DISCARD_MESSAGE)) return;
      onClose?.();
    }
    setOpen(open);
  };
}
