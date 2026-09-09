import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";

interface UnsavedChangesContextValue {
  dirty: boolean;
  setDirty: (value: boolean) => void;
  /** Ask the user to confirm leaving if dirty. Returns true if navigation should proceed. */
  confirmLeave: () => boolean;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | undefined>(undefined);

const LEAVE_MESSAGE = "You have an unsaved entry open. Leave without saving?";

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const confirmLeave = () => !dirtyRef.current || window.confirm(LEAVE_MESSAGE);

  return (
    <UnsavedChangesContext.Provider value={{ dirty, setDirty, confirmLeave }}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) throw new Error("useUnsavedChanges must be used within UnsavedChangesProvider");
  return ctx;
}
