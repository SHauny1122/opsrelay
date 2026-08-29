import type { OperationsRuntime } from "@/lib/operations-actions";
import { atRiskOrdersSchema, emptySchema, inventorySchema, planIdSchema, recoveryStatusSchema, simulateRecoverySchema, supplierCompareSchema, supplierSearchSchema } from "./schemas";
import { toolExecutor } from "./tool-results";
import type { WebMcpRegistrationHandle, WebMcpToolDefinition } from "./types";

export const WEBMCP_TOOL_NAMES = [
  "get_current_incident",
  "get_inventory",
  "get_at_risk_orders",
  "search_supplier_options",
  "compare_supplier_options",
  "simulate_recovery_plan",
  "request_recovery_approval",
  "execute_recovery_plan",
  "get_recovery_status",
] as const;

function stringInput(input: Record<string, unknown>, key: string, optional = false) {
  const value = input[key];
  if (optional && value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key} must be a non-empty string.`);
  return value;
}

function numberInput(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${key} must be a number.`);
  return value;
}

function booleanInput(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (typeof value !== "boolean") throw new Error(`${key} must be a boolean.`);
  return value;
}

function definitions(runtime: OperationsRuntime, signal: AbortSignal): WebMcpToolDefinition[] {
  return [
    { name: "get_current_incident", title: "Get current incident", description: "Inspect the active operational incident, impact and recovery workflow state.", inputSchema: emptySchema, annotations: { readOnlyHint: true }, signal, execute: toolExecutor(() => runtime.getCurrentIncident()) },
    { name: "get_inventory", title: "Get inventory", description: "Inspect material inventory, free stock, incoming supply, coverage and status.", inputSchema: inventorySchema, annotations: { readOnlyHint: true }, signal, execute: toolExecutor((input) => runtime.getInventory(stringInput(input, "materialId", true))) },
    { name: "get_at_risk_orders", title: "Get at-risk orders", description: "Inspect customer orders currently affected by operational risk and their production jobs.", inputSchema: atRiskOrdersSchema, annotations: { readOnlyHint: true }, signal, execute: toolExecutor((input) => { const severity = input.severity ?? "all"; if (!['critical', 'at_risk', 'all'].includes(String(severity))) throw new Error("severity must be critical, at_risk or all."); return runtime.getAtRiskOrders(severity as "critical" | "at_risk" | "all"); }) },
    { name: "search_supplier_options", title: "Search supplier options", description: "Find qualified supplier options for a material quantity and required delivery time without selecting a winner.", inputSchema: supplierSearchSchema, annotations: { readOnlyHint: true }, signal, execute: toolExecutor((input) => runtime.searchSupplierOptions({ materialId: stringInput(input, "materialId")!, quantityKg: numberInput(input, "quantityKg"), requiredBy: stringInput(input, "requiredBy", true) })) },
    { name: "compare_supplier_options", title: "Compare supplier options", description: "Compare landed cost, timing, coverage, reliability and production protection trade-offs.", inputSchema: supplierCompareSchema, annotations: { readOnlyHint: true }, signal, execute: toolExecutor((input) => runtime.compareSupplierOptions({ materialId: stringInput(input, "materialId")!, quantityKg: numberInput(input, "quantityKg"), requiredBy: stringInput(input, "requiredBy")! })) },
    { name: "simulate_recovery_plan", title: "Simulate recovery plan", description: "Calculate and store a proposed supplier recovery plan without changing inventory, purchase orders, customer orders or production.", inputSchema: simulateRecoverySchema, annotations: { readOnlyHint: false }, signal, execute: toolExecutor((input) => runtime.simulateRecoveryPlan({ supplierId: stringInput(input, "supplierId")!, quantityKg: numberInput(input, "quantityKg"), expedited: booleanInput(input, "expedited"), allowScheduleChanges: booleanInput(input, "allowScheduleChanges") })) },
    { name: "request_recovery_approval", title: "Request human recovery approval", description: "Move a valid simulated recovery plan into the dashboard's human approval queue. The agent cannot approve the plan.", inputSchema: planIdSchema, annotations: { readOnlyHint: false }, signal, execute: toolExecutor((input) => runtime.requestRecoveryApproval(stringInput(input, "recoveryPlanId")!)) },
    { name: "execute_recovery_plan", title: "Execute recovery plan", description: "Execute an approved recovery plan by creating a purchase order and applying inventory, production and order updates.", inputSchema: planIdSchema, annotations: { readOnlyHint: false }, signal, execute: toolExecutor((input) => runtime.executeRecoveryPlan(stringInput(input, "recoveryPlanId")!)) },
    { name: "get_recovery_status", title: "Get recovery status", description: "Verify approval, execution, purchase order, inventory, production, order and incident status.", inputSchema: recoveryStatusSchema, annotations: { readOnlyHint: true }, signal, execute: toolExecutor((input) => runtime.getRecoveryStatus(stringInput(input, "recoveryPlanId", true))) },
  ];
}

async function disposeRegistration(registration: WebMcpRegistrationHandle | (() => void) | void, name: string) {
  if (typeof registration === "function") return registration();
  if (registration && "unregister" in registration && registration.unregister) return registration.unregister();
  if (registration && "dispose" in registration && registration.dispose) return registration.dispose();
  return document.modelContext?.unregisterTool?.(name);
}

export async function registerWebMcpTools(runtime: OperationsRuntime, signal: AbortSignal) {
  const modelContext = document.modelContext;
  if (!modelContext) throw new Error("WebMCP is unavailable in this browser.");
  const registrations: { name: string; handle: WebMcpRegistrationHandle | (() => void) | void }[] = [];
  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    await Promise.allSettled(registrations.map(({ name, handle }) => disposeRegistration(handle, name)));
  };
  signal.addEventListener("abort", () => { void cleanup(); }, { once: true });
  try {
    for (const tool of definitions(runtime, signal)) {
      if (signal.aborted) break;
      const handle = await modelContext.registerTool(tool);
      registrations.push({ name: tool.name, handle });
    }
    if (signal.aborted) await cleanup();
    return cleanup;
  } catch (error) {
    await cleanup();
    throw error;
  }
}
