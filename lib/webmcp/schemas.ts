import type { JsonSchema } from "./types";

export const emptySchema: JsonSchema = { type: "object", properties: {}, additionalProperties: false };

export const inventorySchema: JsonSchema = {
  type: "object",
  properties: { materialId: { type: "string", description: "Optional material identifier such as al-6061." } },
  additionalProperties: false,
};

export const atRiskOrdersSchema: JsonSchema = {
  type: "object",
  properties: { severity: { type: "string", enum: ["critical", "at_risk", "all"], default: "all" } },
  additionalProperties: false,
};

export const supplierSearchSchema: JsonSchema = {
  type: "object",
  properties: {
    materialId: { type: "string" },
    quantityKg: { type: "number", exclusiveMinimum: 0 },
    requiredBy: { type: "string", description: "Optional ISO 8601 production deadline." },
  },
  required: ["materialId", "quantityKg"],
  additionalProperties: false,
};

export const supplierCompareSchema: JsonSchema = {
  type: "object",
  properties: {
    materialId: { type: "string" },
    quantityKg: { type: "number", exclusiveMinimum: 0 },
    requiredBy: { type: "string", description: "ISO 8601 production deadline." },
  },
  required: ["materialId", "quantityKg", "requiredBy"],
  additionalProperties: false,
};

export const simulateRecoverySchema: JsonSchema = {
  type: "object",
  properties: {
    supplierId: { type: "string" },
    quantityKg: { type: "number", exclusiveMinimum: 0 },
    expedited: { type: "boolean" },
    allowScheduleChanges: { type: "boolean" },
  },
  required: ["supplierId", "quantityKg", "expedited", "allowScheduleChanges"],
  additionalProperties: false,
};

export const planIdSchema: JsonSchema = {
  type: "object",
  properties: { recoveryPlanId: { type: "string" } },
  required: ["recoveryPlanId"],
  additionalProperties: false,
};

export const recoveryStatusSchema: JsonSchema = {
  type: "object",
  properties: { recoveryPlanId: { type: "string" } },
  additionalProperties: false,
};
