import { useEffect, useState } from 'react';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { ensureSeeded } from './lib/db';
import { useSettings } from './lib/hooks';
import { Dashboard } from './pages/Dashboard';
import { Learn } from './pages/Learn';
import { Training } from './pages/Training';
import { Library } from './pages/Library';
import { ImportPage } from './pages/Import';
import { SettingsPage } from './pages/Settings';
import { BadgeWatcher } from './components/BadgeWatcher';

const NAV = [
  { to: '/', label: 'Übersicht', icon: '🏠' },
  { to: '/lernen', label: 'Lernen', icon: '📇' },
  { to: '/training', label: 'Training', icon: '🎯' },
  { to: '/vokabeln', label: 'Vokabeln', icon: '📚' },
  { to: '/import', label: 'Import', icon: '✨' },
  { to: '/einstellungen', label: 'Optionen', icon: '⚙️' },
];

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settings = useSettings();

  useEffect(() => {
    ensureSeeded()
      .then(() => setReady(true))
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  if (error) return <div className="splash">Die Datenbank konnte nicht geöffnet werden: {error}</div>;
  if (!ready)
    return (
      <div className="splash">
        <div className="splash-logo">Parliamo!</div>
        <p>Vokabeln werden vorbereitet …</p>
      </div>
    );

  return (
    <HashRouter>
      <div className="shell">
        <header className="topbar">
          <NavLink to="/" className="brand">
            <span className="flag" aria-hidden />
            Parliamo!
          </NavLink>
          <nav className="topnav">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/lernen" element={<Learn />} />
            <Route path="/training" element={<Training />} />
            <Route path="/vokabeln" element={<Library />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/einstellungen" element={<SettingsPage />} />
          </Routes>
        </main>
        <nav className="tabbar">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}>
              <span className="tab-icon">{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <BadgeWatcher />
      </div>
    </HashRouter>
  );
}
