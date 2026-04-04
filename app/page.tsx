"use client";
// Force rebuild: stable version restored - 01:27 04/04

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase-client";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Music, Heart, Truck, Utensils, FileText, MoreHorizontal,
  Eye, Pencil, Trash2, X, Send, Sun, Moon, Filter, Camera
} from "lucide-react";
import "./dashboard.css";

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

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    const duration = 800;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = progress * (2 - progress);
      setDisplay(Math.floor(value * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);
  return <span>${display.toLocaleString("es-MX")}</span>;
}

export default function BambuchoDashboard() {
  const [gastos, setGastos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState("Todos");
  const [filterCategory, setFilterCategory] = useState("Todas");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeModal, setActiveModal] = useState<"view" | "edit" | "delete" | null>(null);
  const [selectedGasto, setSelectedGasto] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editFormData, setEditFormData] = useState({ concepto: "", importe: "", categoria: "", usuario: "" });
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("bambucho-theme") as "light" | "dark";
    if (saved) { setTheme(saved); document.documentElement.setAttribute("data-theme", saved); }
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("bambucho-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase.from("gastos").select("*").order("fecha", { ascending: false });
      if (!error) setGastos(data || []);
      setLoading(false);
    };
    fetch();

    const channel = supabase.channel("gastos_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "gastos" }, (payload) => {
        if (payload.eventType === "INSERT") setGastos(p => [payload.new, ...p]);
        else if (payload.eventType === "UPDATE") setGastos(p => p.map(g => g.id === payload.new.id ? payload.new : g));
        else if (payload.eventType === "DELETE") setGastos(p => p.filter(g => g.id !== payload.old.id));
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredGastos = useMemo(() => gastos.filter(g => {
    const matchUser = filterUser === "Todos" || g.usuario === filterUser;
    const matchCat = filterCategory === "Todas" || g.categoria === filterCategory;
    return matchUser && matchCat;
  }), [gastos, filterUser, filterCategory]);

  const now = new Date();
  const stats = useMemo(() => {
    const monthly = gastos.filter(g => {
      const d = new Date(g.fecha);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    return {
      total: monthly.reduce((s, g) => s + (g.importe || 0), 0),
      jorge: monthly.filter(g => g.usuario === "Jorge").reduce((s, g) => s + (g.importe || 0), 0),
      diana: monthly.filter(g => g.usuario === "Diana").reduce((s, g) => s + (g.importe || 0), 0),
      count: monthly.length,
      last: gastos[0] || null,
    };
  }, [gastos]);

  const budgetPct = Math.min((stats.total / BUDGET_TOTAL) * 100, 100);
  const budgetColor = budgetPct > 90 ? "progress-red" : budgetPct > 70 ? "progress-yellow" : "progress-green";

  const lineData = useMemo(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    startOfWeek.setHours(0, 0, 0, 0);
    const byDay: Record<number, number> = {};
    gastos.forEach(g => {
      const d = new Date(g.fecha);
      if (d >= startOfWeek && d <= today) byDay[d.getDay()] = (byDay[d.getDay()] || 0) + (g.importe || 0);
    });
    const labels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    let cum = 0;
    return [1, 2, 3, 4, 5, 6, 0].map(d => { cum += byDay[d] || 0; return { day: labels[d], amount: cum }; });
  }, [gastos]);

  const openModal = (type: "view" | "edit" | "delete", gasto: any) => {
    setSelectedGasto(gasto);
    if (type === "edit") setEditFormData({ concepto: gasto.concepto, importe: gasto.importe, categoria: gasto.categoria, usuario: gasto.usuario });
    setActiveModal(type);
  };
  const closeModal = () => { setActiveModal(null); setSelectedGasto(null); };

  const handleDelete = async () => {
    if (!selectedGasto) return;
    setIsSubmitting(true);
    await supabase.from("gastos").delete().eq("id", selectedGasto.id);
    setIsSubmitting(false);
    closeModal();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGasto) return;
    setIsSubmitting(true);
    await supabase.from("gastos").update({
      concepto: editFormData.concepto,
      importe: parseFloat(editFormData.importe),
      categoria: editFormData.categoria,
      usuario: editFormData.usuario,
    }).eq("id", selectedGasto.id);
    setIsSubmitting(false);
    closeModal();
  };

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants: any = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } } };

  const formatDate = (d: Date) => d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const formatTime = (d: Date) => d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });

  if (!isMounted) return null;

  return (
    <div className="dashboardContainer">
      {/* HEADER */}
      <header className="premiumHeader">
        <div className="brand">
          <span style={{ fontSize: "2rem" }}>🐰</span>
          <h1 className="brandName">Bambuchón Financiero</h1>
        </div>
        <div className="headerClock">
          {formatDate(currentTime)}, {formatTime(currentTime)}
        </div>
        <div className="headerActions">
          <button className="iconBtn" onClick={() => window.open("https://t.me/Bambuchon_bot", "_blank")} title="Abrir Bot">
            <Send size={18} />
          </button>
          <button className="iconBtn" onClick={toggleTheme} title="Cambiar tema">
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </header>

      <motion.main className="dashboardContent" variants={containerVariants} initial="hidden" animate="visible">

        {/* KPIs */}
        <div className="kpiGrid">
          {[
            { label: "Total del Mes", value: stats.total, accent: "#3B82F6" },
            { label: "Gasto Jorge", value: stats.jorge, accent: "#3B82F6" },
            { label: "Gasto Diana", value: stats.diana, accent: "#F472B6" },
          ].map((kpi, i) => (
            <motion.div key={i} variants={itemVariants} className="kpiCard" style={{ "--accent-color": kpi.accent } as any}>
              <div className="kpiLabel">{kpi.label}</div>
              <div className="kpiValue"><AnimatedNumber value={kpi.value} /></div>
            </motion.div>
          ))}
        </div>

        {/* BUDGET BAR */}
        <motion.div variants={itemVariants} className="budgetSection">
          <div className="budgetHeader">
            <div className="budgetInfo">
              <h3>Progreso Presupuesto Mensual</h3>
              <div className="budgetPrice">
                ${stats.total.toLocaleString()}
                <span style={{ fontSize: "1rem", color: "var(--text-muted)", marginLeft: 8 }}>de $9,000</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700, fontSize: "1.25rem", color: budgetPct > 90 ? "#EF4444" : "var(--text-main)" }}>
                {budgetPct.toFixed(1)}%
              </div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, opacity: 0.6, textTransform: "uppercase", letterSpacing: 1 }}>
                Consumido
              </div>
            </div>
          </div>
          <div className="progressBarWrapper">
            <motion.div className={`progressBar ${budgetColor}`} initial={{ width: 0 }} animate={{ width: `${budgetPct}%` }} transition={{ duration: 1.5, ease: "easeOut" }} />
          </div>
        </motion.div>

        {/* TREND + LAST EXPENSE */}
        <div className="summaryRow">
          <motion.div variants={itemVariants} className="chartCard">
            <h2 className="chartTitle">Tendencia Acumulada Semanal</h2>
            <div style={{ height: 260, width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={lineData}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: "#94A3B8" }} dy={10} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "none", background: "var(--card-bg)", color: "var(--text-main)", boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
                    formatter={(v: any) => [`$${v?.toLocaleString()}`, "Acumulado"]}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#3B82F6" strokeWidth={3} fill="url(#grad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* LAST EXPENSE CARD */}
          <motion.div variants={itemVariants} className="lastExpenseCard">
            <div className="lastExpenseTitle">Último Gasto</div>
            {stats.last ? (
              <>
                <div className="expenseIconLarge" style={{ background: CATEGORY_MAP[stats.last.categoria]?.color || "#94A3B8" }}>
                  {(() => { const I = CATEGORY_MAP[stats.last.categoria]?.icon || MoreHorizontal; return <I size={26} color="#fff" />; })()}
                </div>
                <div className="lastExpenseConcept">{stats.last.concepto}</div>
                <div className="lastExpenseAmount" style={{ color: CATEGORY_MAP[stats.last.categoria]?.color }}>
                  ${stats.last.importe?.toLocaleString()}
                </div>
                <span className={`pillBadge badge-user-${stats.last.usuario?.toLowerCase()}`}>
                  {stats.last.usuario}
                </span>
                <div className="lastExpenseTime">
                  {new Date(stats.last.fecha).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </>
            ) : (
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Sin gastos aún</div>
            )}
          </motion.div>
        </div>

        {/* MOVEMENTS TABLE */}
        <motion.div variants={itemVariants} className="tableSection">
          <div className="tableSectionHeader">
            <div className="tableTitleRow">
              <h2 className="tableTitle">Movimientos</h2>
              <div className="pillGroup">
                {["Todos", "Jorge", "Diana"].map(u => (
                  <button key={u} className={`pillBtn ${filterUser === u ? "active" : ""}`} onClick={() => setFilterUser(u)}>{u}</button>
                ))}
              </div>
            </div>
            <div className="categoryScroll">
              <button className={`catPill ${filterCategory === "Todas" ? "active" : ""}`} onClick={() => setFilterCategory("Todas")} style={{ "--cat-color": "#64748B", "--cat-color-alpha": "#64748B20" } as any}>
                <Filter size={13} /> Todas
              </button>
              {Object.entries(CATEGORY_MAP).map(([name, cfg]) => (
                <button key={name} className={`catPill ${filterCategory === name ? "active" : ""}`} onClick={() => setFilterCategory(name)}
                  style={{ "--cat-color": cfg.color, "--cat-color-alpha": `${cfg.color}20` } as any}>
                  <cfg.icon size={13} /> {name}
                </button>
              ))}
            </div>
          </div>

          <div className="tableWrapper">
            <table className="movementsTable">
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Detalle</th>
                  <th>Categoría</th>
                  <th>Usuario</th>
                  <th style={{ textAlign: "right" }}>Monto</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {filteredGastos.map(g => (
                    <motion.tr key={g.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                      <td style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1 }}>
                        {new Date(g.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }).toUpperCase()}
                      </td>
                      <td style={{ fontWeight: 600, fontSize: 14 }}>
                        {g.concepto}
                        {g.imagen_url && (
                          <button onClick={() => setImageModalUrl(g.imagen_url)} style={{ marginLeft: 8, color: "#3B82F6", background: "none", border: "none", cursor: "pointer", verticalAlign: "middle" }}>
                            <Camera size={13} />
                          </button>
                        )}
                      </td>
                      <td>
                        <span className="pillBadge badge-cat" style={{ "--cat-color": CATEGORY_MAP[g.categoria]?.color, "--cat-color-alpha": `${CATEGORY_MAP[g.categoria]?.color}20` } as any}>
                          {(() => { const I = CATEGORY_MAP[g.categoria]?.icon || MoreHorizontal; return <I size={11} />; })()}
                          {g.categoria}
                        </span>
                      </td>
                      <td>
                        <span className={`pillBadge badge-user-${g.usuario?.toLowerCase()}`}>{g.usuario}</span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, fontSize: 15 }}>
                        ${g.importe?.toLocaleString()}
                      </td>
                      <td>
                        <div className="actionPillGroup">
                          <button className="actionPill pill-view" onClick={() => openModal("view", g)}><Eye size={13} /> <span className="actionText">Ver</span></button>
                          <button className="actionPill pill-edit" onClick={() => openModal("edit", g)}><Pencil size={13} /> <span className="actionText">Editar</span></button>
                          <button className="actionPill pill-delete" onClick={() => openModal("delete", g)}><Trash2 size={13} /> <span className="actionText">Borrar</span></button>
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

      {/* MODALS */}
      <AnimatePresence>
        {activeModal && (
          <motion.div className="modalOverlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal}>
            <motion.div className="modalContent" initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 20 }} onClick={e => e.stopPropagation()}>

              <div className="modalHeader">
                <h2 className="modalTitle">
                  {activeModal === "view" && "Detalles"}
                  {activeModal === "edit" && "Editar Gasto"}
                  {activeModal === "delete" && "Confirmar"}
                </h2>
                <button className="modalClose" onClick={closeModal}><X size={22} /></button>
              </div>

              <div className="modalBody">

                {/* VIEW */}
                {activeModal === "view" && selectedGasto && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {[
                      { label: "Concepto", value: selectedGasto.concepto },
                      { label: "Importe", value: `$${selectedGasto.importe?.toLocaleString()}`, big: true },
                      { label: "Categoría", value: selectedGasto.categoria },
                      { label: "Usuario", value: selectedGasto.usuario },
                      { label: "Fecha", value: new Date(selectedGasto.fecha).toLocaleString("es-MX") },
                    ].map(row => (
                      <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderRadius: 12, background: "var(--border-light)" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>
                          {row.label}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: row.big ? 22 : 14, color: "var(--text-main)" }}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* EDIT */}
                {activeModal === "edit" && (
                  <form id="editForm" onSubmit={handleUpdate}>
                    {[
                      { label: "Concepto", key: "concepto", type: "text" },
                      { label: "Importe", key: "importe", type: "number" },
                    ].map(f => (
                      <div key={f.key} className="formGroup">
                        <label className="formLabel">{f.label}</label>
                        <input type={f.type} className="formInput" value={(editFormData as any)[f.key]} onChange={e => setEditFormData({ ...editFormData, [f.key]: e.target.value })} required />
                      </div>
                    ))}
                    <div className="formGroup">
                      <label className="formLabel">Categoría</label>
                      <select className="formSelect" value={editFormData.categoria} onChange={e => setEditFormData({ ...editFormData, categoria: e.target.value })}>
                        {Object.keys(CATEGORY_MAP).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="formGroup">
                      <label className="formLabel">Usuario</label>
                      <select className="formSelect" value={editFormData.usuario} onChange={e => setEditFormData({ ...editFormData, usuario: e.target.value })}>
                        <option value="Jorge">Jorge</option>
                        <option value="Diana">Diana</option>
                      </select>
                    </div>
                  </form>
                )}

                {/* DELETE */}
                {activeModal === "delete" && (
                  <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <div style={{ width: 64, height: 64, background: "#FEE2E2", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                      <Trash2 size={28} color="#DC2626" />
                    </div>
                    <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>¿Eliminar este registro?</p>
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Esta acción no se puede deshacer.</p>
                  </div>
                )}
              </div>

              <div className="modalFooter">
                {activeModal === "view" && <button className="btn-primary" style={{ width: "100%" }} onClick={closeModal}>Cerrar</button>}
                {activeModal === "edit" && <button type="submit" form="editForm" className="btn-primary" style={{ width: "100%" }} disabled={isSubmitting}>{isSubmitting ? "Guardando..." : "Guardar Cambios"}</button>}
                {activeModal === "delete" && (
                  <>
                    <button onClick={closeModal} style={{ flex: 1, padding: "12px", borderRadius: 10, fontWeight: 700, border: "1px solid var(--border-light)", background: "transparent", color: "var(--text-main)", cursor: "pointer" }}>Cancelar</button>
                    <button onClick={handleDelete} disabled={isSubmitting} style={{ flex: 1, padding: "12px", borderRadius: 10, fontWeight: 700, border: "none", background: "#DC2626", color: "#fff", cursor: "pointer" }}>
                      {isSubmitting ? "Borrando..." : "Sí, borrar"}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* IMAGE LIGHTBOX */}
      <AnimatePresence>
        {imageModalUrl && (
          <motion.div className="modalOverlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setImageModalUrl(null)} style={{ zIndex: 2000 }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ position: "relative", maxWidth: "min(90vw, 700px)" }} onClick={e => e.stopPropagation()}>
              <img src={imageModalUrl} alt="Recibo" style={{ width: "100%", borderRadius: 16, maxHeight: "85vh", objectFit: "contain" }} />
              <button onClick={() => setImageModalUrl(null)} style={{ position: "absolute", top: 12, right: 12, width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={18} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}