import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth, roleLabel } from '../lib/useAuth.js';

const ic = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const IconGrid = (p) => (<svg {...ic} {...p}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>);
const IconPlus = (p) => (<svg {...ic} {...p}><path d="M12 5v14" /><path d="M5 12h14" /></svg>);
const IconUsers = (p) => (<svg {...ic} {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>);
const IconPulse = (p) => (<svg {...ic} {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>);
const IconBuilding = (p) => (<svg {...ic} {...p}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" /></svg>);
const IconLogout = (p) => (<svg {...ic} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>);
const IconBook = (p) => (<svg {...ic} {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>);
const IconLayers = (p) => (<svg {...ic} {...p}><path d="M12 2 2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>);
const IconGraduation = (p) => (<svg {...ic} {...p}><path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" /></svg>);
const IconClass = (p) => (<svg {...ic} {...p}><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M7 20h10" /><path d="M7 9h6M7 13h4" /></svg>);
const IconMenu = (p) => (<svg {...ic} {...p}><path d="M3 12h18M3 6h18M3 18h18" /></svg>);
const IconClose = (p) => (<svg {...ic} {...p}><path d="M18 6 6 18" /><path d="M6 6l12 12" /></svg>);

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { isAdmin, isContentManager, isPlatformAdmin, role, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Ferme le tiroir mobile à chaque changement de route.
  useEffect(() => setOpen(false), [location.pathname]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login', { replace: true });
  };

  const links = [
    { to: '/admin', label: 'Tableau de bord', icon: <IconGrid />, end: true, show: true },
    { to: '/admin/exams/new', label: 'Nouvel examen', icon: <IconPlus />, show: isContentManager },
    { to: '/admin/matieres', label: 'Matières', icon: <IconLayers />, show: isContentManager },
    { to: '/admin/classes', label: 'Classes', icon: <IconClass />, show: isContentManager },
    { to: '/admin/quiz', label: 'Banque de quiz', icon: <IconBook />, show: isContentManager },
    { to: '/admin/eleves', label: 'Élèves', icon: <IconGraduation />, show: isAdmin },
    { to: '/admin/users', label: 'Utilisateurs', icon: <IconUsers />, show: isAdmin },
    { to: '/admin/activity', label: 'Activité', icon: <IconPulse />, show: isAdmin },
    { to: '/admin/tenants', label: 'Instances', icon: <IconBuilding />, show: isPlatformAdmin },
  ].filter((l) => l.show);

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
      isActive ? 'bg-accent/15 text-accent' : 'text-muted hover:text-white hover:bg-white/5'
    }`;

  return (
    <div className="min-h-screen">
      {/* Barre supérieure mobile */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-surface/90 backdrop-blur border-b border-accent/20">
        <button onClick={() => setOpen(true)} className="icon-btn" aria-label="Ouvrir le menu"><IconMenu /></button>
        <span className="title-display text-sm">Administration</span>
        <span className="w-8" />
      </header>

      {/* Voile mobile */}
      {open && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Barre latérale */}
      <aside
        className={`fixed z-50 inset-y-0 left-0 w-64 bg-surface border-r border-accent/20 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center gap-3 px-5 border-b border-accent/20">
          <div className="w-9 h-9 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-display">ق</div>
          <div className="leading-tight">
            <p className="title-display text-sm">Al-Qawā'id</p>
            <p className="text-[10px] text-muted uppercase tracking-widest">Centre d'examens</p>
          </div>
          <button className="ml-auto lg:hidden icon-btn" onClick={() => setOpen(false)} aria-label="Fermer le menu"><IconClose /></button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.icon}<span>{l.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-accent/20">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs text-white truncate">{session?.user?.email}</p>
            {role && <p className="text-[10px] uppercase tracking-widest text-accent mt-0.5">{roleLabel(role)}</p>}
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:text-incorrect hover:bg-incorrect/10 transition"
          >
            <IconLogout /><span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Contenu */}
      <main className="lg:pl-64 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
