'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase-client';
import './dashboard.css';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, Users, Calendar, DollarSign, 
  Filter, ArrowDownAz, ShoppingCart, Activity, 
  Car, Coffee, Receipt, MoreHorizontal, HeartPulse,
  Sun, Moon, Monitor
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper for classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Gasto {
  id: number;
  concepto: string;
  importe: number;
  categoria: string;
  usuario: string;
  fecha: string;
  created_at?: string;
  confirmado: boolean;
}

const CATEGORIES = [
  'Despensa', 'Entretenimiento', 'Salud', 'Transporte', 
  'Restaurantes', 'Facturable', 'Otros'
];

const COLORS = [
  '#60a5fa', '#a855f7', '#f472b6', '#fbbf24', 
  '#34d399', '#f87171', '#94a3b8'
];

type Theme = 'light' | 'dark' | 'system';

export default function DashboardPage() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState('Todos');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  
  // Theme State
  const [theme, setTheme] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');

  const fetchGastos = async () => {
    const { data, error } = await supabase
      .from('gastos')
      .select('*')
      .eq('confirmado', true)
      .order('fecha', { ascending: false });

    if (error) {
      console.error('Error fetching gastos:', error);
    } else {
      setGastos(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGastos();

    // Check saved theme
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }

    // Real-time subscription
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gastos' },
        (payload) => {
          console.log('Change received!', payload);
          fetchGastos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Theme effect
  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => {
      let activeTheme: 'light' | 'dark';
      
      if (theme === 'system') {
        activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else {
        activeTheme = theme;
      }
      
      setResolvedTheme(activeTheme);
      root.classList.remove('light', 'dark');
      root.classList.add(activeTheme);
      localStorage.setItem('theme', theme);
    };

    updateTheme();
    
    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => updateTheme();
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [theme]);

  // Stats Calculations
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthGastos = gastos.filter(g => {
      const d = new Date(g.fecha || g.created_at || "");
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const total = monthGastos.reduce((acc, g) => acc + g.importe, 0);
    const totalJorge = monthGastos.filter(g => g.usuario === 'Jorge').reduce((acc, g) => acc + g.importe, 0);
    const totalDiana = monthGastos.filter(g => g.usuario === 'Diana').reduce((acc, g) => acc + g.importe, 0);

    return {
      total,
      totalJorge,
      totalDiana,
      count: monthGastos.length
    };
  }, [gastos]);

  // Chart Data: Category Distribution
  const categoryData = useMemo(() => {
    const data = CATEGORIES.map(cat => ({
      name: cat,
      value: gastos.reduce((acc, g) => (g.categoria === cat ? acc + g.importe : acc), 0)
    })).filter(d => d.value > 0);
    return data;
  }, [gastos]);

  // Chart Data: Daily Expenses
  const dailyData = useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const data = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const amount = gastos
        .filter(g => {
          const d = new Date(g.fecha || g.created_at || "");
          return d.getDate() === day && d.getMonth() === now.getMonth();
        })
        .reduce((acc, g) => acc + g.importe, 0);
      return { day, amount };
    });
    return data;
  }, [gastos]);

  // Filtered Table Data
  const filteredGastos = useMemo(() => {
    return gastos.filter(g => {
      const matchUser = userFilter === 'Todos' || g.usuario === userFilter;
      const matchCat = categoryFilter === 'Todas' || g.categoria === categoryFilter;
      return matchUser && matchCat;
    });
  }, [gastos, userFilter, categoryFilter]);

  if (loading) {
    return (
      <div className="dashboardContainer">
        <div className="loadingOverlay">Cargando datos...</div>
      </div>
    );
  }

  // Chart Colors based on theme
  const chartConfig = {
    tooltipBg: resolvedTheme === 'dark' ? '#1e1e24' : '#ffffff',
    tooltipBorder: resolvedTheme === 'dark' ? '#333' : '#e2e8f0',
    tooltipText: resolvedTheme === 'dark' ? '#fff' : '#0f172a',
    grid: resolvedTheme === 'dark' ? '#333' : '#e2e8f0',
    text: resolvedTheme === 'dark' ? '#666' : '#94a3b8'
  };

  return (
    <div className="dashboardContainer">
      <header className="dashboardHeader">
        <div>
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="dashboardTitle"
          >
            Resumen de Gastos
          </motion.h1>
          <p className="dashboardSubtitle">Control familiar en tiempo real</p>
        </div>
        
        {/* Theme Toggle Group */}
        <div className="themeToggleGroup">
          <ThemeBtn 
            active={theme === 'light'} 
            onClick={() => setTheme('light')} 
            icon={<Sun size={14} />} 
            label="Claro" 
          />
          <ThemeBtn 
            active={theme === 'dark'} 
            onClick={() => setTheme('dark')} 
            icon={<Moon size={14} />} 
            label="Oscuro" 
          />
          <ThemeBtn 
            active={theme === 'system'} 
            onClick={() => setTheme('system')} 
            icon={<Monitor size={14} />} 
            label="Sistema" 
          />
        </div>
      </header>

      {/* KPI Section */}
      <div className="kpiGrid">
        <KPICard 
          label="Total este mes" 
          value={`$${stats.total.toLocaleString()}`} 
          icon={<DollarSign size={18} />} 
          delay={0}
        />
        <KPICard 
          label="Jorge" 
          value={`$${stats.totalJorge.toLocaleString()}`} 
          icon={<Users size={18} />} 
          color="blue"
          delay={0.1}
        />
        <KPICard 
          label="Diana" 
          value={`$${stats.totalDiana.toLocaleString()}`} 
          icon={<Users size={18} />} 
          color="pink"
          delay={0.2}
        />
        <KPICard 
          label="Registros" 
          value={stats.count.toString()} 
          icon={<Calendar size={18} />} 
          delay={0.3}
        />
      </div>

      {/* Charts Section */}
      <div className="chartsGrid">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="chartCard"
        >
          <h2 className="chartTitle">Distribución por Categoría</h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={categoryData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    background: chartConfig.tooltipBg, 
                    border: `1px solid ${chartConfig.tooltipBorder}`, 
                    borderRadius: '8px' 
                  }}
                  itemStyle={{ color: chartConfig.tooltipText }}
                />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="chartCard"
        >
          <h2 className="chartTitle">Gasto Diario (Mes Actual)</h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartConfig.grid} />
                <XAxis dataKey="day" stroke={chartConfig.text} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={chartConfig.text} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ 
                    background: chartConfig.tooltipBg, 
                    border: `1px solid ${chartConfig.tooltipBorder}`, 
                    borderRadius: '8px' 
                  }}
                  itemStyle={{ color: chartConfig.tooltipText }}
                />
                <Bar dataKey="amount" fill="#60a5fa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Movements Table */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="tableSection"
      >
        <div className="tableHeader">
          <h2 className="chartTitle" style={{ marginBottom: 0 }}>Movimientos Recientes</h2>
          <div className="filters">
            <select 
              value={userFilter} 
              onChange={(e) => setUserFilter(e.target.value)}
              className="filterSelect"
            >
              <option value="Todos">Todos los Usuarios</option>
              <option value="Jorge">Jorge</option>
              <option value="Diana">Diana</option>
            </select>
            <select 
              value={categoryFilter} 
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="filterSelect"
            >
              <option value="Todas">Todas las Categorías</option>
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="movementsTable">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Usuario</th>
                <th>Categoría</th>
                <th>Fecha</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filteredGastos.map((g, idx) => (
                  <motion.tr 
                    key={g.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <td>{g.concepto}</td>
                    <td>
                      <span className={cn(
                        'badge',
                        g.usuario === 'Jorge' ? 'badge-user-jorge' : 'badge-user-diana'
                      )}>
                        {g.usuario}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-category">
                        {getCategoryIcon(g.categoria)} {g.categoria}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {new Date(g.fecha || g.created_at || "").toLocaleDateString('es-MX', { 
                        day: '2-digit', month: 'short' 
                      })}
                    </td>
                    <td className="amount">${g.importe.toFixed(2)}</td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

function KPICard({ label, value, icon, color, delay }: { label: string, value: string, icon: any, color?: string, delay: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="kpiCard"
    >
      <div className="kpiLabel">
        <span style={{ color: color === 'blue' ? '#3b82f6' : color === 'pink' ? '#ec4899' : 'var(--text-muted)' }}>
          {icon}
        </span>
        {label}
      </div>
      <div className="kpiValue">{value}</div>
    </motion.div>
  );
}

function ThemeBtn({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button className={cn('themeBtn', active && 'active')} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function getCategoryIcon(cat: string) {
  switch(cat) {
    case 'Despensa': return <ShoppingCart size={14} style={{ display: 'inline', marginRight: 4 }} />;
    case 'Entretenimiento': return <Coffee size={14} style={{ display: 'inline', marginRight: 4 }} />;
    case 'Salud': return <HeartPulse size={14} style={{ display: 'inline', marginRight: 4 }} />;
    case 'Transporte': return <Car size={14} style={{ display: 'inline', marginRight: 4 }} />;
    case 'Restaurantes': return <Coffee size={14} style={{ display: 'inline', marginRight: 4 }} />;
    case 'Facturable': return <Receipt size={14} style={{ display: 'inline', marginRight: 4 }} />;
    default: return <MoreHorizontal size={14} style={{ display: 'inline', marginRight: 4 }} />;
  }
}
