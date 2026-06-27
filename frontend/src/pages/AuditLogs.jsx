import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  FileDown, 
  RefreshCw,
  Clock,
  Laptop,
  MapPin,
  Shield
} from 'lucide-react';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskLevel, setRiskLevel] = useState('');
  const [status, setStatus] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (riskLevel) params.append('risk_level', riskLevel);
      if (status) params.append('status', status);
      
      const response = await fetch(`http://localhost:5000/api/dashboard/logs?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [riskLevel, status]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white font-heading">Security Audit Logs</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Historical verification records, authorization actions, and metadata vectors.</p>
        </div>
        <a
          href="http://localhost:5000/api/dashboard/export-csv"
          className="flex items-center space-x-2 text-sm font-semibold px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-350 rounded-xl transition"
        >
          <FileDown className="h-4.5 w-4.5" />
          <span>Export Audit Log (CSV)</span>
        </a>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="w-full md:w-auto flex-1 flex items-center relative">
          <Search className="absolute left-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by User, IP, City, or Country..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 text-xs font-semibold rounded-xl text-slate-950 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" className="hidden">Search</button>
        </form>

        <div className="w-full md:w-auto flex flex-wrap gap-3 items-center">
          {/* Risk Level Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="h-3.5 w-3.5 text-slate-450" />
            <select
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
              className="text-xs font-semibold px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-lg text-slate-950 dark:text-white"
            >
              <option value="">All Risk Levels</option>
              <option value="Low">Low Risk</option>
              <option value="Medium">Medium Risk</option>
              <option value="High">High Risk</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="h-3.5 w-3.5 text-slate-450" />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="text-xs font-semibold px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-lg text-slate-950 dark:text-white"
            >
              <option value="">All Statuses</option>
              <option value="Success">Success (Direct)</option>
              <option value="OTP_Pending">OTP Pending</option>
              <option value="OTP_Verified">OTP Verified</option>
              <option value="OTP_Failed">OTP Failed</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>

          <button
            onClick={fetchLogs}
            className="p-2 border border-slate-200 dark:border-slate-750 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-lg transition"
            title="Reload Logs"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-20 text-center flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Loading verification logs...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-20 text-center text-slate-500 dark:text-slate-400">
            <p className="font-bold text-sm font-heading">No audit logs found matching criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/80 font-semibold">
                  <th className="py-3 px-5">Timestamp</th>
                  <th className="py-3 px-5">Username</th>
                  <th className="py-3 px-5">Location</th>
                  <th className="py-3 px-5">IP Address</th>
                  <th className="py-3 px-5">Device</th>
                  <th className="py-3 px-5 text-center">Score</th>
                  <th className="py-3 px-5">Risk Factors</th>
                  <th className="py-3 px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-350">
                {logs.map((log) => {
                  const getRiskBadge = (score) => {
                    if (score <= 30) return 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900/35';
                    if (score <= 70) return 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-450 dark:border-amber-900/35';
                    return 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950/20 dark:text-red-450 dark:border-red-900/35';
                  };

                  const getStatusBadge = (status) => {
                    switch(status) {
                      case 'Success':
                      case 'OTP_Verified':
                        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450';
                      case 'Blocked':
                        return 'bg-red-500/10 text-red-600 dark:text-red-450';
                      case 'OTP_Pending':
                        return 'bg-amber-500/10 text-amber-600 dark:text-amber-450';
                      default:
                        return 'bg-slate-500/10 text-slate-650 dark:text-slate-450';
                    }
                  };

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="py-3.5 px-5 font-semibold text-slate-900 dark:text-white">{log.username}</td>
                      <td className="py-3.5 px-5">
                        <div className="font-semibold">{log.location_city}</div>
                        <div className="text-[10px] text-slate-450">{log.location_country}</div>
                      </td>
                      <td className="py-3.5 px-5 font-mono">{log.ip_address}</td>
                      <td className="py-3.5 px-5">
                        <div className="font-medium max-w-[150px] truncate" title={log.device_name}>{log.device_name}</div>
                        <div className="text-[9px] font-mono text-slate-450 truncate" title={log.device_fingerprint}>{log.device_fingerprint}</div>
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getRiskBadge(log.risk_score)}`}>
                          {log.risk_score}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {log.risk_factors.map((f, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-[9px] rounded text-slate-600 dark:text-slate-450">
                              {f.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 font-semibold">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${getStatusBadge(log.status)}`}>
                          {log.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
