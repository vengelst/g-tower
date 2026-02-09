/**
 * main.tsx – Einstiegspunkt des G-Tower Frontends
 * =============================================================================
 * Zweck:         Mountet die React-App in das DOM und konfiguriert die
 *                Provider-Hierarchie (Router, Toast, Auth).
 * Rolle:         Wird von Vite als Entry-Point geladen (referenziert in index.html).
 *                Erstellt den React-Root und rendert die App.
 * Abhängigkeiten: React, ReactDOM, react-router-dom, AuthContext, ToastContext,
 *                Leaflet CSS, index.css (Tailwind)
 * Wichtige Annahmen:
 *   - Provider-Reihenfolge: BrowserRouter → ToastProvider → AuthProvider → App
 *   - AuthProvider muss innerhalb von BrowserRouter sein (nutzt useNavigate)
 *   - ToastProvider muss vor AuthProvider sein (Auth zeigt Toasts bei Fehlern)
 *   - StrictMode ist in Dev aktiv (doppelte Renders zum Aufspüren von Bugs)
 *   - Leaflet CSS wird global importiert (für die Kartenansicht)
 * Änderungshinweise:
 *   - Neue globale Provider hier in der korrekten Reihenfolge ergänzen
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import 'leaflet/dist/leaflet.css'  // Leaflet-Styles für die Kartenansicht (MapPage)
import './index.css'               // Tailwind CSS + eigene Utility-Klassen

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
