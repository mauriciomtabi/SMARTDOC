import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Transaction } from '../types';
import { DollarSign, TrendingUp, TrendingDown, Plus, Mic, ChevronLeft, ChevronRight, Search, Edit2, Trash2, PieChart, Wallet, Clock, Loader2, X, Save, BarChart3, Calendar, Copy, CheckCircle, Minus, Tag, MinusCircle, Share2, MessageCircle, Download, Clipboard, FileImage, Filter, SortAsc, SortDesc, ArrowUpDown, Undo2, AlertTriangle, Check, Layers, CheckSquare, Square, Eye, EyeOff } from 'lucide-react';
import { AudioRecorder } from './AudioRecorder';
import html2canvas from 'html2canvas';

interface FinanceDashboardProps {
    session: any;
    demoMode?: boolean; // Prop para ativar modo tutorial
}

interface Category {
    id: string;
    name: string;
}

type TabView = 'transactions' | 'analytics';
type SortOption = 'date' | 'alpha' | 'amount';
type FilterStatus = 'all' | 'paid' | 'pending';

const PAYMENT_METHODS = ['Pix', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro', 'Boleto', 'Transferência', 'Outros'];

// Dados Mockados para o Tutorial
const MOCK_TRANSACTIONS: Transaction[] = [
    { id: '1', description: 'Salário Mensal', amount: 5200, type: 'income', status: 'paid', category: 'Salário', paymentMethod: 'Transferência', date: new Date().toISOString().split('T')[0], createdAt: Date.now() },
    { id: '2', description: 'Supermercado Compra', amount: 450.50, type: 'expense', status: 'paid', category: 'Alimentação', paymentMethod: 'Cartão de Crédito', date: new Date().toISOString().split('T')[0], createdAt: Date.now() },
    { id: '3', description: 'Uber para Trabalho', amount: 24.90, type: 'expense', status: 'paid', category: 'Transporte', paymentMethod: 'Pix', date: new Date().toISOString().split('T')[0], createdAt: Date.now() },
    { id: '4', description: 'Conta de Luz', amount: 180.00, type: 'expense', status: 'pending', category: 'Contas', paymentMethod: 'Boleto', date: new Date().toISOString().split('T')[0], createdAt: Date.now() },
    { id: '5', description: 'Cinema Fim de Semana', amount: 85.00, type: 'expense', status: 'paid', category: 'Lazer', paymentMethod: 'Cartão de Débito', date: new Date(Date.now() - 86400000).toISOString().split('T')[0], createdAt: Date.now() },
];

const MOCK_CATEGORIES: Category[] = [
    { id: '1', name: 'Alimentação' },
    { id: '2', name: 'Transporte' },
    { id: '3', name: 'Lazer' },
    { id: '4', name: 'Salário' },
    { id: '5', name: 'Contas' },
];

export const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ session, demoMode = false }) => {
    const [activeTab, setActiveTab] = useState<TabView>('transactions');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Sort & Filter States
    const [sortBy, setSortBy] = useState<SortOption>('date');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

    // Dates
    const [selectedDate, setSelectedDate] = useState(new Date()); 
    const [viewYear, setViewYear] = useState(new Date().getFullYear());

    // Modal States
    const [isSaving, setIsSaving] = useState(false); 
    const [showAddModal, setShowAddModal] = useState(false);
    
    // Notification & Confirmation States
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, description: string } | null>(null);

    // Share / Preview States
    const [showShareModal, setShowShareModal] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);
    
    // Replication States
    const [showReplicationModal, setShowReplicationModal] = useState(false);
    const [replicationCandidates, setReplicationCandidates] = useState<Transaction[]>([]);
    const [selectedReplicationIds, setSelectedReplicationIds] = useState<string[]>([]);
    const [isReplicating, setIsReplicating] = useState(false);

    const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
    const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
    const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    const dateInputRef = useRef<HTMLInputElement>(null);

    // Form Data
    const [formData, setFormData] = useState<Partial<Transaction>>({
        description: '',
        amount: 0,
        type: 'expense',
        status: 'pending',
        date: new Date().toISOString().split('T')[0],
        category: '',
        paymentMethod: 'Pix'
    });

    const [isInstallment, setIsInstallment] = useState(false);
    const [installmentsCount, setInstallmentsCount] = useState(2);

    const [showCategoryManager, setShowCategoryManager] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [managerCategoryName, setManagerCategoryName] = useState('');
    const [categoryDeleteConfirm, setCategoryDeleteConfirm] = useState<Category | null>(null);

    const handleSaveCategoryManager = async () => {
        if (!managerCategoryName.trim()) return;
        
        if (demoMode) {
            if (editingCategory) {
                setCategories(prev => prev.map(c => c.id === editingCategory.id ? { ...c, name: managerCategoryName.trim() } : c));
                setTransactions(prev => prev.map(t => t.category === editingCategory.name ? { ...t, category: managerCategoryName.trim() } : t));
                showToast("Categoria atualizada!");
            } else {
                const newCat = { id: `demo-cat-${Date.now()}`, name: managerCategoryName.trim() };
                setCategories(prev => [...prev, newCat]);
                showToast("Categoria criada!");
            }
            setEditingCategory(null);
            setManagerCategoryName('');
            return;
        }

        try {
            if (editingCategory) {
                const { error } = await supabase.from('transaction_categories').update({ name: managerCategoryName.trim() }).eq('id', editingCategory.id);
                if (error) throw error;
                
                // Update transactions that used the old category name
                await supabase.from('transactions').update({ category: managerCategoryName.trim() }).eq('category', editingCategory.name);
                
                setCategories(prev => prev.map(c => c.id === editingCategory.id ? { ...c, name: managerCategoryName.trim() } : c));
                setTransactions(prev => prev.map(t => t.category === editingCategory.name ? { ...t, category: managerCategoryName.trim() } : t));
                showToast("Categoria atualizada!");
            } else {
                const { data, error } = await supabase.from('transaction_categories').insert({
                    user_id: session.user.id,
                    name: managerCategoryName.trim(),
                    created_at: Date.now()
                }).select().single();
                if (error) throw error;
                if (data) {
                    setCategories(prev => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)));
                    showToast("Categoria criada!");
                }
            }
            setEditingCategory(null);
            setManagerCategoryName('');
        } catch (e) {
            console.error(e);
            showToast("Erro ao salvar categoria.", "error");
        }
    };

    const handleDeleteCategory = (cat: Category) => {
        setCategoryDeleteConfirm(cat);
    };

    const confirmDeleteCategory = async () => {
        if (!categoryDeleteConfirm) return;
        const cat = categoryDeleteConfirm;

        if (demoMode) {
            setCategories(prev => prev.filter(c => c.id !== cat.id));
            showToast("Categoria excluída!");
            setCategoryDeleteConfirm(null);
            return;
        }
        try {
            const { error } = await supabase.from('transaction_categories').delete().eq('id', cat.id);
            if (error) throw error;
            setCategories(prev => prev.filter(c => c.id !== cat.id));
            showToast("Categoria excluída!");
        } catch (e) {
            console.error(e);
            showToast("Erro ao excluir categoria.", "error");
        }
        setCategoryDeleteConfirm(null);
    };

    const [isFabOpen, setIsFabOpen] = useState(false);
    const [showValues, setShowValues] = useState(true);

    useEffect(() => {
        if (demoMode) {
            setTransactions(MOCK_TRANSACTIONS);
            setCategories(MOCK_CATEGORIES);
            setFormData(prev => ({ ...prev, category: MOCK_CATEGORIES[0].name }));
            setIsLoading(false);
        } else {
            fetchTransactions();
            fetchCategories();
        }
    }, [demoMode]);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3500);
    };

    const fetchCategories = async () => {
        try {
            const { data, error } = await supabase.from('transaction_categories').select('*').order('name');
            if (error) throw error;
            if (data && data.length > 0) {
                setCategories(data);
                if (!formData.category) setFormData(prev => ({ ...prev, category: data[0].name }));
            }
        } catch (error) { console.error(error); }
    };

    const fetchTransactions = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .order('date', { ascending: false });
            if (error) throw error;
            if (data) {
                setTransactions(data.map((t: any) => ({
                    id: t.id,
                    description: t.description,
                    amount: Number(t.amount),
                    type: t.type,
                    status: t.status,
                    category: t.category,
                    paymentMethod: t.payment_method || 'Outros',
                    installmentsInfo: t.installments_info, 
                    date: t.date,
                    createdAt: t.created_at
                })));
            }
        } catch (error) { console.error(error); } finally { setIsLoading(false); }
    };

    // --- REPLICATION LOGIC ---
    const handlePrepareReplication = () => {
        const prevDate = new Date(selectedDate);
        prevDate.setMonth(prevDate.getMonth() - 1);
        
        const targetMonth = prevDate.getMonth();
        const targetYear = prevDate.getFullYear();

        const expensesToCopy = transactions.filter(t => {
            const tDate = new Date(t.date + 'T12:00:00');
            return (
                tDate.getMonth() === targetMonth &&
                tDate.getFullYear() === targetYear &&
                t.type === 'expense' && 
                !t.installmentsInfo 
            );
        });

        if (expensesToCopy.length === 0) {
            showToast(`Nenhuma despesa elegível encontrada em ${prevDate.toLocaleDateString('pt-BR', { month: 'long' })}.`, 'error');
            return;
        }

        setReplicationCandidates(expensesToCopy);
        setSelectedReplicationIds(expensesToCopy.map(t => t.id)); 
        setShowReplicationModal(true);
    };

    const toggleReplicationSelection = (id: string) => {
        setSelectedReplicationIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleAllReplication = () => {
        if (selectedReplicationIds.length === replicationCandidates.length) {
            setSelectedReplicationIds([]); // Deselect all
        } else {
            setSelectedReplicationIds(replicationCandidates.map(t => t.id)); // Select all
        }
    };

    const confirmReplication = async () => {
        if (selectedReplicationIds.length === 0) return;
        
        setIsReplicating(true);
        try {
            const currentYear = selectedDate.getFullYear();
            const currentMonth = selectedDate.getMonth();
            const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

            const itemsToCopy = replicationCandidates.filter(t => selectedReplicationIds.includes(t.id));

            const newTransactionsPayload = itemsToCopy.map(t => {
                const originalDate = new Date(t.date + 'T12:00:00');
                const newDay = Math.min(originalDate.getDate(), daysInCurrentMonth);
                const newDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`;

                return {
                    user_id: session.user.id,
                    description: t.description,
                    amount: t.amount,
                    type: 'expense',
                    status: 'pending', 
                    category: t.category,
                    payment_method: t.paymentMethod,
                    date: newDateStr,
                    created_at: Date.now()
                };
            });

            if (!demoMode) {
                const { error } = await supabase.from('transactions').insert(newTransactionsPayload);
                if (error) throw error;
                await fetchTransactions();
            } else {
                 // Demo Mode Replication
                 const newDemoTrans = newTransactionsPayload.map((t, idx) => ({
                    ...t,
                    id: `new-demo-${Date.now()}-${idx}`,
                    category: t.category || 'Geral',
                    paymentMethod: t.payment_method || 'Outros',
                    installmentsInfo: undefined
                 } as Transaction));
                 setTransactions(prev => [...newDemoTrans, ...prev]);
            }

            setShowReplicationModal(false);
            showToast(`${newTransactionsPayload.length} despesas replicadas com sucesso!`);
            
        } catch (e) {
            console.error(e);
            showToast("Erro ao replicar despesas.", "error");
        } finally {
            setIsReplicating(false);
        }
    };

    // --- FORM LOGIC ---
    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        if (demoMode) {
             const newCat = { id: `demo-cat-${Date.now()}`, name: newCategoryName.trim() };
             setCategories(prev => [...prev, newCat]);
             setFormData(prev => ({ ...prev, category: newCat.name }));
             setNewCategoryName('');
             setShowNewCategoryInput(false);
             return;
        }

        try {
            const { data, error } = await supabase.from('transaction_categories').insert({
                user_id: session.user.id,
                name: newCategoryName.trim(),
                created_at: Date.now()
            }).select().single();
            if (error) throw error;
            if (data) {
                setCategories(prev => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)));
                setFormData(prev => ({ ...prev, category: data.name }));
                setNewCategoryName('');
                setShowNewCategoryInput(false);
            }
        } catch (e) { console.error(e); }
    };

    const handleSave = async () => {
        if (!formData.description || !formData.amount) {
            showToast("Preencha descrição e valor.", "error");
            return;
        }
        setIsSaving(true);
        
        // --- DEMO MODE SAVE ---
        if (demoMode) {
            setTimeout(() => {
                const newT: Transaction = {
                    id: `demo-${Date.now()}`,
                    description: formData.description!,
                    amount: Number(formData.amount),
                    type: formData.type!,
                    status: formData.status!,
                    category: formData.category || 'Geral',
                    paymentMethod: formData.paymentMethod || 'Outros',
                    date: formData.date!,
                    createdAt: Date.now()
                };
                setTransactions(prev => [newT, ...prev]);
                setShowAddModal(false);
                resetForm();
                setIsSaving(false);
                showToast(editingTransactionId ? "Transação atualizada!" : "Transação salva!");
            }, 600);
            return;
        }

        try {
            const base = {
                user_id: session.user.id,
                description: formData.description,
                amount: Number(formData.amount),
                type: formData.type,
                status: formData.status, 
                category: formData.category || 'Geral',
                payment_method: formData.paymentMethod || 'Outros',
                created_at: Date.now()
            };

            if (isInstallment && !editingTransactionId && formData.type === 'expense') {
                const [y, m, d] = (formData.date || new Date().toISOString().split('T')[0]).split('-').map(Number);
                for (let i = 0; i < installmentsCount; i++) {
                    const dateObj = new Date(y, (m - 1) + i, d);
                    const iso = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                    
                    // A primeira parcela assume o status do form (geralmente paga ou pendente), as outras são pendentes (futuras)
                    const status = i === 0 ? formData.status : 'pending'; 

                    await supabase.from('transactions').insert({
                        ...base,
                        date: iso,
                        description: `${base.description}`, 
                        installments_info: `${i+1}/${installmentsCount}`,
                        status: status
                    });
                }
                showToast(`${installmentsCount} parcelas criadas com sucesso!`);
            } else if (editingTransactionId) {
                await supabase.from('transactions').update({ ...base, date: formData.date }).eq('id', editingTransactionId);
                showToast("Transação atualizada com sucesso!");
            } else {
                await supabase.from('transactions').insert({ ...base, date: formData.date });
                showToast("Transação salva com sucesso!");
            }
            fetchTransactions();
            setShowAddModal(false);
            resetForm();
        } catch (e) { 
            console.error(e); 
            showToast("Erro ao salvar transação.", "error");
        } finally { setIsSaving(false); }
    };

    const resetForm = () => {
        setFormData({
            description: '',
            amount: 0,
            type: 'expense',
            status: 'pending',
            date: new Date().toISOString().split('T')[0],
            category: categories[0]?.name || 'Geral',
            paymentMethod: 'Pix'
        });
        setEditingTransactionId(null);
        setIsInstallment(false);
        setInstallmentsCount(2);
        setShowNewCategoryInput(false);
    };

    const openEditModal = (t: Transaction) => {
        setFormData({
            description: t.description, 
            amount: t.amount,
            type: t.type,
            status: t.status,
            date: t.date,
            category: t.category,
            paymentMethod: t.paymentMethod || 'Outros'
        });
        setEditingTransactionId(t.id);
        setShowAddModal(true);
    };

    const requestDelete = (t: Transaction, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteConfirm({ id: t.id, description: t.description });
    };

    const confirmDelete = async () => {
        if (!deleteConfirm) return;
        const { id } = deleteConfirm;

        if (demoMode) {
            setTransactions(prev => prev.filter(t => t.id !== id));
        } else {
            try {
                const { error } = await supabase.from('transactions').delete().eq('id', id);
                if (error) throw error;
                setTransactions(prev => prev.filter(t => t.id !== id));
            } catch(e) {
                console.error(e);
                showToast("Erro ao excluir.", "error");
                setDeleteConfirm(null);
                return;
            }
        }
        showToast("Transação excluída.");
        setDeleteConfirm(null);
    };

    const toggleTransactionStatus = async (t: Transaction, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        
        const newStatus = t.status === 'pending' ? 'paid' : 'pending';
        
        // Optimistic update
        setTransactions(prev => prev.map(tr => 
            tr.id === t.id ? { ...tr, status: newStatus } : tr
        ));

        // Show toast immediately for feedback
        showToast(newStatus === 'paid' ? 'Marcado como Pago!' : 'Marcado como Pendente.');

        if (!demoMode) {
            try {
                const { error } = await supabase
                    .from('transactions')
                    .update({ status: newStatus })
                    .eq('id', t.id);
                
                if (error) throw error;
            } catch (err) {
                console.error("Error updating status:", err);
                // Revert
                setTransactions(prev => prev.map(tr => 
                    tr.id === t.id ? { ...tr, status: t.status } : tr
                ));
                showToast("Erro ao atualizar status.", "error");
            }
        }
    };

    const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatCurrencyCompact = (val: number) => {
        if (Math.abs(val) >= 1000) return (val / 1000).toFixed(1) + 'k';
        return val.toString();
    };

    // --- FILTERS & DATA PREP ---
    const filteredByMonth = useMemo(() => {
        return transactions.filter(t => {
            const d = new Date(t.date + 'T12:00:00');
            return d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();
        });
    }, [transactions, selectedDate]);

    const filteredByPrevMonth = useMemo(() => {
        const prevDate = new Date(selectedDate);
        prevDate.setMonth(prevDate.getMonth() - 1);
        return transactions.filter(t => {
            const d = new Date(t.date + 'T12:00:00');
            return d.getMonth() === prevDate.getMonth() && d.getFullYear() === prevDate.getFullYear();
        });
    }, [transactions, selectedDate]);

    const displayList = useMemo(() => {
        let list = [...filteredByMonth];

        // 1. Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(t => t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
        }

        // 2. Filter Status
        if (filterStatus !== 'all') {
            list = list.filter(t => t.status === filterStatus);
        }

        // 3. Sort
        list.sort((a, b) => {
            if (sortBy === 'date') {
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            } else if (sortBy === 'alpha') {
                return a.description.localeCompare(b.description);
            } else if (sortBy === 'amount') {
                return b.amount - a.amount;
            }
            return 0;
        });

        return list;
    }, [filteredByMonth, searchQuery, sortBy, filterStatus]);

    const stats = useMemo(() => {
        const calculateTotal = (items: Transaction[]): number => items.reduce((acc: number, item) => acc + Number(item.amount), 0);

        const income = calculateTotal(filteredByMonth.filter(t => t.type === 'income' && t.status === 'paid'));
        const expense = calculateTotal(filteredByMonth.filter(t => t.type === 'expense' && t.status === 'paid'));
        const pIncome = calculateTotal(filteredByMonth.filter(t => t.type === 'income' && t.status === 'pending'));
        const pExpense = calculateTotal(filteredByMonth.filter(t => t.type === 'expense' && t.status === 'pending'));
        
        return { 
            income, 
            expense, 
            balance: income - expense, 
            projected: (income + pIncome) - (expense + pExpense), 
            pendingExpense: pExpense, 
            pendingIncome: pIncome 
        };
    }, [filteredByMonth]);

    const categoryData = useMemo(() => {
        const expenses = filteredByMonth.filter(t => t.type === 'expense');
        const total: number = expenses.reduce((acc: number, t) => acc + Number(t.amount), 0);
        
        // Grouping: Tracks total, paid and pending separately
        const grouped = expenses.reduce((acc: Record<string, { total: number, paid: number, pending: number }>, t) => {
            const cat = t.category || 'Sem Categoria';
            if (!acc[cat]) acc[cat] = { total: 0, paid: 0, pending: 0 };
            
            const amt = Number(t.amount);
            acc[cat].total += amt;
            if (t.status === 'paid') acc[cat].paid += amt;
            else acc[cat].pending += amt;
            
            return acc;
        }, {} as Record<string, { total: number, paid: number, pending: number }>);

        // Previous Month for comparison (Total only)
        const prevExpenses = filteredByPrevMonth.filter(t => t.type === 'expense');
        const prevGrouped = prevExpenses.reduce((acc: Record<string, number>, t) => {
            const cat = t.category || 'Sem Categoria';
            acc[cat] = (acc[cat] || 0) + Number(t.amount);
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(grouped)
            .map(([name, data]) => {
                const d = data as { total: number, paid: number, pending: number };
                const prevValue = prevGrouped[name] || 0;
                let change = 0;
                if (prevValue > 0) change = ((d.total - prevValue) / prevValue) * 100;
                else if (d.total > 0) change = 100;

                return { 
                    name, 
                    value: d.total, 
                    paid: d.paid,
                    pending: d.pending,
                    prevValue, 
                    change, 
                    percent: total ? (d.total / total) * 100 : 0 
                };
            })
            .sort((a, b) => b.value - a.value);
    }, [filteredByMonth, filteredByPrevMonth]);

    const paymentMethodData = useMemo(() => {
        const expenses = filteredByMonth.filter(t => t.type === 'expense');
        const total: number = expenses.reduce((acc: number, t) => acc + Number(t.amount), 0);
        
        const grouped = expenses.reduce((acc: Record<string, { total: number, paid: number, pending: number }>, t) => {
            const method = t.paymentMethod || 'Outros';
            if (!acc[method]) acc[method] = { total: 0, paid: 0, pending: 0 };
            
            const amt = Number(t.amount);
            acc[method].total += amt;
            if (t.status === 'paid') acc[method].paid += amt;
            else acc[method].pending += amt;

            return acc;
        }, {} as Record<string, { total: number, paid: number, pending: number }>);

        return Object.entries(grouped)
            .map(([name, data]) => {
                const d = data as { total: number, paid: number, pending: number };
                return { 
                    name, 
                    value: d.total, 
                    paid: d.paid, 
                    pending: d.pending, 
                    percent: total ? (d.total / total) * 100 : 0 
                };
            })
            .sort((a, b) => b.value - a.value);
    }, [filteredByMonth]);

    const dailyData = useMemo(() => {
        const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        
        return days.map(day => {
            const dayTrans = filteredByMonth.filter(t => new Date(t.date + 'T12:00:00').getDate() === day);
            
            const incomePaid = dayTrans.filter(t => t.type === 'income' && t.status === 'paid').reduce((acc, t) => acc + Number(t.amount), 0);
            const incomePending = dayTrans.filter(t => t.type === 'income' && t.status === 'pending').reduce((acc, t) => acc + Number(t.amount), 0);
            
            const expensePaid = dayTrans.filter(t => t.type === 'expense' && t.status === 'paid').reduce((acc, t) => acc + Number(t.amount), 0);
            const expensePending = dayTrans.filter(t => t.type === 'expense' && t.status === 'pending').reduce((acc, t) => acc + Number(t.amount), 0);

            // Get top 5 transactions for this day to show in tooltip
            const transactions = dayTrans.sort((a, b) => b.amount - a.amount).slice(0, 5);

            return { 
                day, 
                income: incomePaid + incomePending, 
                incomePaid,
                incomePending,
                expense: expensePaid + expensePending,
                expensePaid,
                expensePending,
                transactions
            };
        });
    }, [filteredByMonth, selectedDate]);

    const annualData = useMemo(() => {
        const year = viewYear;
        const months = Array.from({ length: 12 }, (_, i) => i);
        
        return months.map(month => {
            const monthTrans = transactions.filter(t => {
                const d = new Date(t.date + 'T12:00:00');
                return d.getFullYear() === year && d.getMonth() === month;
            });
            const income: number = monthTrans.filter(t => t.type === 'income').reduce((acc: number, t) => acc + Number(t.amount), 0);
            const expense: number = monthTrans.filter(t => t.type === 'expense').reduce((acc: number, t) => acc + Number(t.amount), 0);
            const monthName = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
            return { monthName, income, expense };
        });
    }, [transactions, viewYear]);

    const maxDailyVal = useMemo(() => Math.max(...dailyData.map(d => Math.max(d.income, d.expense)), 1), [dailyData]);
    const maxAnnualMonthVal = useMemo(() => Math.max(...annualData.map(d => Math.max(d.income, d.expense)), 1), [annualData]);

    const renderComparison = (change: number, prevValue: number) => {
        if (prevValue === 0) return <span className="text-[9px] text-gray-400 font-medium">Novo</span>;
        const isLess = change < 0;
        const isMore = change > 0;
        const absChange = Math.abs(change);
        return (
            <div className={`flex items-center gap-0.5 text-[9px] font-bold ${isLess ? 'text-emerald-500' : isMore ? 'text-red-500' : 'text-gray-400'}`}>
                {isLess ? <TrendingDown size={10} /> : isMore ? <TrendingUp size={10} /> : <MinusCircle size={10}/>}
                {absChange.toFixed(0)}%
            </div>
        );
    };

    // --- REPORT GENERATION LOGIC ---
    const generateReportImage = async () => {
        if (!reportRef.current) return;
        setIsGeneratingReport(true);
        setShowShareModal(true); 
        
        try {
            await new Promise(resolve => setTimeout(resolve, 500));

            const canvas = await html2canvas(reportRef.current, {
                scale: 2, 
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                onclone: (clonedDoc) => {
                    const element = clonedDoc.getElementById('report-content');
                    if (element) {
                        element.style.display = 'block'; 
                    }
                }
            });

            const imageBase64 = canvas.toDataURL('image/png');
            setPreviewImage(imageBase64);
        } catch (error) {
            console.error("Error generating report image:", error);
            showToast("Erro ao gerar imagem.", "error");
            setShowShareModal(false);
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const handleShareNative = async () => {
        if (!previewImage) return;

        try {
            const res = await fetch(previewImage);
            const blob = await res.blob();
            const file = new File([blob], `relatorio_${selectedDate.toISOString().slice(0, 7)}.png`, { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'SmartDoc - Relatório Financeiro',
                    text: `Relatório de ${selectedDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
                });
            } else {
                handleDownloadImage();
            }
        } catch (error) {
            console.error("Error sharing:", error);
            handleDownloadImage(); 
        }
    };

    const handleDownloadImage = () => {
        if (!previewImage) return;
        const link = document.createElement('a');
        link.href = previewImage;
        link.download = `smartdoc_relatorio_${selectedDate.toISOString().slice(0, 7)}.png`;
        link.click();
    };

    if (showVoiceRecorder) {
        return <AudioRecorder mode="finance" onScanComplete={(data) => {
            setShowVoiceRecorder(false);
            setShowAddModal(true);
            const cleanAmount = typeof data.amount === 'string' ? parseFloat(data.amount.replace('R$', '').replace(',', '.').trim()) : Number(data.amount);
            setFormData({
                description: data.description || 'Voz',
                amount: isNaN(cleanAmount) ? 0 : cleanAmount,
                type: data.type || 'expense',
                status: data.status === 'paid' ? 'paid' : 'pending',
                date: new Date().toISOString().split('T')[0],
                category: data.category || categories[0]?.name || 'Outros',
                paymentMethod: data.paymentMethod || 'Pix'
            });
        }} onCancel={() => setShowVoiceRecorder(false)} />;
    }

    // Shared Date Selector Component
    const DateSelector = () => (
        <div className="flex items-center justify-center mb-8">
            <div className="flex items-center gap-4 bg-white px-6 py-2 rounded-full shadow-sm border border-gray-100 min-w-[300px] justify-between">
                <button onClick={() => { const d = new Date(selectedDate); d.setMonth(d.getMonth() - 1); setSelectedDate(d); }} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"><ChevronLeft size={24}/></button>
                <div className="text-center">
                    <div className="text-lg font-bold text-gray-900 capitalize">{selectedDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</div>
                    <div className="text-[10px] text-brand-500 font-bold uppercase tracking-widest mt-0.5">Período Selecionado</div>
                </div>
                <button onClick={() => { const d = new Date(selectedDate); d.setMonth(d.getMonth() + 1); setSelectedDate(d); }} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"><ChevronRight size={24}/></button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-white pb-32 pt-8 md:pt-28 px-4 safe-area-pt relative">
            
            {/* --- NOTIFICATION TOAST --- */}
            {notification && (
                <div className="fixed top-20 md:top-24 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className={`px-6 py-3 rounded-full shadow-xl flex items-center gap-3 border ${notification.type === 'success' ? 'bg-white border-emerald-100 text-emerald-700' : 'bg-white border-red-100 text-red-600'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${notification.type === 'success' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                            {notification.type === 'success' ? <CheckCircle size={14} strokeWidth={3} /> : <AlertTriangle size={14} strokeWidth={3} />}
                        </div>
                        <span className="text-sm font-bold">{notification.message}</span>
                    </div>
                </div>
            )}

            {/* --- DELETE CONFIRMATION MODAL --- */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 animate-in zoom-in-95">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600 animate-bounce">
                                <Trash2 size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Excluir Lançamento?</h3>
                            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                                Tem certeza que deseja excluir "<strong>{deleteConfirm.description}</strong>"? <br/>Esta ação não pode ser desfeita.
                            </p>
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 px-4 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 shadow-lg shadow-red-500/30 transition-colors"
                                >
                                    Sim, Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- HIDDEN REPORT CONTAINER (EXACT LAYOUT REPLICA) --- */}
            <div className="fixed left-[-9999px] top-0 w-[500px] bg-white p-8 font-sans" ref={reportRef} id="report-content">
                {/* 1. Header */}
                <div className="flex justify-between items-start mb-6 border-b-2 border-indigo-500 pb-2">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Relatório Financeiro</h1>
                        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mt-1">
                            {selectedDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
                        </p>
                    </div>
                    <div className="bg-indigo-600 text-white p-2 rounded-lg">
                        <DollarSign size={24} />
                    </div>
                </div>

                {/* 2. Summary Cards */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                        <div className="text-[10px] font-bold text-green-700 uppercase mb-1">Receitas</div>
                        <div className="text-xl font-bold text-gray-900">{formatCurrency(stats.income)}</div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                        <div className="text-[10px] font-bold text-red-700 uppercase mb-1">Despesas</div>
                        <div className="text-xl font-bold text-gray-900">{formatCurrency(stats.expense)}</div>
                    </div>
                </div>

                {/* 3. Balance Card */}
                <div className="bg-slate-900 text-white p-6 rounded-2xl mb-8 flex justify-between items-center shadow-lg">
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Saldo Líquido</div>
                        <div className="text-3xl font-bold">{formatCurrency(stats.balance)}</div>
                    </div>
                    {stats.projected !== stats.balance && (
                        <div className="text-right">
                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Projeção</div>
                            <div className="text-sm font-bold">{formatCurrency(stats.projected)}</div>
                        </div>
                    )}
                </div>

                {/* 4. Top Categories List */}
                <div className="mb-8">
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Top Gastos por Categoria</h3>
                    <div className="space-y-3">
                        {categoryData.slice(0, 5).map((cat, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${cat.pending > 0 ? 'bg-amber-400' : 'bg-indigo-500'}`}></div>
                                    <span className="font-semibold text-gray-600">{cat.name}</span>
                                </div>
                                <span className="font-bold text-gray-900">{formatCurrency(cat.value)}</span>
                            </div>
                        ))}
                        {categoryData.length === 0 && <p className="text-xs text-gray-400">Sem dados.</p>}
                    </div>
                </div>

                {/* 5. Payment Methods List */}
                <div className="mb-8">
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Formas de Pagamento</h3>
                    <div className="space-y-3">
                        {paymentMethodData.slice(0, 5).map((method, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-3">
                                    <span className="font-semibold text-gray-600">{method.name}</span>
                                </div>
                                <span className="font-bold text-gray-900">{formatCurrency(method.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 6. Pending Items List (New Requirement) */}
                <div className="mb-8 pt-4 border-t border-gray-100">
                    <h3 className="text-xs font-bold text-gray-900 uppercase mb-4">Pendências do Mês (A Receber / A Pagar)</h3>
                    <div className="space-y-2">
                        {filteredByMonth
                            .filter(t => t.status === 'pending') // Filter only pending
                            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) // Sort by Date Ascending (Earliest due first)
                            .map((t) => (
                                <div key={t.id} className="flex justify-between items-start py-1">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-gray-800">{t.description}</span>
                                        <span className="text-[10px] text-gray-400">
                                            {new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} • {t.category}
                                        </span>
                                    </div>
                                    <span className={`text-xs font-bold whitespace-nowrap ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {t.type === 'expense' ? '- ' : '+ '}{formatCurrency(t.amount)}
                                    </span>
                                </div>
                            ))
                        }
                        {filteredByMonth.filter(t => t.status === 'pending').length === 0 && (
                            <p className="text-xs text-gray-400 italic text-center py-2">Nenhuma pendência para este mês. 🎉</p>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center pt-4">
                    <p className="text-[10px] text-gray-400 font-medium">Gerado por SmartDoc Finance</p>
                    <p className="text-[10px] text-gray-300">{new Date().toLocaleString('pt-BR')}</p>
                </div>
            </div>

            {/* --- MAIN APP INTERFACE --- */}
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Minhas Finanças</h1>
                            <button 
                                onClick={() => setShowValues(!showValues)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                {showValues ? <Eye size={20} /> : <EyeOff size={20} />}
                            </button>
                        </div>
                        <p className="text-gray-500 font-medium mt-1">Controle inteligente do seu dinheiro</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Share Button (Generates Image) */}
                        <button onClick={generateReportImage} className="bg-indigo-50 text-indigo-600 w-12 h-12 rounded-full flex items-center justify-center hover:bg-indigo-100 transition-colors shadow-sm border border-indigo-100" title="Gerar Relatório Visual">
                            <Share2 size={22} />
                        </button>

                        {/* Toggle Switch */}
                        <div className="flex bg-gray-100 p-1 rounded-full border border-gray-200">
                            <button onClick={() => setActiveTab('transactions')} className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'transactions' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>Transações</button>
                            <button onClick={() => setActiveTab('analytics')} className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'analytics' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>Relatórios</button>
                        </div>
                        {/* Categories Manager Button */}
                        <button onClick={() => setShowCategoryManager(true)} className="bg-gray-100 text-gray-600 w-12 h-12 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors shadow-sm border border-gray-200" title="Gerenciar Categorias">
                            <Tag size={22} />
                        </button>
                    </div>
                </div>

                {/* Date Navigation (Same visual for both tabs) */}
                <DateSelector />

                {activeTab === 'transactions' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Summary Cards */}
                        <div id="finance-summary" className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                            {/* Receitas */}
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-2 text-emerald-500 mb-3 font-medium text-sm">
                                    <TrendingUp size={20} /> Receitas (Recebidas)
                                </div>
                                <div className="text-3xl font-bold text-gray-900">{showValues ? formatCurrency(stats.income) : '••••••'}</div>
                                {stats.pendingIncome > 0 && (
                                    <div className="text-xs text-gray-400 font-medium mt-2 flex items-center gap-1">
                                        <Clock size={12} /> + {showValues ? formatCurrency(stats.pendingIncome) : '••••••'} agendados
                                    </div>
                                )}
                            </div>
                            
                            {/* Despesas */}
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-2 text-red-500 mb-3 font-medium text-sm">
                                    <TrendingDown size={20} /> Despesas (Pagas)
                                </div>
                                <div className="text-3xl font-bold text-gray-900">{showValues ? formatCurrency(stats.expense) : '••••••'}</div>
                                {stats.pendingExpense > 0 && (
                                    <div className="text-xs text-gray-400 font-medium mt-2 flex items-center gap-1">
                                        <Clock size={12} /> + {showValues ? formatCurrency(stats.pendingExpense) : '••••••'} agendados
                                    </div>
                                )}
                            </div>

                            {/* Saldo */}
                            <div className="bg-gray-900 p-6 rounded-3xl shadow-xl text-white relative overflow-hidden">
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 text-gray-300 mb-3 font-medium text-sm">
                                        <DollarSign size={20} /> Saldo Atual
                                    </div>
                                    <div className="text-3xl font-bold text-white mb-2">{showValues ? formatCurrency(stats.balance) : '••••••'}</div>
                                    <div className={`text-xs font-bold inline-block px-2 py-1 rounded ${stats.projected >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                                        Projeção: {showValues ? formatCurrency(stats.projected) : '••••••'}
                                    </div>
                                </div>
                                {/* Decor */}
                                <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
                            </div>
                        </div>

                        {/* Transactions List Section */}
                        <div className="bg-white rounded-[2rem] border border-gray-100 p-2 shadow-sm">
                            <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <h2 className="font-bold text-gray-900 text-lg">Histórico</h2>
                                
                                <div className="flex flex-1 justify-end items-center gap-3 w-full md:w-auto">
                                    {/* Search Bar */}
                                    <div className="relative flex-1 md:flex-none md:w-auto">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={18} /></div>
                                        <input 
                                            type="text" 
                                            placeholder="Buscar lançamentos..." 
                                            className="w-full md:w-64 pl-10 pr-4 py-2 bg-gray-50 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder-gray-400"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                        />
                                    </div>

                                    {/* Replicate Month Button */}
                                    <button 
                                        onClick={handlePrepareReplication} 
                                        className="flex items-center justify-center gap-2 p-2.5 md:px-4 md:py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors shrink-0"
                                        title="Copiar despesas do mês passado"
                                    >
                                        <Copy size={18} className="md:w-4 md:h-4" />
                                        <span className="hidden md:inline">Copiar Mês Anterior</span>
                                    </button>
                                </div>
                            </div>

                            {/* --- TOOLBAR: Sort & Filter --- */}
                            <div className="px-6 pb-4 flex flex-col sm:flex-row gap-3 overflow-x-auto scrollbar-hide">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setSortBy('date')} 
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${sortBy === 'date' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                    >
                                        <Calendar size={14} /> Data
                                    </button>
                                    <button 
                                        onClick={() => setSortBy('alpha')} 
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${sortBy === 'alpha' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                    >
                                        <SortAsc size={14} /> A-Z
                                    </button>
                                    <button 
                                        onClick={() => setSortBy('amount')} 
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${sortBy === 'amount' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                    >
                                        <DollarSign size={14} /> Valor
                                    </button>
                                </div>
                                <div className="w-px h-6 bg-gray-200 hidden sm:block"></div>
                                <div className="flex gap-2">
                                     <button 
                                        onClick={() => setFilterStatus('all')} 
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${filterStatus === 'all' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                    >
                                        Todos
                                    </button>
                                    <button 
                                        onClick={() => setFilterStatus('paid')} 
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${filterStatus === 'paid' ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-500/20' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                    >
                                        <CheckCircle size={12} /> Pago
                                    </button>
                                    <button 
                                        onClick={() => setFilterStatus('pending')} 
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${filterStatus === 'pending' ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-500/20' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                    >
                                        <Clock size={12} /> Pendente
                                    </button>
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-1 mt-2">
                                {isLoading ? <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto text-emerald-600" /></div> :
                                 displayList.length === 0 ? <div className="p-12 text-center text-gray-400 font-medium">Nenhum lançamento encontrado.</div> :
                                 displayList.map(t => (
                                    <div key={t.id} onClick={() => openEditModal(t)} className="p-3 md:p-4 hover:bg-gray-50 rounded-2xl transition-all flex items-center justify-between group cursor-pointer border border-transparent hover:border-gray-100">
                                        
                                        {/* LEFT SIDE: Icon + Info (Takes available space, shrinks text) */}
                                        <div className="flex items-center gap-3 md:gap-5 min-w-0 flex-1 overflow-hidden">
                                            {/* Icon Box */}
                                            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shrink-0 ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                                                {t.type === 'income' ? <TrendingUp size={18} md:size={20} strokeWidth={2.5} /> : <TrendingDown size={18} md:size={20} strokeWidth={2.5} />}
                                            </div>
                                            
                                            {/* Details (Truncating) */}
                                            <div className="min-w-0 flex-1 pr-2">
                                                <div className="font-bold text-gray-900 text-sm md:text-base mb-0.5 flex items-center gap-2">
                                                    <span className="truncate">{t.description}</span>
                                                    {t.installmentsInfo && (
                                                        <span className="text-[9px] md:text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">{t.installmentsInfo}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 font-medium truncate">
                                                    <span className="shrink-0">{new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}</span>
                                                    <span className="w-1 h-1 bg-gray-300 rounded-full shrink-0"></span>
                                                    <span className="text-gray-700 truncate">{t.category}</span>
                                                    {t.paymentMethod && (
                                                        <>
                                                            <span className="w-1 h-1 bg-gray-300 rounded-full shrink-0"></span>
                                                            <span className="text-gray-400 truncate hidden sm:inline">{t.paymentMethod}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* RIGHT SIDE: Amount + Actions (Fixed/Shrinkable) */}
                                        <div className="flex items-center gap-2 md:gap-6 shrink-0">
                                            <div className="text-right">
                                                <div className={`font-bold text-sm md:text-base ${t.type === 'income' ? 'text-emerald-600' : 'text-gray-900'}`}>
                                                    {t.type === 'expense' && '- '}{formatCurrency(t.amount)}
                                                </div>
                                                {t.status === 'pending' && (
                                                    <div className="text-[9px] md:text-[10px] font-bold text-amber-500 uppercase tracking-wider mt-0.5">
                                                        Pendente
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                {/* STATUS TOGGLE BUTTON - UPDATED ICONS */}
                                                <button 
                                                    onClick={(e) => toggleTransactionStatus(t, e)} 
                                                    className={`p-1.5 md:p-2 rounded-lg transition-colors ${t.status === 'paid' ? 'text-gray-400 hover:text-amber-500 hover:bg-amber-50' : 'text-emerald-500 bg-emerald-50 hover:bg-emerald-100'}`}
                                                    title={t.status === 'paid' ? "Reabrir (Marcar como Pendente)" : "Confirmar (Marcar como Pago)"}
                                                >
                                                    {t.status === 'paid' ? (
                                                        <Undo2 size={16} strokeWidth={2.5} />
                                                    ) : (
                                                        <Check size={16} strokeWidth={3} />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                 ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        {/* 1. Gastos por Categoria (Updated with Color Difference) */}
                        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
                             <h3 className="text-base font-bold text-gray-900 mb-8 flex items-center gap-2">
                                <PieChart size={20} className="text-indigo-600"/> Gastos por Categoria
                             </h3>
                             <div className="space-y-6">
                                {categoryData.length === 0 ? <p className="text-gray-400 text-center py-4">Sem dados.</p> :
                                 categoryData.map((item, idx) => {
                                     const catTransactions = filteredByMonth
                                        .filter(t => t.type === 'expense' && t.category === item.name)
                                        .sort((a, b) => b.amount - a.amount)
                                        .slice(0, 5); 

                                     return (
                                         <div key={idx} className="relative group cursor-help">
                                             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-[10px] rounded-xl p-3 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                                                <div className="font-bold border-b border-gray-700 pb-2 mb-2 flex justify-between">
                                                    <span>{item.name}</span>
                                                    <span>{formatCurrency(item.value)}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 mb-2">
                                                    <div className="text-emerald-400">Pago: {formatCurrency(item.paid)}</div>
                                                    <div className="text-amber-400 text-right">Pendente: {formatCurrency(item.pending)}</div>
                                                </div>
                                                <div className="space-y-1.5 border-t border-gray-800 pt-2">
                                                    {catTransactions.map(t => (
                                                        <div key={t.id} className="flex justify-between items-center text-gray-300">
                                                            <span className="truncate max-w-[120px]">{t.description}</span>
                                                            <span className={`font-medium ${t.status === 'pending' ? 'text-amber-400' : 'text-white'}`}>{formatCurrency(t.amount)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                                             </div>

                                             <div className="flex justify-between text-sm font-bold mb-2 text-gray-700">
                                                <span>{item.name}</span>
                                                <div className="flex items-center gap-3">
                                                    {renderComparison(item.change, item.prevValue)}
                                                    <span className="text-gray-500">{formatCurrency(item.value)} ({Math.round(item.percent)}%)</span>
                                                </div>
                                             </div>
                                             <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden flex">
                                                {/* Paid Part */}
                                                <div 
                                                    className="bg-indigo-600 h-full first:rounded-l-full last:rounded-r-full" 
                                                    style={{ width: `${(item.paid / item.value) * 100}%` }}
                                                ></div>
                                                {/* Pending Part */}
                                                <div 
                                                    className="bg-indigo-300 h-full first:rounded-l-full last:rounded-r-full" 
                                                    style={{ width: `${(item.pending / item.value) * 100}%` }}
                                                ></div>
                                             </div>
                                         </div>
                                     );
                                 })}
                             </div>
                             <div className="flex justify-end gap-4 mt-6 text-xs font-bold text-gray-400">
                                 <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-600"></div> Pago</div>
                                 <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-300"></div> Pendente</div>
                             </div>
                        </div>

                        {/* 2. Formas de Pagamento (Updated with Color Difference) */}
                        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
                             <h3 className="text-base font-bold text-gray-900 mb-8 flex items-center gap-2">
                                <Wallet size={20} className="text-indigo-600"/> Formas de Pagamento
                             </h3>
                             <div className="space-y-6">
                                {paymentMethodData.length === 0 ? <p className="text-gray-400 text-center py-4">Sem dados.</p> :
                                 paymentMethodData.map((item, idx) => (
                                     <div key={idx} className="group relative cursor-help">
                                         {/* Tooltip */}
                                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 bg-gray-900 text-white text-[10px] rounded-lg p-2 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none text-center">
                                            <div className="text-emerald-400 font-bold">Pago: {formatCurrency(item.paid)}</div>
                                            <div className="text-amber-400 font-bold">Pend: {formatCurrency(item.pending)}</div>
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                                         </div>

                                         <div className="flex justify-between text-sm font-bold mb-2 text-gray-700">
                                            <span>{item.name}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-gray-500">{formatCurrency(item.value)} ({Math.round(item.percent)}%)</span>
                                            </div>
                                         </div>
                                         <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden flex">
                                            <div className="bg-teal-600 h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(item.paid / item.value) * 100}%` }}></div>
                                            <div className="bg-teal-300 h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(item.pending / item.value) * 100}%` }}></div>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                             <div className="flex justify-end gap-4 mt-6 text-xs font-bold text-gray-400">
                                 <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-teal-600"></div> Pago</div>
                                 <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-teal-300"></div> Pendente</div>
                             </div>
                        </div>

                        {/* 3. Evolução Diária (FIXED LAYOUT) */}
                         <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                             <h3 className="text-base font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <BarChart3 size={20} className="text-indigo-600"/> Evolução Diária
                             </h3>
                             
                             {/* Scrollable Container with Padding for Tooltips */}
                             <div className="overflow-x-auto pb-4 -mx-6 px-6 md:mx-0 md:px-0 scrollbar-hide">
                                <div className="min-w-[600px] h-64 relative pt-12">
                                    <div className="absolute inset-0 flex items-end justify-between px-2">
                                        {dailyData.map((d, index) => {
                                            // Smart Tooltip positioning - Adjusted indices for better edge handling
                                            let tooltipClasses = "-translate-x-1/2 left-1/2"; 
                                            if (index < 2) tooltipClasses = "translate-x-0 left-0"; // Reduced to 2 for tighter control
                                            if (index > dailyData.length - 3) tooltipClasses = "translate-x-0 right-0 left-auto"; 

                                            return (
                                                <div key={d.day} className="flex flex-col items-center justify-end h-full gap-2 group relative w-full hover:bg-gray-50/80 rounded-lg transition-colors pb-6 pt-6">
                                                    
                                                    {/* Tooltip - Changed position to bottom-14 to sit inside chart area */}
                                                    <div className={`absolute bottom-14 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none ${tooltipClasses} w-64`}>
                                                        <div className="bg-gray-900/95 backdrop-blur-sm text-white text-[10px] rounded-xl p-3 shadow-2xl border border-gray-700">
                                                            
                                                            {/* Header */}
                                                            <div className="font-bold border-b border-gray-700 pb-2 mb-2 flex justify-between items-center">
                                                                <span className="text-base">Dia {d.day}</span>
                                                                <span className={`text-xs ${d.income > d.expense ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                    {d.income > d.expense ? '+' : ''}{formatCurrency(d.income - d.expense)}
                                                                </span>
                                                            </div>

                                                            {/* Totals Summary */}
                                                            <div className="grid grid-cols-2 gap-2 mb-2 bg-gray-800/50 p-2 rounded-lg">
                                                                <div>
                                                                    <div className="text-gray-400 text-[9px] uppercase">Receitas</div>
                                                                    <div className="text-emerald-400 font-bold">{formatCurrency(d.income)}</div>
                                                                    <div className="text-[9px] text-emerald-600">Pd: {formatCurrency(d.incomePending)}</div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-gray-400 text-[9px] uppercase">Despesas</div>
                                                                    <div className="text-red-400 font-bold">{formatCurrency(d.expense)}</div>
                                                                    <div className="text-[9px] text-red-600">Pd: {formatCurrency(d.expensePending)}</div>
                                                                </div>
                                                            </div>

                                                            {/* Transaction List */}
                                                            <div className="space-y-1.5 border-t border-gray-800 pt-2">
                                                                {d.transactions.length === 0 ? (
                                                                    <div className="text-gray-500 italic text-center py-1">Sem lançamentos</div>
                                                                ) : (
                                                                    d.transactions.map((t) => (
                                                                        <div key={t.id} className="flex justify-between items-center text-gray-300">
                                                                            <span className="truncate flex-1 mr-2" title={t.description}>{t.description}</span>
                                                                            <span className={`font-medium whitespace-nowrap ${t.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                                {t.type === 'expense' && '- '}{formatCurrency(Number(t.amount))}
                                                                            </span>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                            
                                                            {/* Arrow - Adjusted positioning logic */}
                                                            <div className={`w-3 h-3 bg-gray-900 rotate-45 absolute -bottom-1.5 border-r border-b border-gray-700 ${index < 2 ? 'left-6' : index > dailyData.length - 3 ? 'right-6' : 'left-1/2 -translate-x-1/2'}`}></div>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-1 items-end h-full justify-center w-full px-0.5">
                                                        {/* Income Stack */}
                                                        <div className="w-2 md:w-3 flex flex-col justify-end h-full">
                                                            <div className="bg-emerald-200 w-full rounded-t-sm" style={{ height: `${(d.incomePending / maxDailyVal) * 100}%` }}></div>
                                                            <div className="bg-emerald-500 w-full rounded-b-sm" style={{ height: `${(d.incomePaid / maxDailyVal) * 100}%` }}></div>
                                                        </div>

                                                        {/* Expense Stack */}
                                                        <div className="w-2 md:w-3 flex flex-col justify-end h-full">
                                                            <div className="bg-orange-300 w-full rounded-t-sm" style={{ height: `${(d.expensePending / maxDailyVal) * 100}%` }}></div>
                                                            <div className="bg-red-500 w-full rounded-b-sm" style={{ height: `${(d.expensePaid / maxDailyVal) * 100}%` }}></div>
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] text-gray-400 font-bold h-4 block">{d.day}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                             </div>
                             <div className="w-full h-px bg-gray-100 mt-2"></div>
                             <div className="flex justify-center gap-6 mt-4 text-[10px] font-bold text-gray-400 flex-wrap">
                                 <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-emerald-500 rounded-sm"></div> Rec. Paga</div>
                                 <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-emerald-200 rounded-sm"></div> Rec. Pendente</div>
                                 <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-red-500 rounded-sm"></div> Desp. Paga</div>
                                 <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-orange-300 rounded-sm"></div> Desp. Pendente</div>
                             </div>
                        </div>

                         {/* 4. Visão Anual */}
                        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                    <Calendar size={20} className="text-indigo-600"/> Visão Anual
                                </h3>
                                <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-lg">
                                    <button onClick={() => setViewYear(y => y - 1)} className="p-1 hover:bg-white rounded-md text-gray-500"><ChevronLeft size={16}/></button>
                                    <span className="text-sm font-bold text-gray-800 w-10 text-center">{viewYear}</span>
                                    <button onClick={() => setViewYear(y => y + 1)} className="p-1 hover:bg-white rounded-md text-gray-500"><ChevronRight size={16}/></button>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {annualData.map((m, idx) => (
                                    <div key={idx} className="flex items-center group">
                                        <div className="w-10 text-xs font-bold text-gray-400 uppercase">{m.monthName}</div>
                                        
                                        <div className="flex-1 mx-4 flex flex-col gap-1.5">
                                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden flex items-center">
                                                 <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.max((m.income / maxAnnualMonthVal) * 100, 0)}%` }}></div>
                                            </div>
                                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden flex items-center">
                                                 <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.max((m.expense / maxAnnualMonthVal) * 100, 0)}%` }}></div>
                                            </div>
                                        </div>

                                        <div className="text-right w-20 space-y-0.5">
                                            <div className="text-[10px] font-bold text-emerald-500">+{formatCurrencyCompact(m.income)}</div>
                                            <div className="text-[10px] font-bold text-red-500">-{formatCurrencyCompact(m.expense)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Same modals ... */}
            {/* --- SHARE REPORT MODAL (PREVIEW IMAGE) --- */}
            {showShareModal && (
                <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Pré-visualização</h3>
                                <p className="text-xs text-gray-500">Este relatório será enviado</p>
                            </div>
                            <button onClick={() => { setShowShareModal(false); setPreviewImage(null); }} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"><X size={20}/></button>
                        </div>

                        <div className="flex-1 overflow-y-auto mb-4 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center min-h-[300px]">
                            {isGeneratingReport ? (
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 className="animate-spin text-brand-600" size={32} />
                                    <span className="text-xs font-bold text-gray-500 animate-pulse">Gerando imagem...</span>
                                </div>
                            ) : previewImage ? (
                                <img src={previewImage} alt="Relatório" className="w-full h-auto rounded-lg shadow-md" />
                            ) : (
                                <div className="text-center text-gray-400">
                                    <FileImage size={40} className="mx-auto mb-2 opacity-50" />
                                    <span className="text-xs">Falha ao gerar preview</span>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <button 
                                onClick={handleShareNative} 
                                disabled={isGeneratingReport || !previewImage}
                                className="w-full flex items-center gap-4 p-4 bg-green-600 text-white rounded-2xl hover:bg-green-700 transition-colors font-bold text-sm shadow-lg shadow-green-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                                    <MessageCircle size={18} />
                                </div>
                                Compartilhar no WhatsApp
                            </button>

                            <button 
                                onClick={handleDownloadImage}
                                disabled={isGeneratingReport || !previewImage}
                                className="w-full flex items-center gap-4 p-4 bg-gray-50 text-gray-700 rounded-2xl hover:bg-gray-100 transition-colors font-bold text-sm disabled:opacity-50"
                            >
                                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                    <Download size={18} />
                                </div>
                                Baixar Imagem
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Same Replication Modal ... */}
            {showReplicationModal && (
                <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                   {/* ... content same as previous ... */}
                   <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Copiar do Mês Anterior</h3>
                                <p className="text-xs text-gray-500">Selecione as despesas para replicar</p>
                            </div>
                            <button onClick={() => setShowReplicationModal(false)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"><X size={20} /></button>
                        </div>
                        
                        <div className="flex justify-between items-center px-1 mb-2">
                            <button
                                onClick={toggleAllReplication}
                                className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                                {selectedReplicationIds.length === replicationCandidates.length ? (
                                    <>
                                        <CheckSquare size={16} /> Desmarcar Todos
                                    </>
                                ) : (
                                    <>
                                        <Square size={16} /> Selecionar Todos
                                    </>
                                )}
                            </button>
                            <span className="text-xs text-gray-400 font-medium">
                                {selectedReplicationIds.length} de {replicationCandidates.length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto mb-4 border border-gray-100 rounded-xl">
                            {replicationCandidates.map(t => {
                                const isSelected = selectedReplicationIds.includes(t.id);
                                return (
                                    <div 
                                        key={t.id} 
                                        onClick={() => toggleReplicationSelection(t.id)}
                                        className={`flex items-center justify-between p-3 border-b border-gray-50 last:border-0 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                                                {isSelected && <CheckCircle size={14} className="text-white" />}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-gray-800">{t.description}</div>
                                                <div className="text-xs text-gray-500">{t.category} • {formatCurrency(t.amount)}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                            <div className="text-sm font-medium text-gray-600">
                                {selectedReplicationIds.length} selecionado(s)
                            </div>
                            <button 
                                onClick={confirmReplication}
                                disabled={isReplicating || selectedReplicationIds.length === 0}
                                className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isReplicating ? <Loader2 className="animate-spin" size={16} /> : <Copy size={16} />}
                                Confirmar Cópia
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Same Add Modal ... */}
            {showAddModal && (
                <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-[2rem] p-6 shadow-2xl overflow-y-auto max-h-[90vh] animate-in slide-in-from-bottom-10 relative">
                        {/* Header */}
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-900">{editingTransactionId ? 'Editar Transação' : 'Nova Transação'}</h3>
                            <div className="flex items-center gap-2">
                                {editingTransactionId && (
                                    <button 
                                        onClick={(e) => {
                                            setShowAddModal(false);
                                            requestDelete(transactions.find(t => t.id === editingTransactionId)!, e);
                                        }} 
                                        className="p-2 bg-red-50 rounded-full text-red-500 hover:bg-red-100 transition-colors"
                                        title="Excluir"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                )}
                                <button onClick={() => setShowAddModal(false)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"><X size={20} /></button>
                            </div>
                        </div>

                        <div className="space-y-5">
                            {/* ... inputs same as original ... */}
                            <div className={`relative rounded-2xl border-2 transition-all px-4 py-3 ${formData.type === 'income' ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-200 bg-gray-50 focus-within:border-gray-400'}`}>
                                <label className={`text-xs font-bold uppercase mb-1 block ${formData.type === 'income' ? 'text-emerald-600' : 'text-gray-400'}`}>Valor</label>
                                <div className="flex items-center">
                                    <span className={`text-2xl font-bold mr-2 ${formData.type === 'income' ? 'text-emerald-600' : 'text-gray-400'}`}>R$</span>
                                    <input 
                                        type="number" 
                                        autoFocus 
                                        className="w-full bg-transparent text-4xl font-bold text-gray-900 outline-none placeholder-gray-300" 
                                        placeholder="0,00" 
                                        value={formData.amount || ''} 
                                        onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})}
                                    />
                                </div>
                            </div>
                            {/* Description */}
                            <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-3">
                                <div className="text-gray-400"><Edit2 size={20} /></div>
                                <input 
                                    type="text" 
                                    className="w-full bg-transparent font-medium text-gray-900 outline-none placeholder-gray-400" 
                                    placeholder="Descrição (ex: Almoço)" 
                                    value={formData.description} 
                                    onChange={e => setFormData({...formData, description: e.target.value})}
                                />
                            </div>
                            {/* Type Toggle */}
                            <div className="flex bg-gray-50 p-1.5 rounded-xl">
                                <button 
                                    className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${formData.type === 'expense' ? 'bg-white text-red-500 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} 
                                    onClick={() => setFormData({...formData, type: 'expense'})}
                                >
                                    Despesa
                                </button>
                                <button 
                                    className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${formData.type === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} 
                                    onClick={() => setFormData({...formData, type: 'income'})}
                                >
                                    Receita
                                </button>
                            </div>

                            {/* Status Toggle (Pendente / Pago) */}
                            <div className="flex bg-gray-50 p-1.5 rounded-xl">
                                <button 
                                    type="button"
                                    className={`flex-1 py-2.5 rounded-lg font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-1.5 ${formData.status === 'pending' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} 
                                    onClick={() => setFormData({...formData, status: 'pending'})}
                                >
                                    <Clock size={16} />
                                    Pendente
                                </button>
                                <button 
                                    type="button"
                                    className={`flex-1 py-2.5 rounded-lg font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-1.5 ${formData.status === 'paid' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} 
                                    onClick={() => setFormData({...formData, status: 'paid'})}
                                >
                                    <CheckCircle size={16} />
                                    {formData.type === 'income' ? 'Recebido' : 'Pago'}
                                </button>
                            </div>
                            {/* Date & Category Row */}
                            <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3">
                                <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2">
                                    <Calendar 
                                        size={18} 
                                        className="text-gray-400 shrink-0 cursor-pointer hover:text-indigo-600 transition-colors" 
                                        onClick={() => {
                                            try {
                                                if (dateInputRef.current) {
                                                    if (typeof dateInputRef.current.showPicker === 'function') {
                                                        dateInputRef.current.showPicker();
                                                    } else {
                                                        dateInputRef.current.focus();
                                                    }
                                                }
                                            } catch (error) {
                                                console.warn('Date picker error:', error);
                                                dateInputRef.current?.focus();
                                            }
                                        }} 
                                    />
                                    <input 
                                        ref={dateInputRef}
                                        type="date" 
                                        className="w-full bg-transparent text-sm font-bold text-gray-700 outline-none" 
                                        value={formData.date} 
                                        onChange={e => setFormData({...formData, date: e.target.value})}
                                    />
                                </div>
                                <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2 relative">
                                    <Tag size={18} className="text-gray-400 shrink-0" />
                                    <select 
                                        className="w-full bg-transparent text-sm font-bold text-gray-700 outline-none appearance-none pr-4 truncate" 
                                        value={formData.category} 
                                        onChange={e => e.target.value === '__new__' ? setShowNewCategoryInput(true) : setFormData({...formData, category: e.target.value})}
                                    >
                                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                        <option value="__new__">+ Criar Nova</option>
                                    </select>
                                </div>
                            </div>
                             {/* New Category Input Slide-down */}
                             {showNewCategoryInput && (
                                <div className="flex gap-2 animate-in slide-in-from-top-2">
                                    <input type="text" autoFocus placeholder="Nome da Categoria" className="flex-1 px-4 py-3 bg-white border-2 border-indigo-500 rounded-xl text-sm font-bold" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}/>
                                    <button onClick={handleAddCategory} className="bg-indigo-600 text-white px-4 rounded-xl font-bold text-xs uppercase">Salvar</button>
                                </div>
                            )}

                             {/* Parcelamento Option - Only for Expenses and New Transactions */}
                             {formData.type === 'expense' && !editingTransactionId && (
                                <div className={`transition-all duration-300 overflow-hidden ${isInstallment ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'} border rounded-2xl`}>
                                    <div 
                                        className="flex items-center justify-between p-3 cursor-pointer"
                                        onClick={() => setIsInstallment(!isInstallment)}
                                    >
                                        <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isInstallment ? 'bg-indigo-600 border-indigo-600' : 'border-gray-400 bg-white'}`}>
                                                {isInstallment && <Check size={14} className="text-white" />}
                                            </div>
                                            Compra Parcelada
                                        </div>
                                    </div>
                                    
                                    {isInstallment && (
                                        <div className="px-4 pb-4 animate-in slide-in-from-top-2">
                                            <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2 block">
                                                Número de Parcelas ({installmentsCount}x)
                                            </label>
                                            <div className="flex items-center gap-3">
                                                <input 
                                                    type="range" 
                                                    min="2" 
                                                    max="24" 
                                                    step="1" 
                                                    className="flex-1 accent-indigo-600 h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                                                    value={installmentsCount}
                                                    onChange={(e) => setInstallmentsCount(parseInt(e.target.value))}
                                                />
                                                <div className="w-12 h-10 bg-white border border-indigo-200 rounded-lg flex items-center justify-center font-bold text-indigo-700 shadow-sm">
                                                    {installmentsCount}x
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-gray-500 mt-2">
                                                Serão criadas {installmentsCount} despesas mensais futuras.
                                            </p>
                                        </div>
                                    )}
                                </div>
                             )}

                             {/* Payment Method */}
                             <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-3">
                                <Wallet size={20} className="text-gray-400" />
                                <select 
                                    className="w-full bg-transparent font-medium text-gray-900 outline-none appearance-none" 
                                    value={formData.paymentMethod} 
                                    onChange={e => setFormData({...formData, paymentMethod: e.target.value})}
                                >
                                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            {/* Save Button */}
                            <button 
                                onClick={handleSave} 
                                disabled={isSaving} 
                                className="w-full py-4 rounded-xl bg-gray-900 text-white font-bold text-base shadow-xl flex items-center justify-center gap-2 hover:bg-black transition-all active:scale-[0.98] mt-2"
                            >
                                {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                                {isSaving ? 'Salvando...' : 'Salvar Transação'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- CATEGORY MANAGER MODAL --- */}
            {showCategoryManager && (
                <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[85vh]">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Categorias</h3>
                                <p className="text-xs text-gray-500">Gerencie as categorias de transações</p>
                            </div>
                            <button onClick={() => { setShowCategoryManager(false); setEditingCategory(null); setManagerCategoryName(''); }} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"><X size={20}/></button>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 mb-6">
                            <input 
                                type="text" 
                                placeholder="Nome da Categoria" 
                                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" 
                                value={managerCategoryName} 
                                onChange={e => setManagerCategoryName(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleSaveCategoryManager} 
                                    disabled={!managerCategoryName.trim()}
                                    className="flex-1 sm:flex-none bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {editingCategory ? 'Salvar' : 'Adicionar'}
                                </button>
                                {editingCategory && (
                                    <button 
                                        onClick={() => { setEditingCategory(null); setManagerCategoryName(''); }}
                                        className="flex-1 sm:flex-none bg-gray-100 text-gray-600 px-4 py-3 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto border border-gray-100 rounded-xl">
                            {categories.length === 0 ? (
                                <p className="text-center text-gray-400 py-6 text-sm">Nenhuma categoria cadastrada.</p>
                            ) : (
                                categories.map(cat => (
                                    <div key={cat.id} className="flex items-center justify-between p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                                        <span className="font-bold text-gray-700 text-sm">{cat.name}</span>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => { setEditingCategory(cat); setManagerCategoryName(cat.name); }}
                                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteCategory(cat)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- CATEGORY DELETE CONFIRMATION MODAL --- */}
            {categoryDeleteConfirm && (
                <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4 text-red-600 mx-auto">
                            <AlertTriangle size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Excluir Categoria?</h3>
                        <p className="text-sm text-gray-500 text-center mb-6">
                            Tem certeza que deseja excluir a categoria <strong>{categoryDeleteConfirm.name}</strong>?
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setCategoryDeleteConfirm(null)} 
                                className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={confirmDeleteCategory} 
                                className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
                            >
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- FLOATING ACTION BUTTON (FAB) --- */}
            <div className="fixed bottom-24 md:bottom-10 right-6 md:right-10 z-50 flex flex-col items-end gap-3">
                {isFabOpen && (
                    <div className="flex flex-col items-end gap-3 animate-in slide-in-from-bottom-4 fade-in duration-200">
                        <button 
                            onClick={() => { setIsFabOpen(false); setShowVoiceRecorder(true); }}
                            className="flex items-center gap-3 bg-white px-4 py-3 rounded-full shadow-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                            <span className="text-sm font-bold text-gray-700">Áudio</span>
                            <Mic size={20} className="text-emerald-600" />
                        </button>
                        <button 
                            onClick={() => { setIsFabOpen(false); resetForm(); setShowAddModal(true); }}
                            className="flex items-center gap-3 bg-white px-4 py-3 rounded-full shadow-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                            <span className="text-sm font-bold text-gray-700">Manual</span>
                            <Plus size={20} className="text-emerald-600" />
                        </button>
                    </div>
                )}
                <button 
                    onClick={() => setIsFabOpen(!isFabOpen)}
                    className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center text-white shadow-xl shadow-brand-500/40 border-4 border-white transition-all duration-300 ${isFabOpen ? 'bg-gray-800 rotate-45' : 'bg-brand-600 hover:bg-brand-700'}`}
                >
                    <Plus size={32} />
                </button>
            </div>
            
            {/* Overlay for FAB */}
            {isFabOpen && (
                <div 
                    className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
                    onClick={() => setIsFabOpen(false)}
                />
            )}
        </div>
    );
};