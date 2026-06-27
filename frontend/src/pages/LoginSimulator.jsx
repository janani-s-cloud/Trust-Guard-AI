import React, { useState } from 'react';
import { 
  PlayCircle, 
  User, 
  MapPin, 
  Laptop, 
  Clock, 
  ShieldCheck, 
  ShieldAlert, 
  KeyRound, 
  Lock, 
  CheckCircle,
  HelpCircle,
  Wifi,
  Unlock
} from 'lucide-react';

const SEED_USERS = [
  { username: 'alice', password: 'alice123', defaultDevice: 'fp_alice_iphone', defaultDeviceName: 'iPhone 15 (Safari/iOS)', defaultCity: 'New York', defaultCountry: 'USA' },
  { username: 'bob', password: 'bob123', defaultDevice: 'fp_bob_thinkpad', defaultDeviceName: 'ThinkPad T14 (Firefox/Linux)', defaultCity: 'London', defaultCountry: 'UK' },
  { username: 'charlie', password: 'charlie123', defaultDevice: 'fp_charlie_pixel', defaultDeviceName: 'Pixel 8 Pro (Chrome/Android)', defaultCity: 'Paris', defaultCountry: 'France' },
  { username: 'diana', password: 'diana123', defaultDevice: 'fp_diana_ipad', defaultDeviceName: 'iPad Pro (Safari/iOS)', defaultCity: 'Paris', defaultCountry: 'France' },
  { username: 'admin', password: 'admin123', defaultDevice: 'fp_admin_mac', defaultDeviceName: 'MacBook Pro (Chrome/macOS)', defaultCity: 'San Francisco', defaultCountry: 'USA' }
];

const QUICK_SCENARIOS = [
  {
    name: 'Genuine Login (Low Risk)',
    user: 'alice',
    ip: '198.51.100.12',
    device: 'fp_alice_iphone',
    deviceName: 'iPhone 15 (Safari/iOS)',
    city: 'New York',
    country: 'USA',
    hour: 12
  },
  {
    name: 'New Device (Medium Risk - OTP)',
    user: 'alice',
    ip: '198.51.100.44',
    device: 'fp_alice_windows_new',
    deviceName: 'Chrome on Windows 11 (New)',
    city: 'New York',
    country: 'USA',
    hour: 14
  },
  {
    name: 'Unusual Location (Medium Risk - OTP)',
    user: 'charlie',
    ip: '210.140.10.33',
    device: 'fp_charlie_pixel',
    deviceName: 'Pixel 8 Pro (Chrome/Android)',
    city: 'Tokyo',
    country: 'Japan',
    hour: 15
  },
  {
    name: 'Impossible Travel (High Risk - Block)',
    user: 'bob',
    ip: '95.108.174.12',
    device: 'fp_attacker_device',
    deviceName: 'Chrome (Linux)',
    city: 'Moscow',
    country: 'Russia',
    hour: 3
  }
];

