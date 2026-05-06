import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { LandingPage } from './components/LandingPage.tsx'
import { ProofpointDummyPage } from './components/ProofpointDummyPage.tsx'
import { ProofpointCASBPage } from './components/proofpoint/ProofpointCASBPage.tsx'
import { ProofpointWebSecurityPage } from './components/proofpoint/ProofpointWebSecurityPage.tsx'
import { ProofpointNprePage } from './components/proofpoint/ProofpointNprePage.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/proofpoint" element={<ProofpointDummyPage />} />
          <Route path="/proofpoint/casb" element={<ProofpointCASBPage />} />
          <Route path="/proofpoint/websecurity" element={<ProofpointWebSecurityPage />} />
          <Route path="/proofpoint/npre" element={<ProofpointNprePage />} />
          <Route path="/:customerId/*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
