import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AgentProvider } from './contexts/AgentContext'
import { ConnectionProvider } from './contexts/ConnectionContext'
import ChatPage from './pages/ChatPage'
import PairPage from './pages/PairPage'
import SettingsPage from './pages/SettingsPage'
import HistoryPage from './pages/HistoryPage'
import KnowledgePage from './pages/KnowledgePage'
import SkillsPage from './pages/SkillsPage'

export default function App() {
  return (
    <AgentProvider>
      <ConnectionProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/skills" element={<SkillsPage />} />
            <Route path="/pair" element={<PairPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ConnectionProvider>
    </AgentProvider>
  )
}
