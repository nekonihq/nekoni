import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
} from 'react-router-dom'
import { Theme, Button } from '@radix-ui/themes'
import '@radix-ui/themes/styles.css'
import { PairPage } from './pages/Pair'
import { TracesPage } from './pages/Traces'
import { MonitorPage } from './pages/Monitor'
import { KnowledgePage } from './pages/Knowledge'
import { SkillsPage } from './pages/Skills'
import { SkillEditorPage } from './pages/SkillEditor'
import { SettingsPage } from './pages/Settings'
import { LoginPage } from './pages/Login'
import { useAuth } from './hooks/useAuth'

const navStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; background: var(--color-background); color: var(--color-foreground); min-height: 100vh; }
  nav { display: flex; gap: 1px; align-items: center; background: var(--gray-2); border-bottom: 1px solid var(--gray-6); padding: 0 1rem; }
  nav a { padding: 0.75rem 1rem; color: var(--gray-10); text-decoration: none; font-size: 0.875rem; border-bottom: 2px solid transparent; }
  .nav-logo { padding: 0.75rem 1rem 0.75rem 0; font-size: 1rem; font-weight: 700; color: var(--accent-9); letter-spacing: -0.02em; border-right: 1px solid var(--gray-6); margin-right: 0.25rem; }
  nav a:hover { color: var(--gray-12); }
  nav a.active { color: var(--accent-9); border-bottom-color: var(--accent-9); }
  .page { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
  .nav-spacer { flex: 1; }
`

const App = () => {
  const { token, login, logout } = useAuth()

  if (!token) {
    return <LoginPage onLogin={login} />
  }

  return (
    <BrowserRouter>
      <nav>
        <span className="nav-logo">nekoni</span>
        <NavLink to="/" end>
          Pair
        </NavLink>
        <NavLink to="/traces">Traces</NavLink>
        <NavLink to="/monitor">Monitor</NavLink>
        <NavLink to="/knowledge">Knowledge</NavLink>
        <NavLink to="/skills">Skills</NavLink>
        <NavLink to="/settings">Settings</NavLink>
        <span className="nav-spacer" />
        <Button
          variant="ghost"
          size="1"
          color="gray"
          onClick={logout}
          style={{ marginRight: '0.5rem' }}
        >
          Logout
        </Button>
      </nav>
      <div className="page">
        <Routes>
          <Route path="/" element={<PairPage />} />
          <Route path="/traces" element={<TracesPage />} />
          <Route
            path="/monitor"
            element={<MonitorPage />}
          />
          <Route
            path="/knowledge"
            element={<KnowledgePage />}
          />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/skills/new" element={<SkillEditorPage />} />
          <Route path="/skills/:id" element={<SkillEditorPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(
  document.getElementById('root')!,
).render(
  <>
    <style>{navStyles}</style>
    <Theme
      appearance="dark"
      accentColor="jade"
      grayColor="slate"
      radius="medium"
    >
      <App />
    </Theme>
  </>,
)
