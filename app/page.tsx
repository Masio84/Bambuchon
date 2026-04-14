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
  Eye, Pencil, Trash2, X, Send, Sun, Moon, Filter, Camera, Lock, LogOut, Settings, User, Check, Users, Shield
} from "lucide-react";
import "./dashboard.css";

// Removed hardcoded BUDGET_TOTAL to use dynamic incomes

const CATEGORY_MAP: Record<string, { color: string; icon: any }> = {
  Despensa: { color: "#0099BB", icon: ShoppingCart },
  Entretenimiento: { color: "#E05555", icon: Music },
  Salud: { color: "#3BAA2A", icon: Heart },
  Transporte: { color: "#E07A20", icon: Truck },
  Restaurantes: { color: "#9B4DB0", icon: Utensils },
  Facturable: { color: "#C8A000", icon: FileText },
  Ingreso: { color: "#10B981", icon: Send },
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
  const [activeModal, setActiveModal] = useState<"view" | "edit" | "delete" | "create" | null>(null);
  const [selectedGasto, setSelectedGasto] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editFormData, setEditFormData] = useState({ concepto: "", importe: "", categoria: "", usuario: "" });
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userProfile, setUserProfile] = useState({ id: "", name: "", avatar: "👤", rol: "usuario" });
  const [allProfiles, setAllProfiles] = useState<any[]>([]);

  const fetchProfile = async (uid: string) => {
    const { data, error } = await supabase.from('perfiles').select('*').eq('id', uid).single();
    if (data && !error) {
      setUserProfile({ id: data.id, name: data.display_name || "Usuario", avatar: data.avatar || "👤", rol: data.rol });
      if (data.rol === 'superadmin') fetchAllProfiles();
    }
  };

  const fetchAllProfiles = async () => {
    const { data } = await supabase.from('perfiles').select('*').order('created_at', { ascending: true });
    if (data) setAllProfiles(data);
  };

  useEffect(() => {
    setIsMounted(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) fetchProfile(session.user.id);
      else {
        setUserProfile({ id: "", name: "", avatar: "👤", rol: "usuario" });
        setAllProfiles([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.from('perfiles').update({
      display_name: userProfile.name,
      avatar: userProfile.avatar
    }).eq('id', userProfile.id);
    
    if (!error) {
      setIsSettingsOpen(false);
      if (userProfile.rol === 'superadmin') fetchAllProfiles();
    }
    setAuthLoading(false);
  };

  const handleToggleRole = async (targetId: string, currentRole: string) => {
    const newRole = currentRole === 'superadmin' ? 'usuario' : 'superadmin';
    const { error } = await supabase.from('perfiles').update({ rol: newRole }).eq('id', targetId);
    if (!error) fetchAllProfiles();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });
    if (error) setAuthError("Credenciales inválidas. Intenta de nuevo.");
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

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
        console.log("Realtime event received:", payload);
        if (payload.eventType === "INSERT") setGastos(p => [payload.new, ...p]);
        else if (payload.eventType === "UPDATE") setGastos(p => p.map(g => g.id === payload.new.id ? payload.new : g));
        else if (payload.eventType === "DELETE") setGastos(p => p.filter(g => g.id !== payload.old.id));
      }).subscribe((status) => {
        console.log("Supabase Realtime Status:", status);
      });

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
    const ingresos = monthly.filter(g => g.tipo === "ingreso").reduce((s, g) => s + (g.importe || 0), 0);
    const egresos = monthly.filter(g => g.tipo === "egreso").reduce((s, g) => s + (g.importe || 0), 0);
    return {
      total: egresos,
      ingresos,
      balance: ingresos - egresos,
      jorge: monthly.filter(g => g.usuario === "Jorge" && g.tipo === "egreso").reduce((s, g) => s + (g.importe || 0), 0),
      diana: monthly.filter(g => g.usuario === "Diana" && g.tipo === "egreso").reduce((s, g) => s + (g.importe || 0), 0),
      count: monthly.length,
      last: gastos[0] || null,
    };
  }, [gastos]);

  const currentBudget = stats.ingresos || 0;
  const budgetPct = currentBudget > 0 ? Math.min((stats.total / currentBudget) * 100, 100) : 0;
  const budgetColor = budgetPct > 90 ? "progress-red" : budgetPct > 70 ? "progress-yellow" : "progress-green";

  const lineData = useMemo(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    startOfWeek.setHours(0, 0, 0, 0);
    const byDay: Record<number, number> = {};
    gastos.forEach(g => {
      const d = new Date(g.fecha);
      if (d >= startOfWeek && d <= today && g.tipo === "egreso") byDay[d.getDay()] = (byDay[d.getDay()] || 0) + (g.importe || 0);
    });
    const labels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    let cum = 0;
    return [1, 2, 3, 4, 5, 6, 0].map(d => { cum += byDay[d] || 0; return { day: labels[d], amount: cum }; });
  }, [gastos]);

  const openModal = (type: "view" | "edit" | "delete" | "create", gasto: any = null) => {
    setSelectedGasto(gasto);
    if (type === "edit" && gasto) {
      setEditFormData({ concepto: gasto.concepto, importe: gasto.importe.toString(), categoria: gasto.categoria, usuario: gasto.usuario, tipo: gasto.tipo || "egreso" });
    } else if (type === "create") {
      setEditFormData({ concepto: "", importe: "", categoria: "Otros", usuario: "Jorge", tipo: "egreso" });
    }
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
    setIsSubmitting(true);
    const payload = {
      concepto: editFormData.concepto,
      importe: parseFloat(editFormData.importe),
      categoria: editFormData.categoria,
      usuario: editFormData.usuario,
      tipo: editFormData.tipo,
      confirmado: true,
      fecha: activeModal === "create" ? new Date().toISOString() : selectedGasto?.fecha
    };

    if (activeModal === "edit" && selectedGasto) {
      await supabase.from("gastos").update(payload).eq("id", selectedGasto.id);
    } else if (activeModal === "create") {
      await supabase.from("gastos").insert(payload);
    }
    
    setIsSubmitting(false);
    closeModal();
  };

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants: any = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } } };

  const formatDate = (d: Date) => d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const formatTime = (d: Date) => d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });

  if (!isMounted) return null;

  if (!session) {
    return (
      <div className="loginContainer">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="loginCard"
        >
          <div className="loginHeader">
            <span className="loginLogo">🐰</span>
            <h1 className="loginTitle">Bambuchón Financiero</h1>
            <p className="loginSubtitle">Acceso Privado</p>
          </div>
          
          <form onSubmit={handleLogin} className="loginForm">
            <div className="formGroup">
              <label className="formLabel">Correo Electrónico</label>
              <input 
                type="email" 
                className="formInput" 
                placeholder="tu@correo.com"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                required 
              />
            </div>
            <div className="formGroup">
              <label className="formLabel">Contraseña</label>
              <input 
                type="password" 
                className="formInput" 
                placeholder="••••••••"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                required 
              />
            </div>
            
            {authError && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="authError">{authError}</motion.p>}
            
            <button type="submit" className="loginBtn" disabled={authLoading}>
              {authLoading ? "Verificando..." : "Entrar al Dashboard"}
            </button>
          </form>
          
          <div className="loginFooter">
            <Lock size={12} /> Espacio Seguro y Encriptado
          </div>
        </motion.div>
      </div>
    );
  }

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
          {session?.user && (
            <div className="headerUserProfile">
              <div className="headerAvatar">{userProfile.avatar}</div>
              <div className="headerUserData">
                <span className="headerUserName">{userProfile.name}</span>
                <span className={`headerUserRole ${userProfile.rol === "superadmin" ? "role-admin" : ""}`}>
                  {userProfile.rol === "superadmin" ? "Superadmin" : "Usuario"}
                </span>
              </div>
            </div>
          )}
          <button className="iconBtn" onClick={() => window.open("https://t.me/Bambuchon_bot", "_blank")} title="Abrir Bot">
            <Send size={18} />
          </button>
          <button className="iconBtn" onClick={toggleTheme} title="Cambiar tema">
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button className="iconBtn" onClick={() => setIsSettingsOpen(true)} title="Configuración">
            <Settings size={18} />
          </button>
          <button className="iconBtn" onClick={handleLogout} title="Cerrar sesión" style={{ color: "#EF4444" }}>
            <LogOut size={18} />
          </button>
          <button className="btn-primary" onClick={() => openModal("create")} style={{ padding: "8px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Pencil size={16} /> Nuevo
          </button>
        </div>
      </header>

      <motion.main className="dashboardContent" variants={containerVariants} initial="hidden" animate="visible">

        {/* KPIs */}
        <div className="kpiGrid">
          {[
            { label: "Balance Real", value: stats.balance, accent: stats.balance >= 0 ? "#10B981" : "#EF4444" },
            { label: "Ingresos Mes", value: stats.ingresos, accent: "#10B981" },
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
              <h3>Uso de Ingresos del Mes</h3>
              <div className="budgetPrice">
                ${stats.total.toLocaleString()}
                <span style={{ fontSize: "1rem", color: "var(--text-muted)", marginLeft: 8 }}>
                  {stats.ingresos > 0 ? `de $${stats.ingresos.toLocaleString()} registrados` : "sin ingresos registrados aún"}
                </span>
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
            <div className="lastExpenseTitle">Último Movimiento</div>
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
                      <td style={{ textAlign: "right", fontWeight: 700, fontSize: 15, color: g.tipo === 'ingreso' ? "#10B981" : "var(--text-main)" }}>
                        {g.tipo === 'ingreso' ? '+' : '-'}${g.importe?.toLocaleString()}
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

      <footer className="dashboardFooter">
        <p>&copy; {new Date().getFullYear()} Masio Technologies & Digital Solutions. Todos los derechos reservados.</p>
      </footer>

      {/* MODALS */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div className="modalOverlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSettingsOpen(false)}>
            <motion.div className="modalContent settingsModal" initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} onClick={e => e.stopPropagation()}>
              <div className="modalHeader">
                <h2 className="modalTitle">Configuración</h2>
                <button className="modalClose" onClick={() => setIsSettingsOpen(false)}><X size={22} /></button>
              </div>

              <div className="modalBody">
                <div className="settingsUserHeader">
                  <div className="settingsAvatar">{userProfile.avatar}</div>
                  <div className="settingsUserInfo">
                    <span className="settingsEmail">{session?.user?.email}</span>
                    {userProfile.rol === "superadmin" && (
                      <span className="superadminBadge">👑 Superadmin</span>
                    )}
                  </div>
                </div>

                <div className="settingsTabs">
                  <button className="settingsTab active">Mi Perfil</button>
                  {userProfile.rol === "superadmin" && <button className="settingsTab">Usuarios</button>}
                </div>

                <div className="settingsContent">
                  <form onSubmit={handleUpdateProfile} className="settingsForm">
                    <div className="formGroup">
                      <label className="formLabel">Nombre mostrado</label>
                      <input 
                        type="text" 
                        className="formInput" 
                        value={userProfile.name}
                        onChange={e => setUserProfile({...userProfile, name: e.target.value})}
                        placeholder="Tu nombre"
                      />
                    </div>
                    <div className="formGroup">
                      <label className="formLabel">Icono / Emoji</label>
                      <div className="emojiGrid">
                        {["👤", "🤖", "🐱", "🦊", "🦁", "🐧", "⭐", "🔥", "💎", "🎯"].map(emoji => (
                          <button 
                            key={emoji}
                            type="button"
                            className={`emojiBtn ${userProfile.avatar === emoji ? "active" : ""}`}
                            onClick={() => setUserProfile({...userProfile, avatar: emoji})}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button type="submit" className="btn-primary" style={{ width: "100%", marginTop: "1rem" }} disabled={authLoading}>
                      {authLoading ? "Guardando..." : "Guardar Cambios"}
                    </button>
                  </form>

                  {userProfile.rol === "superadmin" && (
                    <div className="userManagementSection">
                      <h3 className="sectionTitle">
                        <Users size={16} /> Gestión de Usuarios
                      </h3>
                      <div className="userList">
                        {allProfiles.map(profile => (
                          <div key={profile.id} className="userItem">
                            <div className="userItemAvatarSmall">{profile.avatar || "👤"}</div>
                            <div className="userItemInfo">
                              <span className="userItemName">{profile.display_name}</span>
                              <span className="userItemEmail">{profile.email}</span>
                            </div>
                            <button 
                              className={`roleToggleBtn ${profile.rol === 'superadmin' ? 'is-admin' : ''}`}
                              onClick={() => handleToggleRole(profile.id, profile.rol)}
                              disabled={profile.id === userProfile.id}
                              title={profile.id === userProfile.id ? "No puedes quitarte tu propio rango" : "Cambiar rol"}
                            >
                              {profile.rol === 'superadmin' ? <Shield size={14} /> : <User size={14} />}
                              {profile.rol === 'superadmin' ? 'Admin' : 'User'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {activeModal && (
          <motion.div className="modalOverlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal}>
            <motion.div className="modalContent" initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 20 }} onClick={e => e.stopPropagation()}>

              <div className="modalHeader">
                <h2 className="modalTitle">
                  {activeModal === "view" && "Detalles"}
                  {activeModal === "edit" && "Editar Registro"}
                  {activeModal === "create" && "Nuevo Registro"}
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

                {/* EDIT / CREATE */}
                {(activeModal === "edit" || activeModal === "create") && (
                  <form id="editForm" onSubmit={handleUpdate}>
                    <div className="formGroup">
                      <label className="formLabel">Tipo</label>
                      <select className="formSelect" value={editFormData.tipo} onChange={e => {
                        const newTipo = e.target.value;
                        setEditFormData({ 
                          ...editFormData, 
                          tipo: newTipo,
                          categoria: newTipo === 'ingreso' ? 'Ingreso' : 'Otros'
                        });
                      }}>
                        <option value="egreso">Egreso (Gasto)</option>
                        <option value="ingreso">Ingreso</option>
                      </select>
                    </div>
                    {[
                      { label: "Concepto", key: "concepto", type: "text" },
                      { label: "Importe", key: "importe", type: "number" },
                    ].map(f => (
                      <div key={f.key} className="formGroup">
                        <label className="formLabel">{f.label}</label>
                        <input type={f.type} step="0.01" className="formInput" value={(editFormData as any)[f.key]} onChange={e => setEditFormData({ ...editFormData, [f.key]: e.target.value })} required />
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
                {(activeModal === "edit" || activeModal === "create") && <button type="submit" form="editForm" className="btn-primary" style={{ width: "100%" }} disabled={isSubmitting}>{isSubmitting ? "Guardando..." : "Guardar"}</button>}
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