import type { AgentActivity, OperationalState, RecoveryPlan, ScheduleChange } from "./models";
import { availableStock, coverage, materialShortfall } from "./operations";

export const SCENARIO_NOW = "2026-08-28T08:45:00+02:00";
export const PRODUCTION_START = "2026-08-29T06:00:00+02:00";

export interface SimulationInput { supplierId: string; quantityKg: number; expedited: boolean; allowScheduleChanges: boolean; }
export interface SupplierSearchInput { materialId: string; quantityKg: number; requiredBy?: string; }
export interface SupplierCompareInput { materialId: string; quantityKg: number; requiredBy: string; }

interface StateAdapter {
  getState: () => OperationalState;
  replaceState: (state: OperationalState) => void;
}

function activeIncident(state: OperationalState) {
  const incident = state.incidents.find((item) => item.id === "inc-01");
  if (!incident) throw new Error("The primary operational incident is unavailable.");
  return incident;
}

function deterministicTimestamp(index: number) {
  const date = new Date(SCENARIO_NOW);
  date.setMinutes(date.getMinutes() + Math.max(1, index - 3));
  return date.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Johannesburg" });
}

function deterministicIsoTimestamp(index: number) {
  const date = new Date(SCENARIO_NOW);
  date.setMinutes(date.getMinutes() + Math.max(1, index - 3));
  return date.toISOString();
}

function appendActivity(state: OperationalState, message: string, tone: AgentActivity["tone"], source: AgentActivity["source"], dedupeKey?: string) {
  if (dedupeKey && state.activities.some((activity) => activity.dedupeKey === dedupeKey)) return;
  const nextIndex = state.activities.length + 1;
  state.activities.push({ id: `a${nextIndex}`, timestamp: deterministicTimestamp(nextIndex), actor: source === "human" ? "Human operator" : source === "system" ? "System" : "Operations Agent", message, tone, source, dedupeKey });
}

function hoursUntil(requiredBy?: string) {
  if (!requiredBy) return (new Date(PRODUCTION_START).getTime() - new Date(SCENARIO_NOW).getTime()) / 3_600_000;
  const parsed = new Date(requiredBy);
  if (Number.isNaN(parsed.getTime())) throw new Error("requiredBy must be a valid date-time string.");
  return Math.max(0, (parsed.getTime() - new Date(SCENARIO_NOW).getTime()) / 3_600_000);
}

function arrivalAt(leadTimeHours: number) {
  const arrival = new Date(SCENARIO_NOW);
  arrival.setMinutes(arrival.getMinutes() + leadTimeHours * 60);
  return arrival.toISOString();
}

function validateQuantity(quantityKg: number) {
  if (!Number.isFinite(quantityKg) || quantityKg <= 0) throw new Error("quantityKg must be a positive number.");
}

