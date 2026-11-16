export interface BudgetCategory {
  id: 'transport' | 'hotel' | 'meal' | 'sightseeing' | 'contingency';
  name: string;
  shortName: string;
  allocated: number;
  spent: number;
  rawPercent: number;
  percent: number;
  remaining: number;
  overAmount: number;
  status: string;
  level: 'over' | 'near' | 'normal' | 'idle';
  count: number;
}
