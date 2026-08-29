"use client";

import { useState } from "react";
import { useOperations } from "./operations-provider";
import { PRODUCTION_START } from "@/lib/operations-actions";
import { WEBMCP_TOOL_NAMES } from "@/lib/webmcp/register-tools";

export function WebMcpDebugPanel() {
  const { state, runtime, resetDemo, webMcpStatus, webMcpError } = useOperations();
  const [output, setOutput] = useState<unknown>({ message: "Choose an action to inspect deterministic tool behavior." });
  const incident = state.incidents.find((item) => item.id === "inc-01")!;
  const latestPlan = state.recoveryPlans.at(-1);

  const invoke = (action: () => unknown) => {
    try { setOutput(action()); }
    catch (error) { setOutput({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }); }
  };

  const actions = [
    ["Get current incident", () => runtime.getCurrentIncident()],
    ["Get aluminium inventory", () => runtime.getInventory("al-6061")],
    ["Get at-risk orders", () => runtime.getAtRiskOrders("all")],
    ["Search suppliers", () => runtime.searchSupplierOptions({ materialId: "al-6061", quantityKg: 1340, requiredBy: PRODUCTION_START })],
    ["Compare suppliers", () => runtime.compareSupplierOptions({ materialId: "al-6061", quantityKg: 1340, requiredBy: PRODUCTION_START })],
    ["Simulate Allied recovery", () => runtime.simulateRecoveryPlan({ supplierId: "allied", quantityKg: 1340, expedited: true, allowScheduleChanges: true })],
    ["Request latest approval", () => runtime.requestRecoveryApproval(latestPlan?.id ?? "missing-plan")],
    ["Simulate human approval", () => runtime.recordHumanApproval(latestPlan?.id ?? "missing-plan", true)],
    ["Simulate human rejection", () => runtime.recordHumanApproval(latestPlan?.id ?? "missing-plan", false)],
    ["Execute latest plan", () => runtime.executeRecoveryPlan(latestPlan?.id ?? "missing-plan")],
    ["Get recovery status", () => runtime.getRecoveryStatus(latestPlan?.id)],
  ] as const;

  return <main className="min-h-screen bg-[#f6f7f5] p-6 text-[#16201d] lg:p-10"><div className="mx-auto max-w-6xl"><div className="flex flex-col justify-between gap-4 border-b border-[#dfe4e0] pb-6 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#71807b]">Development only</p><h1 className="mt-2 text-2xl font-bold">WebMCP tool debug panel</h1><p className="mt-1 text-sm text-[#71807b]">Invoke the shared business functions without a WebMCP-capable agent.</p></div><button onClick={() => { resetDemo(); setOutput({ message: "Demo reset." }); }} className="rounded-lg border border-[#cdd5d1] bg-white px-4 py-2 text-sm font-semibold">Reset Demo</button></div>
    <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.4fr]"><section className="rounded-xl border border-[#e0e5e2] bg-white p-5"><h2 className="text-sm font-bold">Registration</h2><div className="mt-3 flex items-center gap-2 text-sm"><span className={`h-2 w-2 rounded-full ${webMcpStatus === "ready" ? "bg-emerald-500" : "bg-slate-400"}`}/>{webMcpStatus}{webMcpError ? ` · ${webMcpError}` : ""}</div><p className="mt-4 text-xs font-bold uppercase tracking-wide text-[#71807b]">Workflow stage</p><p className="mt-1 font-mono text-sm">{incident.stage}</p><p className="mt-4 text-xs font-bold uppercase tracking-wide text-[#71807b]">Registered tool names</p><ul className="mt-2 space-y-1 font-mono text-xs text-[#42534d]">{WEBMCP_TOOL_NAMES.map((name) => <li key={name}>{name}</li>)}</ul></section>
      <section className="rounded-xl border border-[#e0e5e2] bg-white p-5"><h2 className="text-sm font-bold">Manual business actions</h2><div className="mt-4 flex flex-wrap gap-2">{actions.map(([label, action]) => <button key={label} onClick={() => invoke(action)} className="rounded-lg border border-[#dce2df] bg-[#fafcfb] px-3 py-2 text-xs font-semibold hover:border-[#8eb8ac] hover:bg-[#f3f9f7]">{label}</button>)}</div><pre className="mt-5 max-h-[560px] overflow-auto rounded-lg bg-[#152b27] p-4 text-xs leading-5 text-[#d5e8e2]">{JSON.stringify(output, null, 2)}</pre></section></div></div></main>;
}
