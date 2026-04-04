"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase-client";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";
import { 
  TrendingUp, 
  Users, 
  Calendar, 
  CreditCard, 
  Filter, 
  ChevronDown, 
  Search,
  Wallet,
  Sun,
  Moon,
  Send,
  ArrowRight,
  Clock,
  Zap,
  ShoppingCart,
  Music,
  Heart,
  Truck,
  Utensils,
  FileText,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  X
} from "lucide-react";
import "./dashboard.css";

// --- Configuration ---
const BUDGET_TOTAL = 9000;

const CATEGORY_MAP: Record<string, { color: string; icon: any }> = {
  Despensa: { color: "#0099BB", icon: ShoppingCart },
  Entretenimiento: { color: "#E05555", icon: Music },
  Salud: { color: "#3BAA2A", icon: Heart },
  Transporte: { color: "#E07A20", icon: Truck },
  Restaurantes: { color: "#9B4DB0", icon: Utensils },
  Facturable: { color: "#C8A000", icon: FileText },
  Otros: { color: "#5B4DB0", icon: MoreHorizontal },
};

const USER_COLORS: Record<string, string> = {
  Jorge: "#3B82F6",
  Diana: "#F472B6",
};

// --- Helper Components ---

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 45, damping: 15 });
  const displayValue = useTransform(spring, (current) => 
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 0,
    }).format(current)
  );

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{displayValue}</motion.span>;
}

// --- Main Component ---

