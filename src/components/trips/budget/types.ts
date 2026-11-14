export interface BudgetCategory {
  id: 'transport' | 'hotel' | 'meal' | 'sightseeing' | 'contingency';
  name: string;
  allocated: number;
  spent: number;
  percent: number;
  status: string;
  count: number;
}
