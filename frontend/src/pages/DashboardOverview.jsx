import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  XOctagon, 
  RefreshCw, 
  Lightbulb, 
  ArrowRight,
  TrendingUp,
  FileDown
} from 'lucide-react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';

// Register ChartJS elements
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function DashboardOverview({ setTab }) {
  const [stats, setStats] = useState(null);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch stats
      const statsRes = await fetch('http://localhost:5000/api/dashboard/stats');
      if (!statsRes.ok) throw new Error('Failed to fetch dashboard stats');
      const statsData = await statsRes.json();
      setStats(statsData);

      // Fetch AI recommendations
      const recsRes = await fetch('http://localhost:5000/api/admin/recommendations');
      if (recsRes.ok) {
        const recsData = await recsRes.json();
        setRecs(recsData);
      }
    } catch (err) {
      console.error(err);
      setError('Could not connect to Flask API backend. Please ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
        <p className="text-slate-500 dark:text-slate-400 font-medium">Analyzing risk metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center max-w-lg mx-auto">
        <AlertTriangle className="h-16 w-16 text-amber-500 mb-4 animate-bounce" />
        <h3 className="text-xl font-bold text-slate-800 dark:text-white font-heading">Connection Refused</h3>
        <p className="text-slate-600 dark:text-slate-400 mt-2 mb-6 text-sm">{error}</p>
        <button 
          onClick={fetchData}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md transition flex items-center space-x-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  const { summary, risk_levels, score_distribution, recent_logs, trend } = stats;

  // Chart 1: Risk Level Distribution (Doughnut)
  const riskLevelChartData = {
    labels: ['Low Risk (0-30)', 'Medium Risk (31-70)', 'High Risk (71-100)'],
    datasets: [{
      data: [risk_levels.Low || 0, risk_levels.Medium || 0, risk_levels.High || 0],
      backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
      hoverBackgroundColor: ['#059669', '#d97706', '#dc2626'],
      borderWidth: 0,
      borderRadius: 4
    }]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#475569',
          boxWidth: 12,
          padding: 15,
          font: { family: 'Plus Jakarta Sans', size: 12 }
        }
      }
    },
    cutout: '70%'
  };

  // Chart 2: Risk Score Distribution (Bar)
  const scoreBuckets = Object.keys(score_distribution).map(k => `${k}-${parseInt(k)+10}`);
  const scoreCounts = Object.values(score_distribution);

  const riskScoreChartData = {
    labels: scoreBuckets,
    datasets: [{
      label: 'Login Attempts',
      data: scoreCounts,
      backgroundColor: 'rgba(59, 130, 246, 0.75)',
      borderRadius: 6,
      borderWidth: 0,
      hoverBackgroundColor: 'rgba(37, 99, 235, 1)'
    }]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 10 } }
      },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
        ticks: { stepSize: 1, color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 10 } }
      }
    }
  };

  // Chart 3: Risk Trend Over Time (Line)
  const trendLabels = trend.map(t => t.date_val);
  const trendSuccess = trend.map(t => t.success_cnt);
  const trendBlocked = trend.map(t => t.blocked_cnt);

  const riskTrendChartData = {
    labels: trendLabels,
    datasets: [
      {
        label: 'Success / Verified',
        data: trendSuccess,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.35,
        fill: true
      },
      {
        label: 'Blocked Attempts',
        data: trendBlocked,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
        tension: 0.35,
        fill: true
      }
    ]
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#94a3b8',
          boxWidth: 12,
          font: { family: 'Plus Jakarta Sans', size: 11 }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 10 } }
      },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
        ticks: { stepSize: 2, color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 10 } }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white font-heading">Fraud Monitoring Console</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Real-time risk scoring, device profiling, and adaptive authentication metrics.</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center space-x-2 px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl text-sm font-semibold transition"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh Stats</span>
        </button>
      </div>

      {/* Stats Counter Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* Total Logins */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Logins</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">{summary.total_logins}</span>
          </div>
        </div>

        {/* Successful Logins */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Successful</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">{summary.successful_logins}</span>
          </div>
        </div>

        {/* Blocked Logins */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl">
            <XOctagon className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Blocked Attempts</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">{summary.blocked_ins || summary.blocked_logins}</span>
          </div>
        </div>

        {/* High Risk Attempts */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">High Risk (&gt;70)</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">{summary.high_risk_attempts}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Charts & AI Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Risk Level Distribution (Pie/Doughnut) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">Risk Classification</h3>
          <div className="h-56 relative mt-4">
            <Doughnut data={riskLevelChartData} options={doughnutOptions} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -translate-y-4">
              <span className="text-3xl font-extrabold text-slate-800 dark:text-white">{summary.total_logins}</span>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Total Runs</span>
            </div>
          </div>
        </div>

        {/* Risk Score Distribution (Bar) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">Risk Score Distribution Matrix</h3>
          <div className="h-56 mt-4">
            <Bar data={riskScoreChartData} options={barOptions} />
          </div>
        </div>
      </div>

      {/* Trend and AI Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Analysis */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm lg:col-span-2">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span>Authentication Trend (Last 7 Days)</span>
            </h3>
          </div>
          <div className="h-64 mt-4">
            <Line data={riskTrendChartData} options={lineOptions} />
          </div>
        </div>

        {/* AI Recommendations Panel */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading flex items-center space-x-2 mb-4">
            <Lightbulb className="h-4.5 w-4.5 text-amber-500 fill-amber-500/10" />
            <span>AI Risk Advisories</span>
          </h3>
          <div className="flex-1 space-y-4 overflow-y-auto max-h-64 pr-1">
            {recs.map((rec) => (
              <div 
                key={rec.id}
                className={`p-3.5 rounded-xl border text-xs leading-relaxed transition-all ${
                  rec.type === 'CRITICAL' 
                    ? 'bg-red-50/50 border-red-100 text-red-900 dark:bg-red-950/20 dark:border-red-900/35 dark:text-red-300' 
                    : rec.type === 'WARNING'
                    ? 'bg-amber-50/50 border-amber-100 text-amber-900 dark:bg-amber-950/20 dark:border-amber-900/35 dark:text-amber-300'
                    : 'bg-blue-50/50 border-blue-100 text-blue-900 dark:bg-blue-950/20 dark:border-blue-900/35 dark:text-blue-300'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold tracking-tight">{rec.title}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    rec.type === 'CRITICAL' ? 'bg-red-200/60 dark:bg-red-900/40 text-red-800 dark:text-red-400' :
                    rec.type === 'WARNING' ? 'bg-amber-200/60 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400' :
                    'bg-blue-200/60 dark:bg-blue-900/40 text-blue-800 dark:text-blue-400'
                  }`}>{rec.type}</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">{rec.description}</p>
                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex justify-end">
                  <button className="flex items-center space-x-1 font-bold text-[10px] text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 uppercase tracking-wider">
                    <span>{rec.action}</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Suspicious Incidents / Recent Activity */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">Recent suspicious Activities</h3>
          <a
            href="http://localhost:5000/api/dashboard/export-csv"
            className="flex items-center space-x-2 text-xs font-semibold px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 rounded-lg transition"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/80 font-semibold">
                <th className="py-3 px-5">Timestamp</th>
                <th className="py-3 px-5">User</th>
                <th className="py-3 px-5">IP / Location</th>
                <th className="py-3 px-5">Device</th>
                <th className="py-3 px-5 text-center">Score</th>
                <th className="py-3 px-5">Risk Factors</th>
                <th className="py-3 px-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {recent_logs.slice(0, 5).map((log) => {
                const getRiskBadge = (score) => {
                  if (score <= 30) return 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/35';
                  if (score <= 70) return 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/35';
                  return 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/35';
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
                      return 'bg-slate-500/10 text-slate-600 dark:text-slate-450';
                  }
                };

                return (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="py-3.5 px-5 font-semibold text-slate-900 dark:text-white">{log.username}</td>
                    <td className="py-3.5 px-5">
                      <div className="font-semibold">{log.ip_address}</div>
                      <div className="text-[10px] text-slate-450 dark:text-slate-500">{log.location_city}, {log.location_country}</div>
                    </td>
                    <td className="py-3.5 px-5 max-w-[150px] truncate" title={log.device_name}>{log.device_name}</td>
                    <td className="py-3.5 px-5 text-center">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getRiskBadge(log.risk_score)}`}>
                        {log.risk_score}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 max-w-[200px] truncate">
                      <div className="flex flex-wrap gap-1">
                        {log.risk_factors.map((f, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-[9px] rounded text-slate-600 dark:text-slate-400">
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
        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800/80 text-center">
          <button 
            onClick={() => setTab('logs')}
            className="text-xs font-bold text-blue-600 dark:text-blue-450 hover:underline inline-flex items-center space-x-1"
          >
            <span>View All Historical Login Logs</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