export default function BambuchoDashboard() {
  const [gastos, setGastos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState("Todos");
  const [filterCategory, setFilterCategory] = useState("Todas");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [currentTime, setCurrentTime] = useState(new Date());

  // Modal State
  const [activeModal, setActiveModal] = useState<"view" | "edit" | "delete" | null>(null);
  const [selectedGasto, setSelectedGasto] = useState<any>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clock Loader
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Theme Persistence
  useEffect(() => {
    const savedTheme = localStorage.getItem("bambucho-theme") as "light" | "dark";
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("bambucho-theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  // Fetch initial data
  useEffect(() => {
    const fetchGastos = async () => {
      const { data, error } = await supabase
        .from("gastos")
        .select("*")
        .order("fecha", { ascending: false });

      if (error) console.error("Error fetching gastos:", error);
      else setGastos(data || []);
      setLoading(false);
    };

    fetchGastos();

    // Real-time subscription
    const channel = supabase
      .channel("gastos_db_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gastos" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setGastos((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setGastos((prev) =>
              prev.map((g) => (g.id === payload.new.id ? payload.new : g))
            );
          } else if (payload.eventType === "DELETE") {
            setGastos((prev) => prev.filter((g) => g.id === payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filtered Data
  const filteredGastos = useMemo(() => {
    return gastos.filter((g) => {
      const matchUser = filterUser === "Todos" || g.usuario === filterUser;
      const matchCat = filterCategory === "Todas" || g.categoria === filterCategory;
      return matchUser && matchCat;
    });
  }, [gastos, filterUser, filterCategory]);

  // KPIs & Stats
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const stats = useMemo(() => {
    const monthly = gastos.filter(g => {
      const d = new Date(g.fecha);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const total = monthly.reduce((acc, curr) => acc + (curr.importe || 0), 0);
    const jorge = monthly.filter(g => g.usuario === "Jorge").reduce((acc, curr) => acc + (curr.importe || 0), 0);
    const diana = monthly.filter(g => g.usuario === "Diana").reduce((acc, curr) => acc + (curr.importe || 0), 0);
    
    return { 
      total, 
      jorge, 
      diana, 
      count: monthly.length,
      last: gastos[0] || null
    };
  }, [gastos, currentMonth, currentYear]);

  // Budget Calc
  const budgetPercent = Math.min((stats.total / BUDGET_TOTAL) * 100, 100);
  const budgetColorClass = budgetPercent > 90 ? "progress-red" : budgetPercent > 70 ? "progress-yellow" : "progress-green";

  // Chart Data: Trend (Cumulative this week)
  const lineData = useMemo(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)); // Monday
    startOfWeek.setHours(0, 0, 0, 0);

    const weekSpending: Record<number, number> = {};
    gastos.forEach(g => {
      const d = new Date(g.fecha);
      if (d >= startOfWeek && d <= today) {
        const dayIdx = d.getDay();
        weekSpending[dayIdx] = (weekSpending[dayIdx] || 0) + (g.importe || 0);
      }
    });

    const labels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    let cumulative = 0;
    const sortedDays = [1, 2, 3, 4, 5, 6, 0]; 
    return sortedDays.map(day => {
      cumulative += (weekSpending[day] || 0);
      return { day: labels[day], amount: cumulative };
    });
  }, [gastos]);

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredGastos.forEach(g => {
      counts[g.categoria] = (counts[g.categoria] || 0) + (g.importe || 0);
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredGastos]);

  // Handlers
  const openModal = (type: "view" | "edit" | "delete", gasto: any) => {
    setSelectedGasto(gasto);
    if (type === "edit") setEditFormData({ ...gasto });
    setActiveModal(type);
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedGasto(null);
  };

  const handleDelete = async () => {
    if (!selectedGasto) return;
    setIsSubmitting(true);
    const { error } = await supabase.from("gastos").delete().eq("id", selectedGasto.id);
    if (error) alert("Error al borrar el gasto");
    setIsSubmitting(false);
    closeModal();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGasto) return;
    setIsSubmitting(true);
    const { error } = await supabase
      .from("gastos")
      .update({
        concepto: editFormData.concepto,
        importe: parseFloat(editFormData.importe),
        categoria: editFormData.categoria,
        usuario: editFormData.usuario
      })
      .eq("id", selectedGasto.id);
    
    if (error) alert("Error al actualizar el gasto");
    setIsSubmitting(false);
    closeModal();
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants: any = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
  };

  return (
    <div className="dashboardContainer">
      <header className="premiumHeader">
        <div className="brand">
          <span style={{ fontSize: '2.5rem' }}>🐰</span>
          <h1 className="brandName" style={{ letterSpacing: '0.05em' }}>Bambuchón Financiero</h1>
        </div>

        <div className="hidden md:block headerClock">
           {currentTime.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, {currentTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </div>

        <div className="headerActions">
          <button className="iconBtn" onClick={() => window.open('https://t.me/Bambuchon_bot', '_blank')}>
            <Send size={18} />
          </button>
          <button className="iconBtn" onClick={toggleTheme}>
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </header>

      <motion.main 
        className="dashboardContent"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Top KPIs */}
        <div className="kpiGrid">
          <motion.div variants={itemVariants} className="kpiCard" style={{ "--accent-color": theme === 'dark' ? '#3B82F6' : '#111827' } as any}>
            <div className="kpiLabel">Presupuesto Mes</div>
            <div className="kpiValue"><AnimatedNumber value={stats.total} /></div>
          </motion.div>
          
          <motion.div variants={itemVariants} className="kpiCard" style={{ "--accent-color": USER_COLORS.Jorge } as any}>
            <div className="kpiLabel">Gasto Jorge</div>
            <div className="kpiValue"><AnimatedNumber value={stats.jorge} /></div>
          </motion.div>
          
          <motion.div variants={itemVariants} className="kpiCard" style={{ "--accent-color": USER_COLORS.Diana } as any}>
            <div className="kpiLabel">Gasto Diana</div>
            <div className="kpiValue"><AnimatedNumber value={stats.diana} /></div>
          </motion.div>
        </div>

        {/* Budget Bar Section */}
        <motion.div variants={itemVariants} className="budgetSection">
          <div className="budgetHeader">
            <div className="budgetInfo">
              <h3>Progreso Presupuesto Mensual</h3>
              <div className="budgetPrice">${stats.total.toLocaleString()} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>de $9,000</span></div>
            </div>
            <div className="text-right">
              <div className="font-bold" style={{ color: budgetPercent > 90 ? '#EF4444' : 'var(--text-main)', fontSize: '1.25rem' }}>{budgetPercent.toFixed(1)}%</div>
              <div className="text-xs uppercase tracking-wider font-bold opacity-60">Consumido</div>
            </div>
          </div>
          <div className="progressBarWrapper">
            <motion.div 
              className={`progressBar ${budgetColorClass}`} 
              initial={{ width: 0 }}
              animate={{ width: `${budgetPercent}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </div>
        </motion.div>

        {/* Middle Section: Trends & Last Expense */}
        <div className="summaryRow">
          <motion.div variants={itemVariants} className="chartCard">
            <h2 className="chartTitle">Tendencia Acumulada Semanal</h2>
            <div style={{ height: 260, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={lineData}>
                  <defs>
                    <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: '#94A3B8' }} dy={10} />
                  <YAxis hide domain={[0, 'auto']} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'var(--card-bg)', boxShadow: 'var(--card-shadow-hover)', color: 'var(--text-main)' }}
                    formatter={(val: any) => [`$${val?.toLocaleString()}`, 'Acumulado']}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorAmt)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="lastExpenseCard">
            <h2 className="chartTitle" style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Último Gasto</h2>
            {stats.last && (
              <div className="flex flex-col items-center text-center">
                <div 
                  className="expenseIcon" 
                  style={{ backgroundColor: CATEGORY_MAP[stats.last.categoria]?.color || "#cbd5e1" }}
                >
                  {(() => {
                    const IconComp = CATEGORY_MAP[stats.last.categoria]?.icon || MoreHorizontal;
                    return <IconComp size={24} />;
                  })()}
                </div>
                <div className="text-xl font-bold mb-1">{stats.last.concepto}</div>
                <div className="text-2xl font-black mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-main)' }}>
                  ${stats.last.importe?.toLocaleString()}
                </div>
                <div className="flex items-center gap-2 mt-2">
                   <div className={`badge badge-user-${stats.last.usuario.toLowerCase()}`} style={{ fontSize: '0.65rem' }}>
                    {stats.last.usuario.toUpperCase()}
                   </div>
                   <span className="text-xs text-muted font-medium">{new Date(stats.last.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Table/Movements Section */}
        <motion.div variants={itemVariants} className="tableSection">
           <div className="flex justify-between items-center p-6 border-b border-[var(--border-light)]">
              <h2 className="chartTitle" style={{ margin: 0 }}>Historial Completo</h2>
              <div className="flex gap-3">
                 <select className="filterSelect" value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
                    <option value="Todos">Usuarios</option>
                    <option value="Jorge">Jorge</option>
                    <option value="Diana">Diana</option>
                 </select>
                 <select className="filterSelect" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                    <option value="Todas">Categorías</option>
                    {Object.keys(CATEGORY_MAP).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                 </select>
              </div>
           </div>
           <div className="overflow-x-auto">
              <table className="movementsTable w-full">
                 <thead>
                    <tr>
                       <th className="text-left">Día</th>
                       <th className="text-left">Detalle</th>
                       <th className="text-left">Categoría</th>
                       <th className="text-left">Usuario</th>
                       <th className="text-right">Monto</th>
                       <th className="text-right">Acciones</th>
                    </tr>
                 </thead>
                 <tbody>
                    <AnimatePresence mode="popLayout">
                       {filteredGastos.map((g) => (
                         <motion.tr 
                           key={g.id}
                           initial={{ opacity: 0 }}
                           animate={{ opacity: 1 }}
                           exit={{ opacity: 0 }}
                           layout
                         >
                            <td className="text-muted font-bold text-xs">
                               {new Date(g.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).toUpperCase()}
                            </td>
                            <td className="font-bold">{g.concepto}</td>
                            <td>
                               <span 
                                 className="badge font-bold" 
                                 style={{ 
                                   backgroundColor: `${CATEGORY_MAP[g.categoria]?.color}15`, 
                                   color: CATEGORY_MAP[g.categoria]?.color 
                                 }}
                               >
                                 {g.categoria.toUpperCase()}
                               </span>
                            </td>
                            <td>
                               <span className={`badge badge-user-${g.usuario.toLowerCase()}`}>
                                  {g.usuario.toUpperCase()}
                               </span>
                            </td>
                            <td className="text-right font-display text-lg">
                               ${g.importe?.toLocaleString()}
                            </td>
                            <td>
                               <div className="actions">
                                  <button className="actionBtn btn-view" onClick={() => openModal('view', g)}><Eye size={16} /></button>
                                  <button className="actionBtn btn-edit" onClick={() => openModal('edit', g)}><Pencil size={16} /></button>
                                  <button className="actionBtn btn-delete" onClick={() => openModal('delete', g)}><Trash2 size={16} /></button>
                               </div>
                            </td>
                         </motion.tr>
                       ))}
                    </AnimatePresence>
                 </tbody>
              </table>
           </div>
        </motion.div>
      </motion.main>

      {/* Modals Overlay */}
      <AnimatePresence>
        {activeModal && (
          <motion.div 
            className="modalOverlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div 
              className="modalContent"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modalHeader">
                <h2 className="modalTitle">
                  {activeModal === 'view' && "Detalles"}
                  {activeModal === 'edit' && "Editar Gasto"}
                  {activeModal === 'delete' && "Confirmar"}
                </h2>
                <button className="modalClose" onClick={closeModal}><X size={24} /></button>
              </div>

              <div className="modalBody">
                {activeModal === 'view' && selectedGasto && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--border-light)]">
                      <span className="text-xs font-bold text-muted uppercase">Concepto</span>
                      <span className="font-bold">{selectedGasto.concepto}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--border-light)]">
                      <span className="text-xs font-bold text-muted uppercase">Importe</span>
                      <span className="font-display text-2xl">${selectedGasto.importe?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--border-light)]">
                      <span className="text-xs font-bold text-muted uppercase">Categoría</span>
                      <span className="badge font-bold" style={{ backgroundColor: `${CATEGORY_MAP[selectedGasto.categoria]?.color}15`, color: CATEGORY_MAP[selectedGasto.categoria]?.color }}>
                        {selectedGasto.categoria}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--border-light)]">
                      <span className="text-xs font-bold text-muted uppercase">Usuario</span>
                      <span className={`badge badge-user-${selectedGasto.usuario.toLowerCase()}`}>{selectedGasto.usuario}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--border-light)]">
                      <span className="text-xs font-bold text-muted uppercase">Fecha</span>
                      <span className="font-medium">{new Date(selectedGasto.fecha).toLocaleString('es-MX')}</span>
                    </div>
                  </div>
                )}

                {activeModal === 'edit' && (
                  <form id="editForm" onSubmit={handleUpdate}>
                    <div className="formGroup">
                      <label className="formLabel">Concepto</label>
                      <input 
                        className="formInput"
                        value={editFormData.concepto || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, concepto: e.target.value })}
                        required
                      />
                    </div>
                    <div className="formGroup">
                      <label className="formLabel">Importe</label>
                      <input 
                        type="number"
                        className="formInput"
                        value={editFormData.importe || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, importe: e.target.value })}
                        required
                      />
                    </div>
                    <div className="formGroup">
                      <label className="formLabel">Categoría</label>
                      <select 
                        className="formSelect"
                        value={editFormData.categoria || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, categoria: e.target.value })}
                      >
                        {Object.keys(CATEGORY_MAP).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div className="formGroup">
                      <label className="formLabel">Usuario</label>
                      <select 
                        className="formSelect"
                        value={editFormData.usuario || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, usuario: e.target.value })}
                      >
                        <option value="Jorge">Jorge</option>
                        <option value="Diana">Diana</option>
                      </select>
                    </div>
                  </form>
                )}

                {activeModal === 'delete' && (
                  <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Trash2 size={32} />
                    </div>
                    <p className="text-lg font-bold mb-2">¿Estás seguro de eliminar este registro?</p>
                    <p className="text-sm text-muted">Esta acción no se puede deshacer.</p>
                  </div>
                )}
              </div>

              <div className="modalFooter">
                {activeModal === 'edit' && (
                  <button 
                    type="submit" 
                    form="editForm" 
                    className="btn-primary w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Guardando..." : "Guardar Cambios"}
                  </button>
                )}
                {activeModal === 'delete' && (
                  <>
                    <button className="flex-1 p-3 rounded-xl font-bold border border-[var(--border-light)] hover:bg-[var(--border-light)] transition-colors" onClick={closeModal}>Cancelar</button>
                    <button 
                      className="flex-1 p-3 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
                      onClick={handleDelete}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Borrando..." : "Sí, borrar"}
                    </button>
                  </>
                )}
                {activeModal === 'view' && (
                  <button className="btn-primary w-full" onClick={closeModal}>Cerrar</button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
