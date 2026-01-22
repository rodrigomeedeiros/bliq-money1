
import { Category, MonthKey } from './types';

export const MONTHS: MonthKey[] = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: '1', name: 'Moradia', icon: 'fa-house', color: 'bg-slate-700' },
  { id: '2', name: 'Alimentação', icon: 'fa-utensils', color: 'bg-slate-700' },
  { id: '3', name: 'Transporte', icon: 'fa-car', color: 'bg-slate-700' },
  { id: '4', name: 'Lazer', icon: 'fa-gamepad', color: 'bg-slate-700' },
  { id: '5', name: 'Salário', icon: 'fa-money-bill-trend-up', color: 'bg-lime-500' },
  { id: '6', name: 'Outros', icon: 'fa-tags', color: 'bg-slate-700' },
];
