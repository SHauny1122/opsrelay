"use client";

import { createContext, useCallback, useContext, useState, useSyncExternalStore } from "react";
import { createOperationsRuntime, type OperationsRuntime } from "@/lib/operations-actions";
import { cloneInitialState } from "@/lib/operations";
import type { OperationalState } from "@/lib/models";

export type WebMcpStatus = "checking" | "ready" | "unavailable" | "error";

interface OperationsContextValue {
  state: OperationalState;
  runtime: OperationsRuntime;
  resetDemo: () => void;
  webMcpStatus: WebMcpStatus;
  webMcpError: string | null;
  setWebMcpStatus: (status: WebMcpStatus, error?: string | null) => void;
}

const OperationsContext = createContext<OperationsContextValue | null>(null);

class OperationsStore {
  private state = cloneInitialState();
  private listeners = new Set<() => void>();
  readonly runtime: OperationsRuntime;

  constructor() {
    this.runtime = createOperationsRuntime({
      getState: this.getSnapshot,
      replaceState: (next) => {
        this.state = next;
        this.listeners.forEach((listener) => listener());
      },
    });
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  reset = () => {
    this.state = cloneInitialState();
    this.listeners.forEach((listener) => listener());
  };
}

export function OperationsProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(() => new OperationsStore());
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [webMcp, setWebMcp] = useState<{ status: WebMcpStatus; error: string | null }>({ status: "checking", error: null });

  const setWebMcpStatus = useCallback((status: WebMcpStatus, error: string | null = null) => setWebMcp({ status, error }), [setWebMcp]);

  return <OperationsContext.Provider value={{ state, runtime: store.runtime, resetDemo: store.reset, webMcpStatus: webMcp.status, webMcpError: webMcp.error, setWebMcpStatus }}>{children}</OperationsContext.Provider>;
}

export function useOperations() {
  const context = useContext(OperationsContext);
  if (!context) throw new Error("useOperations must be used within OperationsProvider.");
  return context;
}
