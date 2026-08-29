import { initialState } from "./seed";
import type { OperationalState, Status } from "./models";

export const cloneInitialState = (): OperationalState => structuredClone(initialState);
export const money = (value: number) => `R\u00a0${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
export const badge = (status: Status | string) => ({ healthy: "Healthy", watch: "Watch", "at-risk": "At risk", critical: "Critical", blocked: "Blocked", scheduled: "Scheduled", complete: "Complete" }[status] ?? status);
export function coverage(item: OperationalState["inventory"][number]) { return Math.max(0, (item.currentStock - item.reservedStock) / item.dailyUsage); }
export function totalAtRisk(state: OperationalState) { return state.orders.filter(o => o.risk === "at-risk" || o.risk === "critical").length; }
export function materialDemand(state: OperationalState, materialId: string) { return state.jobs.reduce((total, job) => total + (job.requiredMaterials.find(material => material.materialId === materialId)?.quantity ?? 0), 0); }
export function availableStock(state: OperationalState, materialId: string) { const item = state.inventory.find(inventory => inventory.materialId === materialId); return item ? Math.max(0, item.currentStock - item.reservedStock) : 0; }
export function materialShortfall(state: OperationalState, materialId: string) { return Math.max(0, materialDemand(state, materialId) - availableStock(state, materialId)); }