export default function LoginSimulator() {
  const [selectedUserIndex, setSelectedUserIndex] = useState(0);
  const [password, setPassword] = useState(SEED_USERS[0].password);
  const [ipAddress, setIpAddress] = useState('198.51.100.12');
  const [deviceFingerprint, setDeviceFingerprint] = useState(SEED_USERS[0].defaultDevice);
  const [deviceName, setDeviceName] = useState(SEED_USERS[0].defaultDeviceName);
  const [city, setCity] = useState(SEED_USERS[0].defaultCity);
  const [country, setCountry] = useState(SEED_USERS[0].defaultCountry);
  const [hour, setHour] = useState(12);

  const [loading, setLoading] = useState(false);
  const [authStep, setAuthStep] = useState('CONFIG'); // 'CONFIG', 'OTP_SCREEN', 'SUCCESS_PORTAL', 'BLOCKED_SCREEN'
  
  // Results from backend
  const [apiResult, setApiResult] = useState(null);
  
  // OTP Verification details
  const [otpCode, setOtpCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(true);
  const [otpError, setOtpError] = useState('');
  
  const handleUserChange = (index) => {
    setSelectedUserIndex(index);
    const user = SEED_USERS[index];
    setPassword(user.password);
    setDeviceFingerprint(user.defaultDevice);
    setDeviceName(user.defaultDeviceName);
    setCity(user.defaultCity);
    setCountry(user.defaultCountry);
  };

  const loadScenario = (scenario) => {
    const uIdx = SEED_USERS.findIndex(u => u.username === scenario.user);
    if (uIdx !== -1) setSelectedUserIndex(uIdx);
    setPassword(SEED_USERS.find(u => u.username === scenario.user)?.password || '');
    setIpAddress(scenario.ip);
    setDeviceFingerprint(scenario.device);
    setDeviceName(scenario.deviceName);
    setCity(scenario.city);
    setCountry(scenario.country);
    setHour(scenario.hour);
  };

  const handleSimulateLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setOtpError('');
    setOtpCode('');
    
    // Construct simulated datetime based on current date + selected hour
    const simDate = new Date();
    simDate.setHours(hour, 0, 0, 0);

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: SEED_USERS[selectedUserIndex].username,
          password: password,
          device_fingerprint: deviceFingerprint,
          device_name: deviceName,
          ip_address: ipAddress,
          location_city: city,
          location_country: country,
          simulated_time: simDate.toISOString()
        })
      });

      const data = await response.json();
      setApiResult(data);

      if (!response.ok) {
        setAuthStep('CONFIG');
        alert(data.error || 'Authentication Failed');
        return;
      }

      if (data.action === 'ACCESS') {
        setAuthStep('SUCCESS_PORTAL');
      } else if (data.action === 'OTP') {
        setAuthStep('OTP_SCREEN');
      } else if (data.action === 'BLOCK') {
        setAuthStep('BLOCKED_SCREEN');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to authentication API backend.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setOtpError('');

    try {
      const response = await fetch('http://localhost:5000/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: SEED_USERS[selectedUserIndex].username,
          otp: otpCode,
          trust_device: trustDevice
        })
      });

      const data = await response.json();

      if (response.ok) {
        setAuthStep('SUCCESS_PORTAL');
      } else {
        setOtpError(data.error || 'Invalid OTP code.');
      }
    } catch (err) {
      console.error(err);
      setOtpError('Failed to verify OTP with server.');
    } finally {
      setLoading(false);
    }
  };

  const resetSimulator = () => {
    setAuthStep('CONFIG');
    setApiResult(null);
    setOtpCode('');
    setOtpError('');
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white font-heading">Login Sandbox</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Test real-time risk evaluation and adaptive security rules interactively.</p>
      </div>

      {authStep === 'CONFIG' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Config Panel */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading flex items-center space-x-2">
                <PlayCircle className="h-4.5 w-4.5 text-blue-500" />
                <span>Simulation Parameters</span>
              </h3>
            </div>

            {/* Quick Preset Scenarios */}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2 tracking-wider">Quick Templates</span>
              <div className="flex flex-wrap gap-2">
                {QUICK_SCENARIOS.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => loadScenario(s)}
                    className="text-[11px] font-semibold px-3 py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/20 dark:hover:text-blue-400 text-slate-600 dark:text-slate-350 rounded-lg border border-slate-150 dark:border-slate-700 transition"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSimulateLogin} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* User Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                  <User className="h-3 w-3" />
                  <span>Target User</span>
                </label>
                <select
                  value={selectedUserIndex}
                  onChange={(e) => handleUserChange(parseInt(e.target.value))}
                  className="w-full text-xs font-semibold px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SEED_USERS.map((user, idx) => (
                    <option key={user.username} value={idx}>{user.username} (Demo User)</option>
                  ))}
                </select>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                  <KeyRound className="h-3 w-3" />
                  <span>Password Validation</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter user password"
                  className="w-full text-xs font-semibold px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* IP Address */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                  <Wifi className="h-3 w-3" />
                  <span>Mock IP Address</span>
                </label>
                <input
                  type="text"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  placeholder="e.g. 198.51.100.12"
                  className="w-full text-xs font-semibold px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Simulated Hour Slider */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>Simulated Login Time: {hour.toString().padStart(2, '0')}:00 {hour >= 23 || hour < 5 ? '(Night - Unusual)' : '(Day - Normal)'}</span>
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="0"
                    max="23"
                    value={hour}
                    onChange={(e) => setHour(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>

              {/* Device Fingerprint ID */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                  <Laptop className="h-3 w-3" />
                  <span>Device Fingerprint ID</span>
                </label>
                <input
                  type="text"
                  value={deviceFingerprint}
                  onChange={(e) => setDeviceFingerprint(e.target.value)}
                  placeholder="e.g. fp_device_safari"
                  className="w-full text-xs font-mono px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Device Descriptor Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                  <Laptop className="h-3 w-3" />
                  <span>Device Name Descriptor</span>
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g. Safari on macOS (14)"
                  className="w-full text-xs font-semibold px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Location City */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                  <MapPin className="h-3 w-3" />
                  <span>Location City</span>
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. San Francisco"
                  className="w-full text-xs font-semibold px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Location Country */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                  <MapPin className="h-3 w-3" />
                  <span>Location Country</span>
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. USA"
                  className="w-full text-xs font-semibold px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2 pt-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/10 transition flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
                >
                  {loading ? 'Calculating Security Profile...' : 'Simulate Access Attempt'}
                </button>
              </div>
            </form>
          </div>

          {/* Sandbox Info Panel */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading flex items-center space-x-2">
              <HelpCircle className="h-4.5 w-4.5 text-blue-500" />
              <span>Simulation Sandbox Rules</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              This sandbox triggers the actual **TrustGuard Risk Engine** API using mock coordinates. It scores the attempt based on:
            </p>
            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2 list-disc pl-4">
              <li><strong>Device Trust (+35 pts):</strong> If the fingerprint is not registered as trusted for the chosen user.</li>
              <li><strong>Unusual Location (+30 pts):</strong> If the user has logged in successfully before, but not from this city/country.</li>
              <li><strong>Impossible Travel (+50 pts):</strong> If a country changes within 3 hours from the user's last successful login.</li>
              <li><strong>Unusual Hour (+15 pts):</strong> Logging in during nighttime hours (11 PM - 5 AM).</li>
            </ul>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Authenticating Actions:</span>
              <div className="space-y-1 text-xs font-semibold">
                <div className="flex justify-between items-center">
                  <span className="text-emerald-600">0 - 30 (Low Risk)</span>
                  <span className="text-slate-550 dark:text-slate-400 font-normal">Direct Access</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-amber-600">31 - 70 (Medium Risk)</span>
                  <span className="text-slate-550 dark:text-slate-400 font-normal">Simulated OTP</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-red-600">71 - 100 (High Risk)</span>
                  <span className="text-slate-550 dark:text-slate-400 font-normal">Blocked Access</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OTP verification Screen */}
      {authStep === 'OTP_SCREEN' && apiResult && (
        <div className="max-w-md mx-auto bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-md space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-full flex items-center justify-center mb-2">
              <Lock className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading">Verification Required</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              We detected a medium-risk login (Risk Score: <strong>{apiResult.risk_score}</strong>) due to: {apiResult.risk_factors.map(f => f.replace('_', ' ')).join(', ')}.
            </p>
          </div>

          {/* Dev Helper - Display generated simulated OTP */}
          <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/60 dark:border-blue-900/30 rounded-xl text-center">
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 block uppercase tracking-wider">Sandbox Dev OTP Code</span>
            <span className="text-xl font-extrabold text-blue-800 dark:text-blue-300 font-mono tracking-widest">{apiResult.simulated_otp}</span>
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider block text-center">Enter 6-Digit OTP</label>
              <input
                type="text"
                maxLength="6"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="0 0 0 0 0 0"
                className="w-full text-center text-lg font-bold font-mono tracking-widest px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {otpError && <p className="text-red-500 text-[11px] font-semibold text-center mt-1">{otpError}</p>}
            </div>

            <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg">
              <input
                type="checkbox"
                id="trust"
                checked={trustDevice}
                onChange={(e) => setTrustDevice(e.target.checked)}
                className="rounded border-slate-350 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="trust" className="text-xs text-slate-650 dark:text-slate-400 font-medium select-none cursor-pointer">
                Trust this device fingerprint in the database
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={resetSimulator}
                className="w-full py-2.5 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl font-bold text-xs transition"
              >
                Cancel Login
              </button>
              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition text-xs disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Success Customer Portal simulation */}
      {authStep === 'SUCCESS_PORTAL' && apiResult && (
        <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-850 shadow-sm max-w-4xl mx-auto space-y-6">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white font-heading">Secure Portal Accessed</h4>
                <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">Access Level: Low Risk Granted</p>
              </div>
            </div>
            <button
              onClick={resetSimulator}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              Back to Simulator Configuration
            </button>
          </div>

          {/* Dummy Bank Portal content */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-100 dark:border-slate-800/80 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Checking Account</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block">$14,892.42</span>
              <span className="text-[10px] text-emerald-600 mt-1 block">✔ Standard routing enabled</span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-100 dark:border-slate-800/80 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Savings Account</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block">$241,085.10</span>
              <span className="text-[10px] text-slate-450 block mt-1">+0.85% APY active</span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Secure Session Profile</span>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mt-1 block">Device: {deviceName}</span>
              </div>
              <span className="text-[9px] bg-slate-100 dark:bg-slate-800 py-1 px-2 rounded text-slate-500 font-semibold self-start mt-2">
                IP: {ipAddress} ({city}, {country})
              </span>
            </div>
          </div>

          {/* Simulated Quick Action Wire Transfer Form */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-100 dark:border-slate-800/80 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-950 dark:text-white font-heading uppercase tracking-wide">Standard Operations (Simulated Wire Transfer)</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Recipient Account Number"
                className="text-xs px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg focus:outline-none"
              />
              <input
                type="number"
                placeholder="Amount ($)"
                className="text-xs px-3.5 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg focus:outline-none"
              />
              <button
                type="button"
                onClick={() => alert("Simulation Wire Transfer processed successfully because session is low-risk verified!")}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-lg transition"
              >
                Send Money (Low Risk Path)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blocked alert screen */}
      {authStep === 'BLOCKED_SCREEN' && apiResult && (
        <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 p-8 rounded-2xl border border-red-150 dark:border-red-900/40 shadow-lg space-y-6">
          <div className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 bg-red-50 dark:bg-red-950/40 text-red-500 rounded-full flex items-center justify-center mb-2 animate-pulse">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-extrabold text-red-650 dark:text-red-400 font-heading">Access Denied & Suspended</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
              Our AI Risk Score Engine detected high anomalous activity. For your security, this transaction has been hard blocked.
            </p>
          </div>

          <div className="p-4 bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/35 rounded-xl space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-red-900 dark:text-red-300">Anomalous Risk Score:</span>
              <span className="font-extrabold text-red-700 dark:text-red-400">{apiResult.risk_score} / 100</span>
            </div>
            <div className="flex justify-between items-start text-xs border-t border-red-100 dark:border-red-900/20 pt-2">
              <span className="font-bold text-red-900 dark:text-red-300">Security Red Flags:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-350">{apiResult.risk_factors.map(f => f.replace('_', ' ')).join(', ')}</span>
            </div>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-2">
            <p className="font-semibold text-slate-700 dark:text-white">Why was my attempt blocked?</p>
            <p className="leading-relaxed">
              Access was restricted because the credentials match, but the context (location sequence, device profile, timezone, or consecutive logs) poses a high likelihood of Account Takeover (ATO) or credential stuffing.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3">
            <button
              onClick={resetSimulator}
              className="w-full py-2.5 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl font-bold text-xs transition"
            >
              Configure Parameters
            </button>
            <button
              onClick={() => alert("Simulation security reset triggered. In production, this prompts password resets and security keys.")}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md transition text-xs"
            >
              Verify Identity via Alternative Channel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
