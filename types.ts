
export type TransactionType = 'INCOME' | 'EXPENSE';
export type TransactionStatus = 'CONFIRMED' | 'PENDING';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  type: TransactionType;
  status: TransactionStatus;
}

export type MonthKey = 
  | 'Janeiro' | 'Fevereiro' | 'Março' | 'Abril' | 'Maio' | 'Junho'
  | 'Julho' | 'Agosto' | 'Setembro' | 'Outubro' | 'Novembro' | 'Dezembro';

export interface MonthSettings {
  carryOverBalance: boolean;
}

export interface MonthData {
  transactions: Transaction[];
  settings: MonthSettings;
}

export interface FinanceState {
  months: { [key in MonthKey]?: MonthData };
  categories: Category[];
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  birthDate: string;
  createdAt: string;
  avatar?: string;
}

export interface AuthSession {
  user: UserProfile;
  token: string;
}
