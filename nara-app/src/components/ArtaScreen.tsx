import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  BarChart3,
  History,
  Tag,
  Info,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ARTA_WEBHOOK = import.meta.env.VITE_N8N_ARTA_WEBHOOK_URL;

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: "expense" | "income";
}

interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: "expense" | "income";
  category_id: string | null;
  note: string | null;
  date: string;
  created_at: string;
}

interface Summary {
  totalExpense: number;
  totalIncome: number;
  balance: number;
  month: string;
}

const DEFAULT_CATEGORIES: Category[] = [
  // Expenses
  { id: "food", name: "Food & Drink", color: "#f59e0b", icon: "🍔", type: "expense" },
  { id: "transport", name: "Transport", color: "#3b82f6", icon: "🚗", type: "expense" },
  { id: "shopping", name: "Shopping", color: "#ec4899", icon: "🛍️", type: "expense" },
  { id: "entertainment", name: "Entertainment", color: "#8b5cf6", icon: "🎮", type: "expense" },
  { id: "health", name: "Health", color: "#10b981", icon: "💊", type: "expense" },
  { id: "utilities", name: "Utilities", color: "#6b7280", icon: "⚡", type: "expense" },
  { id: "other_exp", name: "Other Expense", color: "#94a3b8", icon: "📌", type: "expense" },
  // Income
  { id: "salary", name: "Salary", color: "#22c55e", icon: "💰", type: "income" },
  { id: "freelance", name: "Freelance", color: "#10b981", icon: "💻", type: "income" },
  { id: "investment", name: "Investment", color: "#0ea5e9", icon: "📈", type: "income" },
  { id: "gift", name: "Gift/Bonus", color: "#f43f5e", icon: "🎁", type: "income" },
  { id: "other_inc", name: "Other Income", color: "#94a3b8", icon: "📥", type: "income" },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const isValidUUID = (uuid: string) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
};

