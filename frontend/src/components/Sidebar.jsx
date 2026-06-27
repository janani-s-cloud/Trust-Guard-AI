import React from 'react';
import { 
  LayoutDashboard, 
  PlayCircle, 
  FileSpreadsheet, 
  Laptop, 
  ShieldCheck, 
  Sun, 
  Moon 
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, darkMode, setDarkMode }) {
  const menuItems = [
    { id: 'dashboard', label: 'Fraud Dashboard', icon: LayoutDashboard },
    { id: 'simulator', label: 'Login Sandbox', icon: PlayCircle },
    { id: 'logs', label: 'Audit Logs', icon: FileSpreadsheet },
    { id: 'devices', label: 'Device Registry', icon: Laptop },
  ];

  return (
    <div className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between h-screen sticky top-0 transition-colors duration-200">
      <div>
        {/* Brand Logo */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white shadow-md shadow-blue-500/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-white font-heading tracking-tight leading-none">TrustGuard AI</h1>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Risk Auth Hub</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive 
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border-l-4 border-blue-600' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-950 dark:hover:text-slate-150'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / Theme Toggle */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800/80">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all duration-150"
        >
          <div className="flex items-center space-x-3">
            {darkMode ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-slate-500" />}
            <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </div>
          <span className="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full relative flex items-center transition-colors">
            <span className={`w-3.5 h-3.5 bg-white dark:bg-slate-900 rounded-full absolute shadow-sm transition-all duration-200 ${darkMode ? 'right-0.5' : 'left-0.5'}`} />
          </span>
        </button>
      </div>
    </div>
  );
}
