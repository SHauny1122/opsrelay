export type Status = "healthy" | "watch" | "at-risk" | "critical" | "scheduled" | "blocked" | "complete";
export type Severity = "low" | "medium" | "high" | "critical";
export type IncidentStage = "incident_detected" | "impact_calculated" | "investigation_in_progress" | "recovery_plan_proposed" | "awaiting_human_approval" | "recovery_approved" | "purchase_order_created" | "production_rescheduled" | "recovery_executed" | "incident_mitigated";
export type ApprovalState = "not_requested" | "pending" | "approved" | "rejected";
export type ExecutionState = "not_executed" | "executed";

export interface Material { id: string; name: string; sku: string; unit: string; }
export interface InventoryItem { materialId: string; currentStock: number; reservedStock: number; incomingStock: number; reorderThreshold: number; dailyUsage: number; status: Status; }
export interface Supplier { id: string; name: string; city: string; reliability: number; }
export interface SupplierQuote { id: string; supplierId: string; materialId: string; unitPrice: number; availableQuantity: number; leadTimeHours: number; expeditedLeadTimeHours: number | null; expeditedDeliveryCost: number | null; minimumOrderQuantity: number; }
export interface CustomerOrder { id: string; number: string; customer: string; product: string; quantity: number; deadline: string; revenue: number; risk: Status; jobId: string; }
export interface ProductionJob { id: string; number: string; product: string; startTime: string; endTime: string; quantity: number; requiredMaterials: { materialId: string; quantity: number }[]; status: Status; }
export interface PurchaseOrder { id: string; number: string; recoveryPlanId?: string; supplierId: string; materialId: string; quantity: number; unitPrice?: number; expedited?: boolean; expeditedFee?: number; totalCost?: number; expectedAt: string; status: Status; }
export interface Incident { id: string; title: string; supplierId: string; materialId: string; delayHours: number; severity: Severity; status: "active" | "monitoring" | "mitigated" | "resolved"; stage: IncidentStage; affectedJobIds: string[]; affectedOrderIds: string[]; estimatedImpact: number; initialFinancialExposure: number; }
export interface ScheduleChange { jobId: string; fromStartTime: string; fromEndTime: string; toStartTime: string; toEndTime: string; reason: string; }
export interface RecoveryPlan {
  id: string;
  incidentId: string;
  title: string;
  summary: string;
  supplierId: string;
  materialId: string;
  quantityKg: number;
  expedited: boolean;
  allowScheduleChanges: boolean;
  materialShortageBefore: number;
  incomingMaterialAfterPurchase: number;
  jobsRestored: string[];
  jobsStillBlocked: string[];
  ordersProtected: string[];
  ordersStillAtRisk: string[];
  extraProcurementCost: number;
  expeditedFee: number;
  totalRecoveryCost: number;
  financialExposureBefore: number;
  financialExposureAfter: number;
  estimatedExposureAvoided: number;
  scheduleChanges: ScheduleChange[];
  allCommitmentsProtected: boolean;
  approvalState: ApprovalState;
  approvedBy: "human" | null;
  approvedAt: string | null;
  approvalRevokedAt: string | null;
  executionState: ExecutionState;
}
export interface AgentActivity { id: string; timestamp: string; actor: "System" | "Operations Agent" | "Human operator"; message: string; tone: "neutral" | "alert" | "success"; source?: "system" | "webmcp" | "human"; dedupeKey?: string; }
export interface OperationalState { materials: Material[]; inventory: InventoryItem[]; suppliers: Supplier[]; quotes: SupplierQuote[]; orders: CustomerOrder[]; jobs: ProductionJob[]; purchaseOrders: PurchaseOrder[]; incidents: Incident[]; recoveryPlans: RecoveryPlan[]; activities: AgentActivity[]; }