export function ArtaScreen() {
  const { session } = useOutletContext<{ session: Session }>();
  const user = session.user;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalExpense: 0,
    totalIncome: 0,
    balance: 0,
    month: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "expense" | "income">("all");

  // Form state
  const [form, setForm] = useState({
    title: "",
    amount: "",
    type: "expense" as "expense" | "income",
    category_id: "",
    note: "",
    date: new Date().toISOString().split("T")[0],
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(ARTA_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_data", user_id: user.id }),
      });

      const text = await response.text();
      if (!text) throw new Error("Empty response");

      const result = JSON.parse(text);
      const data = Array.isArray(result) ? result[0] : result;

      if (data) {
        if (data.transactions) setTransactions(data.transactions);
        if (data.categories) {
          // Keep all unique IDs for lookup, but we'll deduplicate by name for the UI dropdown later
          // Ensure all categories have a 'type' (default to expense for legacy data)
          const normalized = data.categories.map((c: any) => ({
            ...c,
            type: c.type || "expense"
          }));
          const uniqueById = Array.from(new Map(normalized.map((c: any) => [c.id, c])).values()) as any[];
          setCategories(uniqueById);
        }
        if (data.summary) setSummary(data.summary);
      }
    } catch (error) {
      console.error("[ARTA] Fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.amount) return;

    setIsAdding(true);
    const action = editingId ? "update_transaction" : "add_transaction";
    
    try {
      const response = await fetch(ARTA_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          user_id: user.id,
          id: editingId, // only used for update
          data: {
            title: form.title,
            amount: parseFloat(form.amount),
            type: form.type,
            category_id: isValidUUID(form.category_id) ? form.category_id : null,
            note: form.note || null,
            date: form.date,
          },
        }),
      });

      if (response.ok) {
        toast.success(editingId ? "Transaction Updated" : `${form.type === "expense" ? "Expense" : "Income"} Recorded`, {
          description: `${form.title} — ${formatCurrency(parseFloat(form.amount))} synced.`,
        });
        setForm({
          title: "",
          amount: "",
          type: "expense",
          category_id: "",
          note: "",
          date: new Date().toISOString().split("T")[0],
        });
        setEditingId(null);
        fetchData();
      } else {
        throw new Error("Webhook failed");
      }
    } catch (error: any) {
      toast.error("Process failed", { description: error.message });
    } finally {
      setIsAdding(false);
    }
  };

  const handleEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setForm({
      title: tx.title,
      amount: tx.amount.toString(),
      type: tx.type,
      category_id: tx.category_id || "",
      note: tx.note || "",
      date: tx.date || (tx.created_at ? tx.created_at.split("T")[0] : new Date().toISOString().split("T")[0]),
    });
    // Scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(ARTA_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_transaction", user_id: user.id, id }),
      });
      if (response.ok) {
        if (id === editingId) {
          setEditingId(null);
          setForm({
            title: "",
            amount: "",
            type: "expense",
            category_id: "",
            note: "",
            date: new Date().toISOString().split("T")[0],
          });
        }
        fetchData();
        toast.success("Transaction removed");
      }
    } catch (error) {
      console.error("[ARTA] Delete error:", error);
    }
  };

  const getCategoryById = (id: string | null) => {
    if (!id) return { name: "Other", color: "#94a3b8", icon: "📌", type: "expense" as const };
    
    // 1. Check in fetched categories from state
    const fetched = categories.find((c) => c.id === id);
    if (fetched) return fetched;

    // 2. Check in constant DEFAULT_CATEGORIES (for string-based IDs like 'food')
    const fallback = DEFAULT_CATEGORIES.find(c => c.id === id);
    if (fallback) return fallback;

    // 3. Last resort
    return { name: "Other", color: "#94a3b8", icon: "📌", type: "expense" as const };
  };

  const filteredTransactions = transactions.filter((tx) =>
    filterType === "all" ? true : tx.type === filterType
  );

  // Group by date
  const grouped = filteredTransactions.reduce<Record<string, Transaction[]>>((acc, tx) => {
    const key = tx.date || tx.created_at?.split("T")[0] || "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(tx);
    return acc;
  }, {});

  // Category spending chart data
  const expenseTotals = transactions
    .filter((tx) => tx.type === "expense")
    .reduce<Record<string, number>>((acc, tx) => {
      const cat = getCategoryById(tx.category_id);
      const key = cat.name;
      acc[key] = (acc[key] || 0) + parseFloat(String(tx.amount));
      return acc;
    }, {});

  const incomeTotals = transactions
    .filter((tx) => tx.type === "income")
    .reduce<Record<string, number>>((acc, tx) => {
      const cat = getCategoryById(tx.category_id);
      const key = cat.name;
      acc[key] = (acc[key] || 0) + parseFloat(String(tx.amount));
      return acc;
    }, {});

  const maxExpTotal = Math.max(...Object.values(expenseTotals), 1);
  const maxIncTotal = Math.max(...Object.values(incomeTotals), 1);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--arta-accent)]" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Wallet className="w-8 h-8 text-[var(--arta-accent)] neon-glow" />
          ARTA Module
        </h1>
        <p className="text-muted-foreground italic">Atur Rekap Transaksi Anda • Pure n8n Orchestration Architecture.</p>
      </header>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[var(--glass-bg)] border-[var(--glass-border)] backdrop-blur-[var(--glass-blur)]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold">This Month Expenses</p>
              <div className="p-2 rounded-lg bg-red-500/10">
                <TrendingDown className="w-4 h-4 text-red-400" />
              </div>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalExpense)}</p>
            <p className="text-xs text-muted-foreground mt-1">{summary.month}</p>
          </CardContent>
        </Card>

        <Card className="bg-[var(--glass-bg)] border-[var(--glass-border)] backdrop-blur-[var(--glass-blur)]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold">This Month Income</p>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{formatCurrency(summary.totalIncome)}</p>
            <p className="text-xs text-muted-foreground mt-1">{summary.month}</p>
          </CardContent>
        </Card>

        <Card className={`backdrop-blur-[var(--glass-blur)] border ${summary.balance >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Net Balance</p>
              <div className={`p-2 rounded-lg ${summary.balance >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                <Wallet className={`w-4 h-4 ${summary.balance >= 0 ? "text-emerald-400" : "text-red-400"}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${summary.balance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatCurrency(summary.balance)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Income − Expenses</p>
          </CardContent>
        </Card>
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* QUICK ADD FORM */}
        <Card className="lg:col-span-1 bg-[var(--glass-bg)] border-[var(--arta-accent)]/20 border-2 shadow-[0_0_30px_rgba(139,92,246,0.05)] backdrop-blur-[var(--glass-blur)]">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              {editingId ? <BarChart3 className="w-5 h-5 text-amber-400 neon-glow" /> : <Plus className="w-5 h-5 text-[var(--arta-accent)] neon-glow" />}
              {editingId ? "Edit Transaction" : "Add Transaction"}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {editingId ? "Editing existing entry..." : "Direct n8n sync • Real-time reconciliation."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              {/* Type Toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: "expense" })}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                    form.type === "expense"
                      ? "bg-red-500/20 text-red-500 border border-red-500/40"
                      : "bg-secondary text-muted-foreground border border-border hover:border-accent"
                  }`}
                >
                  <ArrowDownRight className="w-4 h-4" /> Expense
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: "income" })}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                    form.type === "income"
                      ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/40"
                      : "bg-secondary text-muted-foreground border border-border hover:border-accent"
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" /> Income
                </button>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase">Title</Label>
                <Input
                  placeholder="e.g. Nasi Goreng, Gojek..."
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase">Note (Optional)</Label>
                <Input
                  placeholder="e.g. Extra pedas, urgent..."
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase">Amount (IDR)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 25000"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase">Category</Label>
                <Select value={form.category_id || ""} onValueChange={(v: string | null) => setForm({ ...form, category_id: v || "" })}>
                  <SelectTrigger className="bg-secondary border-border text-foreground">
                    <SelectValue>
                      {form.category_id ? (
                        <span className="flex items-center gap-2">
                          <span>{getCategoryById(form.category_id).icon}</span>
                          <span>{getCategoryById(form.category_id).name}</span>
                        </span>
                      ) : (
                        "Select category"
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    {([...categories, ...DEFAULT_CATEGORIES]).length > 0 ? (
                      // Merge database categories with defaults, then deduplicate and filter
                      Array.from(new Map(
                        [...categories, ...DEFAULT_CATEGORIES]
                          .filter(c => (c.type || "expense") === form.type)
                          .map(c => [c.name, c])
                      ).values()).map((cat, idx) => (
                        <SelectItem key={`${cat.id}-${idx}`} value={cat.id}>
                          <span className="flex items-center gap-2">
                            <span>{cat.icon}</span>
                            <span>{cat.name}</span>
                          </span>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        Loading categories...
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase">Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="bg-secondary border-border text-foreground"
                />
              </div>

              <Button
                type="submit"
                disabled={isAdding}
                className={`w-full font-bold h-12 transition-transform active:scale-95 shadow-lg ${
                  editingId 
                    ? "bg-amber-600 hover:bg-amber-700 text-white" 
                    : "bg-[var(--arta-accent)] hover:opacity-90 text-[var(--primary-foreground)]"
                }`}
              >
                {isAdding 
                  ? "Syncing to n8n..." 
                  : editingId ? "Update Transaction" : "Commit Transaction"}
              </Button>
              
              {editingId && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(null);
                    setForm({
                      title: "",
                      amount: "",
                      type: "expense",
                      category_id: "",
                      note: "",
                      date: new Date().toISOString().split("T")[0],
                    });
                  }}
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  Cancel Edit
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        {/* CATEGORICAL ANALYSIS */}
        <Card className="lg:col-span-2 bg-transparent border-none shadow-none space-y-6">
          <div className="flex items-center gap-2 px-1">
            <BarChart3 className="w-5 h-5 text-primary/60" />
            <h3 className="text-xl font-bold tracking-tight">Financial Dynamics</h3>
          </div>

          <div className="space-y-6">
            {/* INCOME BOX */}
            <div className="bg-[var(--glass-bg)] border border-emerald-500/20 backdrop-blur-[var(--glass-blur)] rounded-3xl p-6 shadow-xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                  <BarChart3 className="w-32 h-32 text-emerald-500" />
               </div>
               <div className="relative space-y-6">
                  <div className="flex items-center justify-between">
                     <div className="space-y-1">
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                           Income Distribution
                        </p>
                        <h4 className="text-2xl font-bold font-mono text-emerald-400">
                           {formatCurrency(summary.totalIncome || 0)}
                        </h4>
                     </div>
                     <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                        <Tag className="w-5 h-5 text-emerald-500" />
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {Object.keys(incomeTotals).length === 0 ? (
                       <div className="md:col-span-2 py-8 text-center text-zinc-600 flex flex-col items-center gap-2 opacity-50">
                         <p className="text-xs italic">No income streams analyzed yet.</p>
                       </div>
                     ) : (
                       Object.entries(incomeTotals)
                         .sort(([, a], [, b]) => b - a)
                         .slice(0, 4) // Show top 4 in grid
                         .map(([catName, total]) => {
                           const cat = categories.find((c) => c.name === catName) || DEFAULT_CATEGORIES[6];
                           const pct = (total / maxIncTotal) * 100;
                           return (
                             <div key={catName} className="p-4 rounded-2xl bg-secondary/20 border border-border/10 space-y-2">
                               <div className="flex items-center justify-between text-xs">
                                 <span className="text-muted-foreground flex items-center gap-2">
                                   <span className="text-lg">{cat.icon}</span>
                                   {catName}
                                 </span>
                                 <span className="text-foreground font-mono font-bold">{formatCurrency(total)}</span>
                               </div>
                               <div className="h-1 w-full bg-secondary/50 rounded-full overflow-hidden">
                                 <motion.div
                                   initial={{ width: 0 }}
                                   whileInView={{ width: `${pct}%` }}
                                   viewport={{ once: true }}
                                   className="h-full bg-emerald-500"
                                 />
                               </div>
                             </div>
                           );
                         })
                     )}
                  </div>
               </div>
            </div>

            {/* SPENDING BOX */}
            <div className="bg-[var(--glass-bg)] border border-red-500/20 backdrop-blur-[var(--glass-blur)] rounded-3xl p-6 shadow-xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                  <BarChart3 className="w-32 h-32 text-red-500" />
               </div>
               <div className="relative space-y-6">
                  <div className="flex items-center justify-between">
                     <div className="space-y-1">
                        <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em] flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                           Spending Breakdown
                        </p>
                        <h4 className="text-2xl font-bold font-mono text-red-400">
                           {formatCurrency(summary.totalExpense || 0)}
                        </h4>
                     </div>
                     <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
                        <Tag className="w-5 h-5 text-red-500" />
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {Object.keys(expenseTotals).length === 0 ? (
                       <div className="md:col-span-2 py-8 text-center text-zinc-600 flex flex-col items-center gap-2 opacity-50">
                         <p className="text-xs italic">No spending patterns detected.</p>
                       </div>
                     ) : (
                       Object.entries(expenseTotals)
                         .sort(([, a], [, b]) => b - a)
                         .slice(0, 4) // Show top 4 in grid
                         .map(([catName, total]) => {
                           const cat = categories.find((c) => c.name === catName) || DEFAULT_CATEGORIES[6];
                           const pct = (total / maxExpTotal) * 100;
                           return (
                             <div key={catName} className="p-4 rounded-2xl bg-secondary/20 border border-border/10 space-y-2">
                               <div className="flex items-center justify-between text-xs">
                                 <span className="text-muted-foreground flex items-center gap-2">
                                   <span className="text-lg">{cat.icon}</span>
                                   {catName}
                                 </span>
                                 <span className="text-foreground font-mono font-bold">{formatCurrency(total)}</span>
                               </div>
                               <div className="h-1 w-full bg-secondary/50 rounded-full overflow-hidden">
                                 <motion.div
                                   initial={{ width: 0 }}
                                   whileInView={{ width: `${pct}%` }}
                                   viewport={{ once: true }}
                                   className="h-full bg-red-500"
                                 />
                               </div>
                             </div>
                           );
                         })
                     )}
                  </div>
               </div>
            </div>
          </div>
        </Card>
      </div>

      {/* TRANSACTION HISTORY */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <History className="w-5 h-5 text-muted-foreground" />
            Transaction History
          </h3>

          {/* Filter Tabs */}
          <div className="flex gap-1 bg-secondary border border-border rounded-lg p-1">
            {(["all", "expense", "income"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-3 py-1 rounded-md text-xs font-bold capitalize transition-all ${
                  filterType === f
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="popLayout">
          {Object.keys(grouped).length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-600 flex flex-col items-center gap-3">
              <Info className="w-8 h-8 opacity-20" />
              <p className="text-sm font-medium">No transactions found.</p>
            </div>
          ) : (
            Object.entries(grouped)
              .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
              .map(([date, txs]) => (
                <div key={date} className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
                    {formatDate(date)}
                  </p>
                  {txs.map((tx) => {
                    const cat = getCategoryById(tx.category_id);
                    return (
                      <motion.div
                        key={tx.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="group flex items-center justify-between p-4 bg-card/50 border border-border rounded-xl hover:bg-card hover:border-accent transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                            style={{ backgroundColor: (cat.color || "#8b5cf6") + "20" }}
                          >
                            {cat.icon}
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">{tx.title}</h4>
                            <p className="text-xs text-muted-foreground">
                              {cat.name}
                              {tx.note && <span className="ml-2 italic">• {tx.note}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span
                            className={`text-base font-bold tracking-tight ${
                              tx.type === "income" ? "text-emerald-400" : "text-foreground"
                            }`}
                          >
                            {tx.type === "income" ? "+" : "-"}
                            {formatCurrency(parseFloat(String(tx.amount)))}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(tx)}
                            className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-amber-500 transition-all"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(tx.id)}
                            className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-500 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
