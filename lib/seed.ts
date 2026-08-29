import type { OperationalState } from "./models";

export const initialState: OperationalState = {
  materials: [
    { id: "al-6061", name: "Aluminium 6061 Sheet", sku: "RM-AL-6061", unit: "kg" },
    { id: "epoxy", name: "Industrial Epoxy Resin", sku: "RM-EP-204", unit: "L" },
    { id: "fasteners", name: "Stainless Fastener Kit", sku: "RM-SF-018", unit: "kit" },
    { id: "powder", name: "Graphite Powder Coat", sku: "RM-PC-044", unit: "kg" }
  ],
  inventory: [
    { materialId: "al-6061", currentStock: 1840, reservedStock: 1320, incomingStock: 5000, reorderThreshold: 900, dailyUsage: 480, status: "at-risk" },
    { materialId: "epoxy", currentStock: 890, reservedStock: 510, incomingStock: 1200, reorderThreshold: 350, dailyUsage: 145, status: "healthy" },
    { materialId: "fasteners", currentStock: 4200, reservedStock: 1820, incomingStock: 0, reorderThreshold: 1000, dailyUsage: 620, status: "watch" },
    { materialId: "powder", currentStock: 780, reservedStock: 460, incomingStock: 900, reorderThreshold: 250, dailyUsage: 75, status: "healthy" }
  ],
  suppliers: [
    { id: "northstar", name: "Northstar Metals", city: "Johannesburg", reliability: 96 },
    { id: "allied", name: "Allied Industrial Supply", city: "Pretoria", reliability: 92 },
    { id: "capetown", name: "Cape Alloy Works", city: "Cape Town", reliability: 88 },
    { id: "metrolink", name: "MetroLink Materials", city: "Durban", reliability: 84 }
  ],
  quotes: [
    { id: "q1", supplierId: "northstar", materialId: "al-6061", unitPrice: 82, availableQuantity: 5000, leadTimeHours: 48, expeditedLeadTimeHours: null, expeditedDeliveryCost: null, minimumOrderQuantity: 1000 },
    { id: "q2", supplierId: "allied", materialId: "al-6061", unitPrice: 89, availableQuantity: 1900, leadTimeHours: 18, expeditedLeadTimeHours: 12, expeditedDeliveryCost: 7800, minimumOrderQuantity: 500 },
    { id: "q3", supplierId: "capetown", materialId: "al-6061", unitPrice: 84, availableQuantity: 3200, leadTimeHours: 36, expeditedLeadTimeHours: 24, expeditedDeliveryCost: 14600, minimumOrderQuantity: 750 },
    { id: "q4", supplierId: "metrolink", materialId: "al-6061", unitPrice: 97, availableQuantity: 900, leadTimeHours: 14, expeditedLeadTimeHours: 8, expeditedDeliveryCost: 11200, minimumOrderQuantity: 300 }
  ],
  orders: [
    { id: "o1", number: "SO-10482", customer: "Atlas Build Group", product: "Apex Utility Frame", quantity: 240, deadline: "Tomorrow, 14:00", revenue: 186000, risk: "critical", jobId: "j1" },
    { id: "o2", number: "SO-10487", customer: "Kinetic Logistics", product: "Apex Utility Frame", quantity: 180, deadline: "Tomorrow, 17:00", revenue: 139500, risk: "at-risk", jobId: "j2" },
    { id: "o3", number: "SO-10491", customer: "Morrow Facilities", product: "Edge Mount Bracket", quantity: 500, deadline: "Fri, 11:00", revenue: 97500, risk: "at-risk", jobId: "j3" },
    { id: "o4", number: "SO-10496", customer: "Vantage Retail", product: "Edge Mount Bracket", quantity: 360, deadline: "Mon, 10:00", revenue: 68400, risk: "healthy", jobId: "j4" }
  ],
  jobs: [
    { id: "j1", number: "JOB-7218", product: "Apex Utility Frame", startTime: "06:00", endTime: "10:30", quantity: 240, requiredMaterials: [{ materialId: "al-6061", quantity: 720 }, { materialId: "fasteners", quantity: 480 }], status: "blocked" },
    { id: "j2", number: "JOB-7220", product: "Apex Utility Frame", startTime: "10:45", endTime: "14:15", quantity: 180, requiredMaterials: [{ materialId: "al-6061", quantity: 540 }, { materialId: "fasteners", quantity: 360 }], status: "blocked" },
    { id: "j3", number: "JOB-7221", product: "Edge Mount Bracket", startTime: "14:30", endTime: "17:30", quantity: 500, requiredMaterials: [{ materialId: "al-6061", quantity: 600 }, { materialId: "powder", quantity: 95 }], status: "at-risk" },
    { id: "j4", number: "JOB-7224", product: "Edge Mount Bracket", startTime: "18:00", endTime: "20:00", quantity: 360, requiredMaterials: [{ materialId: "epoxy", quantity: 180 }, { materialId: "fasteners", quantity: 720 }], status: "scheduled" }
  ],
  purchaseOrders: [{ id: "po1", number: "PO-3091", supplierId: "northstar", materialId: "al-6061", quantity: 5000, expectedAt: "Saturday, 06:00", status: "at-risk" }],
  incidents: [
    { id: "inc-01", title: "Supplier delivery delayed 48 hours", supplierId: "northstar", materialId: "al-6061", delayHours: 48, severity: "critical", status: "active", stage: "impact_calculated", affectedJobIds: ["j1", "j2", "j3"], affectedOrderIds: ["o1", "o2", "o3"], estimatedImpact: 423000, initialFinancialExposure: 423000 },
    { id: "inc-02", title: "Unexpected demand spike", supplierId: "allied", materialId: "fasteners", delayHours: 0, severity: "high", status: "monitoring", stage: "incident_detected", affectedJobIds: ["j4"], affectedOrderIds: ["o4"], estimatedImpact: 68400, initialFinancialExposure: 68400 },
    { id: "inc-03", title: "Production machine downtime", supplierId: "metrolink", materialId: "epoxy", delayHours: 0, severity: "high", status: "monitoring", stage: "investigation_in_progress", affectedJobIds: ["j4"], affectedOrderIds: ["o4"], estimatedImpact: 34200, initialFinancialExposure: 34200 }
  ],
  recoveryPlans: [],
  activities: [
    { id: "a1", timestamp: "08:42", actor: "System", message: "Northstar Metals updated PO-3091 delivery estimate.", tone: "alert" },
    { id: "a2", timestamp: "08:43", actor: "Operations Agent", message: "Material coverage recalculated: aluminium shortfall detected at 12:15 tomorrow.", tone: "alert" },
    { id: "a3", timestamp: "08:44", actor: "Operations Agent", message: "Three customer orders and three production jobs linked to incident impact.", tone: "neutral" },
    { id: "a4", timestamp: "08:45", actor: "System", message: "Incident impact calculation complete. Recovery investigation has not started.", tone: "neutral" }
  ]
};
