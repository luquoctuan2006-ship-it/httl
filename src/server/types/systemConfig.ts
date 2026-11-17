export interface ReferenceCostRecord {
  id: string;
  category: string;
  item: string;
  price: string;
  note: string;
}

export interface SystemConfig {
  aiModel: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  maintenanceMode: boolean;
  sessionTimeout: string;
  backupAutoSchedule: string;
  rules: {
    bufferMinutes: string;
    startHour: string;
    endHour: string;
    budgetCapDaily: string;
    budgetAlertThreshold: string;
    contingencyPercent: string;
    citySpeedLimit: string;
    highwaySpeedLimit: string;
    passSpeedLimit: string;
    conflictChecks: Record<string, boolean>;
    optimizationPriorities: Record<string, boolean>;
  };
  referenceCosts: ReferenceCostRecord[];
}
