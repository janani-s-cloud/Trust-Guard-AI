import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DashboardOverview from './pages/DashboardOverview';
import LoginSimulator from './pages/LoginSimulator';
import AuditLogs from './pages/AuditLogs';
import DeviceManager from './pages/DeviceManager';
import { ShieldAlert } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(false);

  // Synchronize Tailwind dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardOverview setTab={setActiveTab} />;
      case 'simulator':
        return <LoginSimulator />;
      case 'logs':
        return <AuditLogs />;
      case 'devices':
        return <DeviceManager />;
      default:
        return <DashboardOverview setTab={setActiveTab} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* Sidebar panel */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        darkMode={darkMode} 
        setDarkMode={setDarkMode} 
      />

      {/* Main content viewport */}
      <main className="flex-1 p-8 overflow-y-auto max-h-screen">
        {/* Banner Alert if API server is not verified (optional) */}
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header Bar */}
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-205/65 dark:border-slate-800/80 p-4 rounded-2xl shadow-sm">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">TrustGuard Security Engine Active</span>
            </div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-450">
              Role: <span className="text-blue-650 dark:text-blue-400">Security Officer (Root Admin)</span>
            </div>
          </div>

          {/* Page content view */}
          <div className="transition-all duration-200">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
}
