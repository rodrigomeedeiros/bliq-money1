
import React, { useState, useEffect, useMemo } from 'react';
import { FinanceState, MonthKey, Transaction, Category, UserProfile, AuthSession } from './types';
import { MONTHS, INITIAL_CATEGORIES } from './constants';
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import { getFinancialAdvice } from './services/geminiService';
import { authService } from './services/authService';

type AuthView = 'login' | 'signup' | 'forgot';
type MobileTab = 'home' | 'records' | 'ai';

const App: React.FC = () => {
  // --- Estados de Autenticação ---
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('bliq_current_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [authView, setAuthView] = useState<AuthView>('login');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState(localStorage.getItem('bliq_remember_email') || '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // --- Estados do App Financeiro ---
  const [state, setState] = useState<FinanceState>(() => {
    const saved = localStorage.getItem('bliq_money_v1');
    if (saved) return JSON.parse(saved);
    
    const initialMonths: { [key in MonthKey]?: any } = {};
    MONTHS.forEach(m => {
      initialMonths[m] = { transactions: [], settings: { carryOverBalance: false } };
    });
    return { months: initialMonths, categories: INITIAL_CATEGORIES };
  });

  const [currentMonth, setCurrentMonth] = useState<MonthKey>(MONTHS[new Date().getMonth()]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<MobileTab>('home');

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('bliq_money_v1', JSON.stringify(state));
      localStorage.setItem('bliq_current_user', JSON.stringify(currentUser));
    }
  }, [state, currentUser]);

  // --- Handlers de Autenticação ---
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      if (authView === 'login') {
        const session = await authService.login(email, password, rememberMe);
        setCurrentUser(session.user);
        if (rememberMe) localStorage.setItem('bliq_remember_email', email);
        else localStorage.removeItem('bliq_remember_email');
      } else if (authView === 'signup') {
        const session = await authService.signup(name, email, password, birthDate);
        setCurrentUser(session.user);
      } else {
        await authService.resetPassword(email);
        alert("Instruções de recuperação enviadas para seu e-mail.");
        setAuthView('login');
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('bliq_current_user');
  };

  // --- Lógica Financeira ---
  const calculateBalanceChain = (targetMonth: MonthKey): number => {
    let cumulative = 0;
    const targetIdx = MONTHS.indexOf(targetMonth);
    for (let i = 0; i <= targetIdx; i++) {
      const mKey = MONTHS[i];
      const mData = state.months[mKey];
      if (!mData) continue;
      if (i > 0 && !mData.settings.carryOverBalance) cumulative = 0;
      const mIncome = mData.transactions
        .filter(t => t.type === 'INCOME' && t.status === 'CONFIRMED')
        .reduce((sum, t) => sum + t.amount, 0);
      const mExpense = mData.transactions
        .filter(t => t.type === 'EXPENSE' && t.status === 'CONFIRMED')
        .reduce((sum, t) => sum + t.amount, 0);
      cumulative += (mIncome - mExpense);
    }
    return cumulative;
  };

  const currentMonthData = state.months[currentMonth] || { transactions: [], settings: { carryOverBalance: false } };

  const totals = useMemo(() => {
    const txs = currentMonthData.transactions;
    const prevIdx = MONTHS.indexOf(currentMonth) - 1;
    const carryAmount = (currentMonthData.settings.carryOverBalance && prevIdx >= 0) 
      ? calculateBalanceChain(MONTHS[prevIdx]) 
      : 0;
    const confirmedIncome = txs.filter(t => t.type === 'INCOME' && t.status === 'CONFIRMED').reduce((a, b) => a + b.amount, 0);
    const confirmedExpense = txs.filter(t => t.type === 'EXPENSE' && t.status === 'CONFIRMED').reduce((a, b) => a + b.amount, 0);
    const pendingIncome = txs.filter(t => t.type === 'INCOME' && t.status === 'PENDING').reduce((a, b) => a + b.amount, 0);
    const pendingExpense = txs.filter(t => t.type === 'EXPENSE' && t.status === 'PENDING').reduce((a, b) => a + b.amount, 0);
    return {
      carryAmount,
      income: confirmedIncome,
      expense: confirmedExpense,
      pendingIncome,
      pendingExpense,
      net: carryAmount + confirmedIncome - confirmedExpense,
      projected: carryAmount + (confirmedIncome + pendingIncome) - (confirmedExpense + pendingExpense)
    };
  }, [state, currentMonth]);

  const filteredTransactions = useMemo(() => {
    return currentMonthData.transactions.filter(t => {
      const matchSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = filterType === 'ALL' || t.type === filterType;
      return matchSearch && matchType;
    });
  }, [currentMonthData, searchTerm, filterType]);

  const handleSaveTransaction = (newTx: Omit<Transaction, 'id'> | Transaction) => {
    setState(prev => {
      const currentMonthTxs = [...(prev.months[currentMonth]?.transactions || [])];
      if ('id' in newTx) {
        const index = currentMonthTxs.findIndex(t => t.id === newTx.id);
        if (index !== -1) currentMonthTxs[index] = newTx as Transaction;
      } else {
        const tx: Transaction = { ...newTx, id: Math.random().toString(36).substring(2, 9) };
        currentMonthTxs.unshift(tx);
      }
      return {
        ...prev,
        months: { ...prev.months, [currentMonth]: { ...prev.months[currentMonth]!, transactions: currentMonthTxs } }
      };
    });
    setEditingTransaction(null);
  };

  const handleQuickConfirm = (id: string) => {
    setState(prev => {
      const currentMonthTxs = [...(prev.months[currentMonth]?.transactions || [])];
      const index = currentMonthTxs.findIndex(t => t.id === id);
      if (index !== -1) currentMonthTxs[index] = { ...currentMonthTxs[index], status: 'CONFIRMED' };
      return {
        ...prev,
        months: { ...prev.months, [currentMonth]: { ...prev.months[currentMonth]!, transactions: currentMonthTxs } }
      };
    });
  };

  const toggleCarryOver = () => {
    setState(prev => ({
      ...prev,
      months: { ...prev.months, [currentMonth]: { ...prev.months[currentMonth]!, settings: { ...prev.months[currentMonth]!.settings, carryOverBalance: !prev.months[currentMonth]!.settings.carryOverBalance } } }
    }));
  };

  const handleAddCategory = () => {
    if (!newCatName) return;
    const newCat: Category = { id: Math.random().toString(36).substring(2, 9), name: newCatName, icon: 'fa-tag', color: 'bg-slate-700' };
    setState(prev => ({ ...prev, categories: [...prev.categories, newCat] }));
    setNewCatName('');
  };

  const handleRemoveCategory = (id: string) => {
    setState(prev => ({ ...prev, categories: prev.categories.filter(c => c.id !== id) }));
  };

  const handleDeleteTransaction = (id: string) => {
    setState(prev => ({
      ...prev,
      months: { ...prev.months, [currentMonth]: { ...prev.months[currentMonth]!, transactions: prev.months[currentMonth]!.transactions.filter(t => t.id !== id) } }
    }));
  };

  // --- Renderização Tela de Autenticação ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-black flex flex-col lg:flex-row font-sans selection:bg-lime-500 selection:text-black">
        {/* Lado Esquerdo - Visual (Oculto no Mobile) */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 to-black items-center justify-center p-20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-lime-500/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="z-10 max-w-lg">
            <div className="w-20 h-20 bg-lime-500 rounded-[1.8rem] flex items-center justify-center shadow-[0_0_50px_rgba(190,242,100,0.3)] mb-10 rotate-6">
              <i className="fa-solid fa-bolt-lightning text-4xl text-black"></i>
            </div>
            <h2 className="text-6xl font-black text-white leading-[1.1] tracking-tighter mb-6">
              DOMINE SEU <br /> <span className="text-lime-400">PATRIMÔNIO.</span>
            </h2>
            <p className="text-slate-400 text-lg font-medium leading-relaxed">
              A ferramenta de elite para gestão financeira estratégica. <br />
              Simples, poderosa e impulsionada por IA.
            </p>
          </div>
        </div>

        {/* Lado Direito - Formulário */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-20 relative">
          <div className="w-full max-w-md">
            <div className="lg:hidden text-center mb-10">
              <div className="w-16 h-16 bg-lime-500 rounded-2xl flex items-center justify-center shadow-lg shadow-lime-500/20 mx-auto mb-4">
                <i className="fa-solid fa-bolt-lightning text-2xl text-black"></i>
              </div>
              <h1 className="text-3xl font-black text-white tracking-tighter">BLIQ MONEY</h1>
            </div>

            <div className="mb-8">
              <h3 className="text-2xl font-black text-white tracking-tight">
                {authView === 'login' ? 'Bem-vindo de volta' : authView === 'signup' ? 'Crie sua conta' : 'Recupere sua senha'}
              </h3>
              <p className="text-slate-500 text-sm font-bold mt-1 uppercase tracking-widest">
                {authView === 'login' ? 'Insira suas credenciais de acesso' : authView === 'signup' ? 'Preencha os dados para começar' : 'Enviaremos um link seguro'}
              </p>
            </div>

            {authError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-4 rounded-2xl text-xs font-black uppercase mb-6 animate-pulse">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authView === 'signup' && (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Nome Completo</label>
                    <input required type="text" placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-900/50 border border-white/5 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-lime-500 outline-none transition-all font-bold placeholder:text-slate-700" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Data de Nascimento</label>
                    <input required type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full bg-slate-900/50 border border-white/5 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-lime-500 outline-none transition-all font-bold" />
                  </div>
                </>
              )}

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">E-mail</label>
                <input required type="email" placeholder="email@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-900/50 border border-white/5 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-lime-500 outline-none transition-all font-bold placeholder:text-slate-700" />
              </div>

              {authView !== 'forgot' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha</label>
                    {authView === 'login' && (
                      <button type="button" onClick={() => setAuthView('forgot')} className="text-[10px] font-black text-lime-400 uppercase tracking-widest hover:text-white transition-colors">Esqueci a senha</button>
                    )}
                  </div>
                  <input required type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-900/50 border border-white/5 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-lime-500 outline-none transition-all font-bold placeholder:text-slate-700" />
                </div>
              )}

              {authView === 'login' && (
                <label className="flex items-center gap-3 cursor-pointer group py-2">
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="hidden" />
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${rememberMe ? 'bg-lime-500 border-lime-500' : 'border-white/10 bg-black/40'}`}>
                    {rememberMe && <i className="fa-solid fa-check text-black text-[10px]"></i>}
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-300 transition-colors">Lembrar-me</span>
                </label>
              )}

              <button disabled={isAuthLoading} type="submit" className="w-full bg-white hover:bg-lime-500 text-black py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-white/5 active:scale-95 disabled:opacity-50">
                {isAuthLoading ? 'Processando...' : authView === 'login' ? 'Entrar no Bliq' : authView === 'signup' ? 'Criar minha conta' : 'Enviar Link'}
              </button>
            </form>

            <div className="relative my-10 text-center">
              <div className="absolute top-1/2 left-0 right-0 h-px bg-white/5"></div>
              <span className="relative z-10 bg-black px-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Ou continue com</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button className="flex items-center justify-center gap-3 bg-white/5 border border-white/5 py-4 rounded-2xl hover:bg-white/10 transition-all">
                <i className="fa-brands fa-google text-white"></i>
                <span className="text-[10px] font-black uppercase tracking-widest">Google</span>
              </button>
              <button className="flex items-center justify-center gap-3 bg-white/5 border border-white/5 py-4 rounded-2xl hover:bg-white/10 transition-all">
                <i className="fa-brands fa-apple text-white text-base"></i>
                <span className="text-[10px] font-black uppercase tracking-widest">Apple</span>
              </button>
            </div>

            <p className="mt-10 text-center text-[11px] font-bold text-slate-500">
              {authView === 'login' ? "Não tem uma conta?" : "Já possui uma conta?"}{' '}
              <button onClick={() => setAuthView(authView === 'login' ? 'signup' : 'login')} className="text-lime-400 font-black uppercase tracking-widest hover:underline ml-1">
                {authView === 'login' ? 'Cadastre-se' : 'Faça Login'}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- Renderização do Dashboard Principal (Só após login) ---
  return (
    <div className="min-h-screen bg-[#000000] text-white font-sans selection:bg-lime-500 selection:text-black">
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/5 py-4">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-lime-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(190,242,100,0.4)]">
              <i className="fa-solid fa-bolt-lightning text-xl text-black"></i>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter leading-none">BLIQ <span className="text-lime-400">MONEY</span></h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">Olá, {currentUser.name.split(' ')[0]}</p>
            </div>
          </div>

          <nav className="hidden lg:flex items-center bg-white/5 p-1 rounded-xl border border-white/5">
            {MONTHS.map(month => (
              <button key={month} onClick={() => setCurrentMonth(month)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest ${currentMonth === month ? 'bg-white text-black' : 'text-slate-500 hover:text-white'}`}>{month.substring(0, 3)}</button>
            ))}
          </nav>
          
          <div className="flex items-center gap-4">
            <div className="lg:hidden">
               <select value={currentMonth} onChange={(e) => setCurrentMonth(e.target.value as MonthKey)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white outline-none">
                  {MONTHS.map(m => <option key={m} value={m} className="bg-slate-900">{m}</option>)}
               </select>
            </div>
            <button onClick={handleLogout} title="Sair do App" className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-500 hover:text-rose-500 transition-all">
              <i className="fa-solid fa-power-off text-sm"></i>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-8 pb-32">
        <div className={`${activeTab === 'home' ? 'block' : 'hidden'} lg:block space-y-8`}>
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Abertura</span>
                <button onClick={toggleCarryOver} className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${currentMonthData.settings.carryOverBalance ? 'bg-lime-500/10 text-lime-400 border border-lime-500/20' : 'bg-white/5 text-slate-700 border border-white/5'}`}>
                  <i className={`fa-solid ${currentMonthData.settings.carryOverBalance ? 'fa-link' : 'fa-link-slash'} text-[10px]`}></i>
                </button>
              </div>
              <div className={`text-lg font-black mt-2 ${totals.carryAmount >= 0 ? 'text-white' : 'text-[#E52B50]'}`}>R$ {totals.carryAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5">
              <span className="text-[10px] font-black text-lime-400 uppercase tracking-widest">Realizado</span>
              <div className="text-lg font-black text-white mt-2">R$ {(totals.income - totals.expense).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-gradient-to-br from-[#E52B50] to-[#8B1A31] p-5 rounded-2xl border border-white/10 shadow-lg shadow-rose-950/20">
              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Saldo Atual</span>
              <div className="text-xl font-black text-white mt-2">R$ {totals.net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5">
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Projetado</span>
              <div className="text-lg font-black text-white mt-2">R$ {totals.projected.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
          </section>
          <Dashboard data={state} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
          <div className={`${activeTab === 'records' ? 'block' : 'hidden'} lg:block lg:col-span-8 space-y-6`}>
            <div className="bg-slate-900/30 rounded-3xl border border-white/5 overflow-hidden">
              <div className="p-6 border-b border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 w-full md:w-auto">
                  <button onClick={() => setFilterType('ALL')} className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-[9px] font-black transition-all ${filterType === 'ALL' ? 'bg-white/10 text-white' : 'text-slate-600'}`}>TODOS</button>
                  <button onClick={() => setFilterType('INCOME')} className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-[9px] font-black transition-all ${filterType === 'INCOME' ? 'text-lime-400' : 'text-slate-600'}`}>RECEITAS</button>
                  <button onClick={() => setFilterType('EXPENSE')} className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-[9px] font-black transition-all ${filterType === 'EXPENSE' ? 'text-[#E52B50]' : 'text-slate-600'}`}>DESPESAS</button>
                </div>
                <div className="relative w-full md:w-64">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-700 text-xs"></i>
                  <input type="text" placeholder="Filtrar lançamentos..." className="w-full bg-black/40 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-1 focus:ring-lime-500 outline-none transition-all placeholder:text-slate-700 font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="hidden lg:flex gap-2 w-full md:w-auto">
                  <button onClick={() => setIsCatModalOpen(true)} className="flex-1 md:flex-none p-2 border border-white/5 rounded-xl text-slate-500 hover:text-white transition-all"><i className="fa-solid fa-tags"></i></button>
                  <button onClick={() => setIsModalOpen(true)} className="flex-[3] md:flex-none bg-lime-500 hover:bg-lime-400 text-black font-black text-[10px] px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-lime-500/10 uppercase tracking-widest">Novo Lançamento</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5 text-[9px] font-black text-slate-600 uppercase tracking-widest">
                      <th className="px-6 py-4 text-left">Descrição</th>
                      <th className="px-6 py-4 text-left">Status</th>
                      <th className="hidden md:table-cell px-6 py-4 text-left">Data</th>
                      <th className="px-6 py-4 text-right">Valor</th>
                      <th className="px-6 py-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredTransactions.length === 0 ? (
                      <tr><td colSpan={5} className="py-20 text-center text-slate-800 text-[10px] font-black uppercase tracking-[0.3em]">Nenhum registro encontrado</td></tr>
                    ) : (
                      filteredTransactions.map(tx => (
                        <tr key={tx.id} className="group hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-white leading-tight">{tx.description}</div>
                            <div className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter mt-1">{tx.category}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-1 rounded-md text-[8px] font-black tracking-widest border ${tx.status === 'CONFIRMED' ? (tx.type === 'INCOME' ? 'border-lime-500/20 bg-lime-500/5 text-lime-400' : 'border-[#E52B50]/20 bg-[#E52B50]/5 text-[#E52B50]') : 'border-amber-500/20 bg-amber-500/5 text-amber-400'}`}>
                                {tx.status === 'CONFIRMED' ? (tx.type === 'INCOME' ? 'RECEBIDO' : 'PAGO') : (tx.type === 'INCOME' ? 'A RECEBER' : 'A PAGAR')}
                              </span>
                              {tx.status === 'PENDING' && <button onClick={() => handleQuickConfirm(tx.id)} className="w-6 h-6 rounded-md bg-white/5 border border-white/5 flex items-center justify-center text-lime-400 hover:bg-lime-500/20 transition-all"><i className="fa-solid fa-check text-[10px]"></i></button>}
                            </div>
                          </td>
                          <td className="hidden md:table-cell px-6 py-4 text-[10px] text-slate-500 font-bold uppercase">{new Date(tx.date).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}</td>
                          <td className={`px-6 py-4 text-right font-black text-sm tabular-nums ${tx.type === 'INCOME' ? 'text-lime-400' : 'text-white'}`}>{tx.type === 'INCOME' ? '+' : '-'} {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2 lg:opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => setEditingTransaction(tx)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-all"><i className="fa-solid fa-pen-to-square text-xs"></i></button>
                              <button onClick={() => handleDeleteTransaction(tx.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-all"><i className="fa-solid fa-trash text-xs"></i></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className={`${activeTab === 'ai' ? 'block' : 'hidden'} lg:block lg:col-span-4 space-y-6`}>
            <div className="bg-gradient-to-br from-slate-900 to-black p-6 rounded-3xl border border-white/5 relative overflow-hidden group">
               <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-lime-500/10 flex items-center justify-center border border-lime-500/20">
                  <i className="fa-solid fa-brain text-lime-400 text-lg"></i>
                </div>
                <h3 className="font-black text-xs uppercase tracking-widest text-white">Análise Bliq IA</h3>
              </div>
              <button onClick={async () => { setIsAiLoading(true); const advice = await getFinancialAdvice(currentMonth, currentMonthData.transactions); setAiInsight(advice); setIsAiLoading(false); }} disabled={isAiLoading} className="w-full bg-white text-black py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50">{isAiLoading ? 'Processando...' : 'Consultar Estratégia'}</button>
              {aiInsight && <div className="mt-6 p-4 bg-black/40 rounded-xl text-[11px] text-slate-400 leading-relaxed border border-white/5 max-h-[50vh] lg:max-h-80 overflow-y-auto">{aiInsight.split('\n').map((l, i) => <p key={i} className="mb-2">{l}</p>)}</div>}
            </div>

            <div className="bg-slate-900/40 p-6 rounded-3xl border border-white/5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-black text-[10px] text-slate-600 uppercase tracking-widest">Setores Ativos</h4>
                <button onClick={() => setIsCatModalOpen(true)} className="lg:hidden text-lime-400 text-xs font-black uppercase tracking-widest">+ Novo</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {state.categories.map(cat => (
                  <div key={cat.id} className="group flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-lg text-[9px] font-black uppercase text-slate-400 border border-white/5">
                    <i className={`fa-solid ${cat.icon} text-lime-500/50`}></i>
                    {cat.name}
                    <button onClick={() => handleRemoveCategory(cat.id)} className="opacity-0 lg:group-hover:opacity-100 hover:text-rose-500 transition-all"><i className="fa-solid fa-xmark"></i></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] z-[100]">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl h-16 flex items-center justify-around px-2 shadow-2xl relative">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all ${activeTab === 'home' ? 'text-lime-400 bg-lime-400/10' : 'text-slate-500'}`}><i className="fa-solid fa-house-chimney text-lg"></i><span className="text-[8px] font-black uppercase mt-1">Início</span></button>
          <button onClick={() => setActiveTab('records')} className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all ${activeTab === 'records' ? 'text-lime-400 bg-lime-400/10' : 'text-slate-500'}`}><i className="fa-solid fa-list-ul text-lg"></i><span className="text-[8px] font-black uppercase mt-1">Extrato</span></button>
          <div className="relative -top-6"><button onClick={() => setIsModalOpen(true)} className="w-16 h-16 bg-lime-500 text-black rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(190,242,100,0.5)] border-4 border-[#000000] active:scale-90 transition-all"><i className="fa-solid fa-plus text-2xl"></i></button></div>
          <button onClick={() => setActiveTab('ai')} className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all ${activeTab === 'ai' ? 'text-lime-400 bg-lime-400/10' : 'text-slate-500'}`}><i className="fa-solid fa-brain text-lg"></i><span className="text-[8px] font-black uppercase mt-1">Insights</span></button>
          <button onClick={handleLogout} className="flex flex-col items-center justify-center w-12 h-12 rounded-xl text-slate-500"><i className="fa-solid fa-power-off text-lg"></i><span className="text-[8px] font-black uppercase mt-1">Sair</span></button>
        </div>
      </div>

      {(isModalOpen || editingTransaction) && (
        <TransactionForm categories={state.categories} initialData={editingTransaction || undefined} onSave={handleSaveTransaction} onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }} />
      )}
      
      {isCatModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-sm p-8 shadow-2xl">
            <h3 className="text-lg font-black text-white uppercase tracking-tighter italic mb-6">Novo Setor</h3>
            <input type="text" placeholder="Ex: Assinaturas, Pet..." className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-lime-500 outline-none mb-6 font-bold" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} autoFocus />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setIsCatModalOpen(false)} className="py-3 text-slate-500 font-black text-[10px] uppercase tracking-widest">Cancelar</button>
              <button onClick={() => { handleAddCategory(); setIsCatModalOpen(false); }} className="bg-lime-500 text-black py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-lime-500/10">Adicionar</button>
            </div>
          </div>
        </div>
      )}

      <footer className="hidden lg:block py-10 text-center opacity-30">
        <div className="text-[9px] font-black uppercase tracking-[0.5em]">&copy; 2024 BLIQ MONEY EXPERT</div>
      </footer>
    </div>
  );
};

export default App;