export function createOperationsRuntime(adapter: StateAdapter) {
  const read = () => adapter.getState();
  const commit = (update: (draft: OperationalState) => void) => {
    const next = structuredClone(adapter.getState());
    update(next);
    adapter.replaceState(next);
    return next;
  };
  const logRead = (message: string, key: string) => commit((draft) => appendActivity(draft, message, "neutral", "webmcp", key));

  const getCurrentIncident = () => {
    const state = read();
    const incident = activeIncident(state);
    const supplier = state.suppliers.find((item) => item.id === incident.supplierId);
    const material = state.materials.find((item) => item.id === incident.materialId);
    const plan = state.recoveryPlans.at(-1);
    logRead("Agent inspected the active operational incident.", "read-current-incident");
    return {
      incidentId: incident.id,
      title: incident.title,
      severity: incident.severity,
      supplier: supplier ? { id: supplier.id, name: supplier.name } : null,
      material: material ? { id: material.id, name: material.name } : null,
      delayHours: incident.delayHours,
      affectedJobIds: incident.affectedJobIds,
      affectedOrderIds: incident.affectedOrderIds,
      estimatedFinancialExposure: incident.estimatedImpact,
      workflowStage: incident.stage,
      recoveryPlanExists: Boolean(plan && plan.approvalState !== "rejected"),
      approvalPending: plan?.approvalState === "pending",
      incidentStatus: incident.status,
    };
  };

  const getInventory = (materialId?: string) => {
    const state = read();
    const items = materialId ? state.inventory.filter((item) => item.materialId === materialId) : state.inventory;
    if (materialId && items.length === 0) throw new Error(`Unknown materialId: ${materialId}`);
    const result = items.map((item) => {
      const material = state.materials.find((candidate) => candidate.id === item.materialId);
      return { material: material ? { id: material.id, name: material.name, sku: material.sku, unit: material.unit } : null, onHand: item.currentStock, reserved: item.reservedStock, incoming: item.incomingStock, availableFreeStock: Math.max(0, item.currentStock - item.reservedStock), reorderPoint: item.reorderThreshold, coverageDays: Number(coverage(item).toFixed(2)), status: item.status };
    });
    logRead(materialId ? `Agent checked ${state.materials.find((item) => item.id === materialId)?.name ?? materialId} inventory.` : "Agent inspected current material inventory.", `read-inventory-${materialId ?? "all"}`);
    return { materials: result };
  };

  const getAtRiskOrders = (severity: "critical" | "at_risk" | "all" = "all") => {
    const state = read();
    const orders = state.orders.filter((order) => severity === "critical" ? order.risk === "critical" : severity === "at_risk" ? order.risk === "at-risk" : order.risk === "critical" || order.risk === "at-risk");
    logRead(`Agent reviewed ${orders.length} at-risk customer order${orders.length === 1 ? "" : "s"}.`, `read-risk-orders-${severity}`);
    return { severityFilter: severity, orders: orders.map((order) => ({ orderId: order.id, orderNumber: order.number, customer: order.customer, product: order.product, quantity: order.quantity, deadline: order.deadline, revenue: order.revenue, status: order.risk, relatedProductionJob: state.jobs.find((job) => job.id === order.jobId) ?? null })) };
  };

  const searchSupplierOptions = ({ materialId, quantityKg, requiredBy }: SupplierSearchInput) => {
    validateQuantity(quantityKg);
    const state = read();
    if (!state.materials.some((material) => material.id === materialId)) throw new Error(`Unknown materialId: ${materialId}`);
    const availableHours = hoursUntil(requiredBy);
    const options = state.quotes.filter((quote) => quote.materialId === materialId).map((quote) => {
      const supplier = state.suppliers.find((item) => item.id === quote.supplierId)!;
      const canFulfil = quote.availableQuantity >= quantityKg && quantityKg >= quote.minimumOrderQuantity;
      const standardCanArrive = quote.leadTimeHours <= availableHours;
      const expeditedCanArrive = quote.expeditedLeadTimeHours !== null && quote.expeditedLeadTimeHours <= availableHours;
      return { supplierId: supplier.id, supplierName: supplier.name, location: supplier.city, availableQuantityKg: quote.availableQuantity, pricePerKg: quote.unitPrice, minimumOrderQuantityKg: quote.minimumOrderQuantity, standardLeadTimeHours: quote.leadTimeHours, expeditedLeadTimeHours: quote.expeditedLeadTimeHours, expeditedFee: quote.expeditedDeliveryCost, reliabilityScore: supplier.reliability, canFulfilRequestedQuantity: canFulfil, canArriveBeforeRequiredBy: standardCanArrive || expeditedCanArrive, standardCanArriveBeforeRequiredBy: standardCanArrive, expeditedCanArriveBeforeRequiredBy: expeditedCanArrive };
    });
    logRead(`Agent searched ${options.length} qualified supplier options for ${quantityKg.toLocaleString()} kg.`, `search-${materialId}-${quantityKg}-${requiredBy ?? "default"}`);
    return { materialId, quantityKg, requiredBy: requiredBy ?? PRODUCTION_START, options };
  };

  const compareSupplierOptions = ({ materialId, quantityKg, requiredBy }: SupplierCompareInput) => {
    const state = read();
    const search = searchSupplierOptions({ materialId, quantityKg, requiredBy });
    const availableHours = hoursUntil(requiredBy);
    const lowestPrice = Math.min(...search.options.map((option) => option.pricePerKg));
    const fastestLead = Math.min(...search.options.map((option) => option.expeditedLeadTimeHours ?? option.standardLeadTimeHours));
    const bestReliability = Math.max(...search.options.map((option) => option.reliabilityScore));
    const comparison = search.options.map((option) => {
      const useExpedited = !option.standardCanArriveBeforeRequiredBy && option.expeditedCanArriveBeforeRequiredBy;
      const deliveryHours = useExpedited ? option.expeditedLeadTimeHours! : option.standardLeadTimeHours;
      const purchaseCost = quantityKg * option.pricePerKg;
      const expeditedCost = useExpedited ? option.expeditedFee ?? 0 : 0;
      const notes = [
        option.pricePerKg === lowestPrice ? "Lowest unit price." : "Higher unit price than the cheapest option.",
        option.reliabilityScore === bestReliability ? "Best reliability score in the qualified set." : `Reliability is ${bestReliability - option.reliabilityScore} points below the strongest supplier.`,
        (option.expeditedLeadTimeHours ?? option.standardLeadTimeHours) === fastestLead ? "Fastest available delivery route." : "Faster alternatives are available.",
        option.canFulfilRequestedQuantity ? "Can cover the full requested quantity." : `Cannot cover the full request; ${Math.max(0, quantityKg - option.availableQuantityKg).toLocaleString()} kg remains uncovered.`,
        deliveryHours <= availableHours ? (useExpedited ? "Deadline is protectable only with expedited delivery." : "Standard delivery can meet the requested deadline.") : "Cannot protect the requested production deadline.",
      ];
      return { supplierId: option.supplierId, supplierName: option.supplierName, location: option.location, quantityCoverageKg: Math.min(quantityKg, option.availableQuantityKg), requestedQuantityKg: quantityKg, purchaseCost, expeditedCost, totalLandedRecoveryCost: purchaseCost + expeditedCost, deliveryMethod: useExpedited ? "expedited" : "standard", deliveryTimingHours: deliveryHours, estimatedArrival: arrivalAt(deliveryHours), reliabilityScore: option.reliabilityScore, canFulfilRequestedQuantity: option.canFulfilRequestedQuantity, productionDeadlineProtected: option.canFulfilRequestedQuantity && deliveryHours <= availableHours, tradeOffNotes: notes };
    });
    logRead(`Agent compared ${comparison.length} supplier recovery options.`, `compare-${materialId}-${quantityKg}-${requiredBy}`);
    return { materialId, quantityKg, requiredBy, comparison, note: "No supplier is selected automatically; commercial, timing, quantity and reliability trade-offs are exposed for the agent to evaluate." };
  };

  const simulateRecoveryPlan = (input: SimulationInput) => {
    validateQuantity(input.quantityKg);
    const state = read();
    const incident = activeIncident(state);
    if (incident.status === "mitigated" || incident.status === "resolved") throw new Error("The active incident has already been mitigated.");
    const quote = state.quotes.find((item) => item.supplierId === input.supplierId && item.materialId === incident.materialId);
    if (!quote) throw new Error("The selected supplier is not qualified for the incident material.");
    if (input.quantityKg > quote.availableQuantity) throw new Error(`Supplier availability is limited to ${quote.availableQuantity} kg.`);
    if (input.quantityKg < quote.minimumOrderQuantity) throw new Error(`The supplier minimum order quantity is ${quote.minimumOrderQuantity} kg.`);
    if (input.expedited && quote.expeditedLeadTimeHours === null) throw new Error("Expedited delivery is unavailable from this supplier.");
    const supplier = state.suppliers.find((item) => item.id === input.supplierId)!;
    const deliveryHours = input.expedited ? quote.expeditedLeadTimeHours! : quote.leadTimeHours;
    const productionStartHours = hoursUntil(PRODUCTION_START);
    const arrivesBeforeProduction = deliveryHours <= productionStartHours;
    const canRescheduleForArrival = input.allowScheduleChanges && deliveryHours <= 24;
    const usableMaterial = availableStock(state, incident.materialId) + (arrivesBeforeProduction || canRescheduleForArrival ? input.quantityKg : 0);
    let allocated = 0;
    const jobsRestored: string[] = [];
    const jobsStillBlocked: string[] = [];
    const scheduleChanges: ScheduleChange[] = [];
    const lateSchedule = new Map<string, [string, string]>([["j1", ["09:30", "14:00"]], ["j2", ["14:15", "17:45"]], ["j3", ["Fri 08:00", "Fri 11:00"]]]);
    incident.affectedJobIds.forEach((jobId) => {
      const job = state.jobs.find((candidate) => candidate.id === jobId)!;
      const required = job.requiredMaterials.find((material) => material.materialId === incident.materialId)?.quantity ?? 0;
      if (allocated + required <= usableMaterial) {
        allocated += required;
        jobsRestored.push(jobId);
        if (!arrivesBeforeProduction && canRescheduleForArrival) {
          const replacement = lateSchedule.get(jobId)!;
          scheduleChanges.push({ jobId, fromStartTime: job.startTime, fromEndTime: job.endTime, toStartTime: replacement[0], toEndTime: replacement[1], reason: "Move production after recovery material arrival." });
        }
      } else jobsStillBlocked.push(jobId);
    });
    const scheduleDeadlineMisses = new Set(scheduleChanges.filter((change) => change.jobId === "j2").map((change) => change.jobId));
    const ordersProtected = incident.affectedOrderIds.filter((orderId) => { const order = state.orders.find((candidate) => candidate.id === orderId)!; return jobsRestored.includes(order.jobId) && !scheduleDeadlineMisses.has(order.jobId); });
    const ordersStillAtRisk = incident.affectedOrderIds.filter((orderId) => !ordersProtected.includes(orderId));
    const financialExposureBefore = incident.initialFinancialExposure;
    const financialExposureAfter = state.orders.filter((order) => ordersStillAtRisk.includes(order.id)).reduce((total, order) => total + order.revenue, 0);
    const extraProcurementCost = input.quantityKg * quote.unitPrice;
    const expeditedFee = input.expedited ? quote.expeditedDeliveryCost ?? 0 : 0;
    const planId = `RP-${String(state.recoveryPlans.length + 1).padStart(3, "0")}`;
    const plan: RecoveryPlan = {
      id: planId,
      incidentId: incident.id,
      title: `${supplier.name} recovery purchase`,
      summary: `${input.quantityKg.toLocaleString()} kg from ${supplier.name} via ${input.expedited ? "expedited" : "standard"} delivery protects ${ordersProtected.length} of ${incident.affectedOrderIds.length} affected orders.`,
      supplierId: supplier.id,
      materialId: incident.materialId,
      quantityKg: input.quantityKg,
      expedited: input.expedited,
      allowScheduleChanges: input.allowScheduleChanges,
      materialShortageBefore: materialShortfall(state, incident.materialId),
      incomingMaterialAfterPurchase: (state.inventory.find((item) => item.materialId === incident.materialId)?.incomingStock ?? 0) + input.quantityKg,
      jobsRestored,
      jobsStillBlocked,
      ordersProtected,
      ordersStillAtRisk,
      extraProcurementCost,
      expeditedFee,
      totalRecoveryCost: extraProcurementCost + expeditedFee,
      financialExposureBefore,
      financialExposureAfter,
      estimatedExposureAvoided: financialExposureBefore - financialExposureAfter,
      scheduleChanges,
      allCommitmentsProtected: ordersStillAtRisk.length === 0,
      approvalState: "not_requested",
      approvedBy: null,
      approvedAt: null,
      approvalRevokedAt: null,
      executionState: "not_executed",
    };
    commit((draft) => {
      draft.recoveryPlans.push(plan);
      activeIncident(draft).stage = "recovery_plan_proposed";
      appendActivity(draft, `Recovery simulation ${plan.id} completed: ${ordersProtected.length} orders protected, ${ordersStillAtRisk.length} remain at risk.`, "neutral", "webmcp");
    });
    return { summary: plan.summary, plan };
  };

  const requestRecoveryApproval = (recoveryPlanId: string) => {
    let result: Record<string, unknown> = {};
    commit((draft) => {
      const incident = activeIncident(draft);
      const plan = draft.recoveryPlans.find((item) => item.id === recoveryPlanId);
      if (!plan) throw new Error(`Recovery plan ${recoveryPlanId} does not exist.`);
      if (plan.incidentId !== incident.id) throw new Error("The recovery plan does not belong to the current incident.");
      if (plan.executionState === "executed") throw new Error("The recovery plan has already been executed.");
      if (plan.approvalState === "rejected") throw new Error("The recovery plan has been rejected.");
      plan.approvalState = "pending";
      incident.stage = "awaiting_human_approval";
      const supplier = draft.suppliers.find((item) => item.id === plan.supplierId)!;
      appendActivity(draft, `Recovery plan ${plan.id} is awaiting human approval.`, "alert", "webmcp");
      result = { recoveryPlanId: plan.id, summary: plan.summary, supplier: { id: supplier.id, name: supplier.name }, purchaseQuantityKg: plan.quantityKg, totalCost: plan.totalRecoveryCost, scheduleChanges: plan.scheduleChanges, customerOrdersProtected: plan.ordersProtected, approvalState: plan.approvalState, message: "Human approval is now required in OpsRelay. This action cannot be approved by the agent.", warning: "Only the dashboard approval UI can grant approval. Approved execution will create a purchase order and modify inventory, orders and production." };
    });
    return result;
  };

  const recordHumanApproval = (recoveryPlanId: string, approved: boolean) => {
    let result: Record<string, unknown> = {};
    commit((draft) => {
      const incident = activeIncident(draft);
      const plan = draft.recoveryPlans.find((item) => item.id === recoveryPlanId);
      if (!plan) throw new Error(`Recovery plan ${recoveryPlanId} does not exist.`);
      if (plan.incidentId !== incident.id) throw new Error("The recovery plan does not belong to the current incident.");
      if (plan.executionState === "executed") throw new Error("An executed plan cannot be re-approved or rejected.");
      if (plan.approvalState !== "pending") throw new Error("The recovery plan must be awaiting human approval.");
      plan.approvalState = approved ? "approved" : "rejected";
      plan.approvedBy = approved ? "human" : null;
      plan.approvedAt = approved ? deterministicIsoTimestamp(draft.activities.length + 1) : null;
      plan.approvalRevokedAt = null;
      incident.stage = approved ? "recovery_approved" : "impact_calculated";
      appendActivity(draft, approved ? `Human approved recovery plan ${plan.id}.` : `Human rejected recovery plan ${plan.id}; no operational changes were made.`, approved ? "success" : "alert", "human");
      result = { recoveryPlanId: plan.id, approved, approvalState: plan.approvalState, approvedBy: plan.approvedBy, approvedAt: plan.approvedAt, approvalRevokedAt: plan.approvalRevokedAt, workflowStage: incident.stage, executionState: plan.executionState, message: approved ? "Human approved — ready for agent execution." : "Plan rejected by the human operator. No purchase order or operational changes were made." };
    });
    return result;
  };

  const executeRecoveryPlan = (recoveryPlanId: string) => {
    let result: Record<string, unknown> = {};
    commit((draft) => {
      const incident = activeIncident(draft);
      const plan = draft.recoveryPlans.find((item) => item.id === recoveryPlanId);
      if (!plan) throw new Error(`Recovery plan ${recoveryPlanId} does not exist.`);
      if (plan.incidentId !== incident.id) throw new Error("The recovery plan does not belong to the current incident.");
      if (plan.approvalState !== "approved") throw new Error("Execution is blocked until the recovery plan receives explicit human approval.");
      if (plan.approvedBy !== "human" || !plan.approvedAt) throw new Error("Execution is blocked because verified human approval evidence is missing.");
      if (plan.approvalRevokedAt !== null) throw new Error("Execution is blocked because human approval has been revoked.");
      if (plan.executionState === "executed") throw new Error("The recovery plan has already been executed.");
      const quote = draft.quotes.find((item) => item.supplierId === plan.supplierId && item.materialId === plan.materialId)!;
      const deliveryHours = plan.expedited ? quote.expeditedLeadTimeHours! : quote.leadTimeHours;
      const purchaseOrderNumber = `PO-${4101 + draft.purchaseOrders.filter((order) => order.recoveryPlanId).length}`;
      const purchaseOrder = { id: purchaseOrderNumber.toLowerCase(), number: purchaseOrderNumber, recoveryPlanId: plan.id, supplierId: plan.supplierId, materialId: plan.materialId, quantity: plan.quantityKg, unitPrice: quote.unitPrice, expedited: plan.expedited, expeditedFee: plan.expeditedFee, totalCost: plan.totalRecoveryCost, expectedAt: arrivalAt(deliveryHours), status: "scheduled" as const };
      draft.purchaseOrders.push(purchaseOrder);
      incident.stage = "purchase_order_created";
      const inventory = draft.inventory.find((item) => item.materialId === plan.materialId)!;
      const inventoryBefore = inventory.incomingStock;
      inventory.incomingStock += plan.quantityKg;
      inventory.status = plan.allCommitmentsProtected ? "healthy" : "at-risk";
      plan.scheduleChanges.forEach((change) => {
        const job = draft.jobs.find((item) => item.id === change.jobId)!;
        job.startTime = change.toStartTime;
        job.endTime = change.toEndTime;
      });
      plan.jobsRestored.forEach((jobId) => { const job = draft.jobs.find((item) => item.id === jobId); if (job) job.status = "scheduled"; });
      plan.jobsStillBlocked.forEach((jobId) => { const job = draft.jobs.find((item) => item.id === jobId); if (job) job.status = "blocked"; });
      plan.ordersProtected.forEach((orderId) => { const order = draft.orders.find((item) => item.id === orderId); if (order) order.risk = "healthy"; });
      incident.estimatedImpact = plan.financialExposureAfter;
      incident.stage = "recovery_executed";
      incident.status = plan.allCommitmentsProtected ? "mitigated" : "active";
      plan.executionState = "executed";
      appendActivity(draft, `Purchase order ${purchaseOrder.number} created for ${plan.quantityKg.toLocaleString()} kg.`, "success", "webmcp");
      appendActivity(draft, `Production schedule recalculated; ${plan.jobsRestored.length} jobs restored.`, "success", "webmcp");
      appendActivity(draft, `${plan.ordersProtected.length} customer orders protected by the executed recovery.`, "success", "webmcp");
      if (incident.status === "mitigated") appendActivity(draft, "Operational incident mitigated; all affected commitments are protected.", "success", "system");
      result = { recoveryPlanId: plan.id, purchaseOrder, inventoryChanges: { materialId: plan.materialId, incomingBefore: inventoryBefore, incomingAfter: inventory.incomingStock, addedIncomingKg: plan.quantityKg }, scheduleChanges: plan.scheduleChanges, jobsRestored: plan.jobsRestored, ordersProtected: plan.ordersProtected, remainingRisks: plan.ordersStillAtRisk, financialExposureAvoided: plan.estimatedExposureAvoided, financialExposureAfter: plan.financialExposureAfter, workflowStage: incident.stage, finalIncidentStatus: incident.status };
    });
    return result;
  };

  const getRecoveryStatus = (recoveryPlanId?: string) => {
    const state = read();
    const incident = activeIncident(state);
    const plan = recoveryPlanId ? state.recoveryPlans.find((item) => item.id === recoveryPlanId) : state.recoveryPlans.at(-1);
    if (recoveryPlanId && !plan) throw new Error(`Recovery plan ${recoveryPlanId} does not exist.`);
    const purchaseOrder = plan ? state.purchaseOrders.find((order) => order.recoveryPlanId === plan.id) : undefined;
    const remainingAtRisk = state.orders.filter((order) => order.risk === "critical" || order.risk === "at-risk");
    logRead("Agent verified current recovery and incident status.", `read-recovery-status-${recoveryPlanId ?? "latest"}`);
    return { recoveryPlanId: plan?.id ?? null, workflowStage: incident.stage, approvalState: plan?.approvalState ?? "not_requested", approvedBy: plan?.approvedBy ?? null, approvedAt: plan?.approvedAt ?? null, approvalRevokedAt: plan?.approvalRevokedAt ?? null, rejected: plan?.approvalState === "rejected", executionState: plan?.executionState ?? "not_executed", purchaseOrderStatus: purchaseOrder ? { number: purchaseOrder.number, status: purchaseOrder.status, expectedAt: purchaseOrder.expectedAt } : null, inventoryImpact: plan ? { materialId: plan.materialId, incomingAddedKg: plan.executionState === "executed" ? plan.quantityKg : 0 } : null, productionHealth: state.jobs.some((job) => job.status === "blocked") ? "constrained" : "healthy", remainingAtRiskOrders: remainingAtRisk.map((order) => order.id), incidentStatus: incident.status, financialExposureBefore: plan?.financialExposureBefore ?? incident.initialFinancialExposure, financialExposureAfter: incident.estimatedImpact };
  };

  return { getState: read, getCurrentIncident, getInventory, getAtRiskOrders, searchSupplierOptions, compareSupplierOptions, simulateRecoveryPlan, requestRecoveryApproval, recordHumanApproval, executeRecoveryPlan, getRecoveryStatus };
}

export type OperationsRuntime = ReturnType<typeof createOperationsRuntime>;
