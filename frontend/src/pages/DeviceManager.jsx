import React, { useState, useEffect } from 'react';
import { 
  Laptop, 
  Trash2, 
  ShieldAlert, 
  ShieldCheck, 
  RefreshCw,
  Search,
  UserCheck
} from 'lucide-react';

export default function DeviceManager() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/admin/devices');
      if (response.ok) {
        const data = await response.json();
        setDevices(data);
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleToggleTrust = async (deviceId, currentStatus) => {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/devices/${deviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_trusted: currentStatus === 1 ? 0 : 1 })
      });
      if (response.ok) {
        fetchDevices();
      }
    } catch (err) {
      console.error('Error updating device:', err);
    }
  };

  const handleDeleteDevice = async (deviceId) => {
    if (!confirm('Are you sure you want to delete this device from the registry?')) return;
    try {
      const response = await fetch(`http://localhost:5000/api/admin/devices/${deviceId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchDevices();
      }
    } catch (err) {
      console.error('Error deleting device:', err);
    }
  };

  const filteredDevices = devices.filter(dev => 
    dev.username.toLowerCase().includes(search.toLowerCase()) ||
    dev.device_name.toLowerCase().includes(search.toLowerCase()) ||
    dev.device_fingerprint.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white font-heading">Device Registry Control</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Whitelist, quarantine, or revoke hardware keys and client signatures.</p>
        </div>
        <button
          onClick={fetchDevices}
          className="flex items-center space-x-2 text-xs font-semibold px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-350 rounded-xl transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Reload Registry</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm flex items-center relative">
        <Search className="absolute left-7 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter devices by owner username or signature descriptor..."
          className="w-full pl-12 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 text-xs font-semibold rounded-xl text-slate-950 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Grid of Devices */}
      {loading ? (
        <div className="p-20 text-center flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Loading active endpoints...</span>
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-20 rounded-2xl border border-slate-100 dark:border-slate-800/80 text-center text-slate-500">
          <Laptop className="h-10 w-10 text-slate-300 mx-auto mb-3 animate-pulse" />
          <p className="font-bold text-sm font-heading">No devices found in registry.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDevices.map((dev) => (
            <div 
              key={dev.id} 
              className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border shadow-sm flex flex-col justify-between transition duration-200 ${
                dev.is_trusted === 1 
                  ? 'border-slate-100 dark:border-slate-800/80 hover:border-emerald-200 dark:hover:border-emerald-900/30' 
                  : 'border-red-100 dark:border-red-950/40 bg-red-50/10'
              }`}
            >
              <div className="space-y-3">
                {/* Device Icon and Header */}
                <div className="flex justify-between items-start">
                  <div className={`p-2.5 rounded-xl ${
                    dev.is_trusted === 1 
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-650 dark:text-blue-400' 
                      : 'bg-red-50 dark:bg-red-950/40 text-red-650 dark:text-red-400'
                  }`}>
                    <Laptop className="h-5 w-5" />
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    dev.is_trusted === 1 
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-450' 
                      : 'bg-red-105 text-red-800 dark:bg-red-950/40 dark:text-red-450'
                  }`}>
                    {dev.is_trusted === 1 ? 'TRUSTED' : 'UNTRUSTED'}
                  </span>
                </div>

                {/* Info Block */}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate font-heading" title={dev.device_name}>
                    {dev.device_name}
                  </h4>
                  <span className="text-[10px] text-slate-400 block font-mono truncate mt-0.5" title={dev.device_fingerprint}>
                    FP: {dev.device_fingerprint}
                  </span>
                </div>

                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                  <div className="flex items-center space-x-1 font-semibold text-slate-700 dark:text-slate-350">
                    <UserCheck className="h-3.5 w-3.5 text-slate-450" />
                    <span>User: <strong className="text-blue-600 dark:text-blue-400">{dev.username}</strong></span>
                  </div>
                  <div>
                    <span>Last Used: {new Date(dev.last_used_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-850/60">
                <button
                  onClick={() => handleToggleTrust(dev.id, dev.is_trusted)}
                  className={`py-1.5 px-3 rounded-lg text-[10px] font-bold border transition flex items-center justify-center space-x-1.5 ${
                    dev.is_trusted === 1 
                      ? 'border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/35 dark:text-amber-400 dark:hover:bg-amber-950/15' 
                      : 'border-emerald-250 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/35 dark:text-emerald-400 dark:hover:bg-emerald-950/15'
                  }`}
                >
                  {dev.is_trusted === 1 ? (
                    <>
                      <ShieldAlert className="h-3.5 w-3.5" />
                      <span>Revoke Trust</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Whitelist</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleDeleteDevice(dev.id)}
                  className="py-1.5 px-3 rounded-lg text-[10px] font-bold border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/35 dark:text-red-400 dark:hover:bg-red-950/15 flex items-center justify-center space-x-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Key</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
