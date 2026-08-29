"use client";

import { useEffect } from "react";
import { useOperations } from "./operations-provider";
import { registerWebMcpTools } from "@/lib/webmcp/register-tools";

export function WebMcpBridge() {
  const { runtime, setWebMcpStatus } = useOperations();

  useEffect(() => {
    const controller = new AbortController();

    const boot = async () => {
      const previous = window.__operationsWebMcpRegistration;
      if (previous) {
        previous.controller.abort();
        const previousCleanup = await previous.registrationPromise.catch(() => null);
        await previousCleanup?.();
      }
      if (controller.signal.aborted) return;
      if (!document.modelContext) {
        setWebMcpStatus("unavailable");
        return;
      }
      setWebMcpStatus("checking");
      const registrationPromise = registerWebMcpTools(runtime, controller.signal);
      window.__operationsWebMcpRegistration = { controller, registrationPromise };
      try {
        const cleanup = await registrationPromise;
        if (controller.signal.aborted) await cleanup();
        else setWebMcpStatus("ready");
      } catch (error) {
        if (!controller.signal.aborted) setWebMcpStatus("error", error instanceof Error ? error.message : String(error));
      }
    };

    // Deferring one task prevents React development Strict Mode's probe mount
    // from registering a partial tool set before its immediate cleanup runs.
    const bootTimer = window.setTimeout(() => { void boot(); }, 0);
    return () => {
      window.clearTimeout(bootTimer);
      controller.abort();
      const registration = window.__operationsWebMcpRegistration;
      if (registration?.controller === controller) void registration.registrationPromise.then((cleanup) => cleanup()).catch(() => undefined);
      if (window.__operationsWebMcpRegistration?.controller === controller) delete window.__operationsWebMcpRegistration;
    };
  }, [runtime, setWebMcpStatus]);

  return null;
}
