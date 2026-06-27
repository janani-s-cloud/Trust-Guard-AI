from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
import sqlite3
import os
import hashlib
from datetime import datetime, timedelta
import json
import csv
from io import StringIO

app = Flask(__name__)
# Enable CORS for frontend dev server
CORS(app, supports_credentials=True)

DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')

# In-memory store for active OTP codes
# Structure: { username: { "otp": "123456", "expires_at": datetime, "login_data": {...} } }
pending_otps = {}

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

# ----------------- RISK SCORE ENGINE -----------------

def calculate_risk_score(user_id, username, ip_address, device_fingerprint, location_city, location_country, simulated_time_str=None):
    """
    Computes a risk score from 0 to 100 based on device trust, location patterns, login time, and recent failed attempts.
    """
    score = 0
    factors = []
    
    conn = get_db_connection()
    cursor = conn.cursor()

    # Determine simulated or current time
    if simulated_time_str:
        try:
            current_time = datetime.fromisoformat(simulated_time_str)
        except Exception:
            current_time = datetime.now()
    else:
        current_time = datetime.now()

    # 1. Device Trust Check
    is_device_trusted = False
    if user_id:
        cursor.execute(
            "SELECT 1 FROM trusted_devices WHERE user_id = ? AND device_fingerprint = ? AND is_trusted = 1",
            (user_id, device_fingerprint)
        )
        is_device_trusted = cursor.fetchone() is not None

    if not is_device_trusted:
        score += 35
        factors.append("new_device")
    else:
        factors.append("device_trusted")

    # 2. Location Check
    if user_id:
        # Get historical successful locations for this user
        cursor.execute(
            "SELECT DISTINCT location_city, location_country FROM login_logs "
            "WHERE user_id = ? AND status IN ('Success', 'OTP_Verified')",
            (user_id,)
        )
        locations = cursor.fetchall()
        
        # If user has logged in before, verify current location matches
        if locations:
            matches_location = False
            for loc in locations:
                if loc['location_city'].lower() == location_city.lower() and loc['location_country'].lower() == location_country.lower():
                    matches_location = True
                    break
            
            if not matches_location:
                score += 30
                factors.append("unusual_location")
            else:
                factors.append("known_location")
        else:
            # First time user logs in, we don't penalize location as heavily, but flag it
            factors.append("first_login_location")
            
        # 3. Impossible Travel Check (different country or city > 500 miles within 3 hours)
        # For simplicity in prototype: check if any successful login was in a different country within past 3 hours
        three_hours_ago = (current_time - timedelta(hours=3)).isoformat()
        cursor.execute(
            "SELECT location_country, location_city, timestamp FROM login_logs "
            "WHERE user_id = ? AND status IN ('Success', 'OTP_Verified') AND timestamp > ? "
            "ORDER BY timestamp DESC LIMIT 1",
            (user_id, three_hours_ago)
        )
        last_login = cursor.fetchone()
        if last_login and last_login['location_country'].lower() != location_country.lower():
            score += 50
            factors.append("impossible_travel")
    else:
        # User not found (brute force scenario, or wrong username)
        score += 30
        factors.append("unknown_user")

    # 4. Time-Based Risk (Unusual hours: 11 PM to 5 AM)
    login_hour = current_time.hour
    if login_hour >= 23 or login_hour < 5:
        score += 15
        factors.append("unusual_time")

    # 5. Brute Force Check (Failed logins in last 10 minutes)
    ten_minutes_ago = (current_time - timedelta(minutes=10)).isoformat()
    cursor.execute(
        "SELECT COUNT(*) FROM login_logs WHERE username = ? AND status IN ('OTP_Failed', 'OTP_Pending') AND timestamp > ?",
        (username, ten_minutes_ago)
    )
    failed_attempts_count = cursor.fetchone()[0]
    
    if failed_attempts_count >= 3:
        score += 20
        factors.append("brute_force_detected")
    elif failed_attempts_count > 0:
        score += 10
        factors.append("multiple_failed_attempts")

    conn.close()

    # Cap score at 100
    score = min(score, 100)
    
    # Determine risk level
    if score <= 30:
        level = "Low"
    elif score <= 70:
        level = "Medium"
    else:
        level = "High"

    return score, level, factors

# ----------------- API ENDPOINTS -----------------

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')
    device_fingerprint = data.get('device_fingerprint', 'unknown')
    device_name = data.get('device_name', 'Unknown Device')
    ip_address = data.get('ip_address', '127.0.0.1')
    location_city = data.get('location_city', 'Unknown')
    location_country = data.get('location_country', 'Unknown')
    simulated_time = data.get('simulated_time') # optional ISO-8601 string
    
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    
    timestamp = simulated_time if simulated_time else datetime.now().isoformat()

    # If user doesn't exist or password hashes don't match
    if not user or user['password_hash'] != hash_password(password):
        # Calculate risk anyway to track brute force attempt logs
        user_id = user['id'] if user else None
        score, level, factors = calculate_risk_score(
            user_id, username, ip_address, device_fingerprint, location_city, location_country, timestamp
        )
        
        # Log the failed login
        cursor.execute(
            "INSERT INTO login_logs (user_id, username, timestamp, ip_address, device_fingerprint, device_name, location_city, location_country, risk_score, risk_level, risk_factors, status) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (user_id, username, timestamp, ip_address, device_fingerprint, device_name, location_city, location_country, score, level, json.dumps(factors), "OTP_Failed")
        )
        conn.commit()
        conn.close()
        return jsonify({"error": "Invalid username or password"}), 401

    # Calculate actual Risk Score
    user_id = user['id']
    score, level, factors = calculate_risk_score(
        user_id, username, ip_address, device_fingerprint, location_city, location_country, timestamp
    )

    # Adaptive Authentication Route
    if level == "High":
        # Log Blocked
        cursor.execute(
            "INSERT INTO login_logs (user_id, username, timestamp, ip_address, device_fingerprint, device_name, location_city, location_country, risk_score, risk_level, risk_factors, status) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (user_id, username, timestamp, ip_address, device_fingerprint, device_name, location_city, location_country, score, level, json.dumps(factors), "Blocked")
        )
        conn.commit()
        conn.close()
        
        return jsonify({
            "action": "BLOCK",
            "risk_score": score,
            "risk_level": level,
            "risk_factors": factors,
            "message": "Access blocked. Suspicious login pattern detected. Please contact support."
        }), 403

    elif level == "Medium" or user['mfa_enabled'] == 1:
        # OTP Required
        # Create a simple simulated OTP
        otp_code = "123456" # For simplicity in testing, we use a fixed OTP or random
        import random
        otp_code = f"{random.randint(100000, 999999)}"
        
        # Save temporary details
        pending_otps[username] = {
            "otp": otp_code,
            "expires_at": datetime.now() + timedelta(minutes=5),
            "login_data": {
                "user_id": user_id,
                "username": username,
                "timestamp": timestamp,
                "ip_address": ip_address,
                "device_fingerprint": device_fingerprint,
                "device_name": device_name,
                "location_city": location_city,
                "location_country": location_country,
                "risk_score": score,
                "risk_level": level,
                "risk_factors": factors
            }
        }
        
        # Insert initial OTP_Pending attempt
        cursor.execute(
            "INSERT INTO login_logs (user_id, username, timestamp, ip_address, device_fingerprint, device_name, location_city, location_country, risk_score, risk_level, risk_factors, status) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (user_id, username, timestamp, ip_address, device_fingerprint, device_name, location_city, location_country, score, level, json.dumps(factors), "OTP_Pending")
        )
        conn.commit()
        conn.close()

        # Print OTP to terminal so the developer can see it easily if needed,
        # but we also return it in simulated frontend mode for easy presentation.
        print(f"\n[TRUSTGUARD OTP] Code generated for user '{username}': {otp_code}\n")

        return jsonify({
            "action": "OTP",
            "username": username,
            "risk_score": score,
            "risk_level": level,
            "risk_factors": factors,
            "simulated_otp": otp_code, # Sent to frontend for seamless prototype demo
            "message": "OTP verification required."
        }), 200

    else:
        # Low Risk: Access Granted
        cursor.execute(
            "INSERT INTO login_logs (user_id, username, timestamp, ip_address, device_fingerprint, device_name, location_city, location_country, risk_score, risk_level, risk_factors, status) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (user_id, username, timestamp, ip_address, device_fingerprint, device_name, location_city, location_country, score, level, json.dumps(factors), "Success")
        )
        
        # Update last used device timestamp
        cursor.execute(
            "INSERT INTO trusted_devices (user_id, device_fingerprint, device_name, last_used_at) "
            "VALUES (?, ?, ?, ?) ON CONFLICT(user_id, device_fingerprint) DO UPDATE SET last_used_at=?",
            (user_id, device_fingerprint, device_name, timestamp, timestamp)
        )
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "action": "ACCESS",
            "user": {
                "id": user['id'],
                "username": user['username'],
                "mfa_enabled": bool(user['mfa_enabled'])
            },
            "risk_score": score,
            "risk_level": level,
            "risk_factors": factors,
            "message": "Authentication successful."
        }), 200

@app.route('/api/auth/verify-otp', methods=['POST'])
def verify_otp():
    data = request.json or {}
    username = data.get('username')
    code = data.get('otp')
    trust_device = data.get('trust_device', False)

    if not username or not code:
        return jsonify({"error": "Username and OTP are required"}), 400

    pending = pending_otps.get(username)
    if not pending:
        return jsonify({"error": "No pending login found or OTP expired"}), 400

    if datetime.now() > pending["expires_at"]:
        pending_otps.pop(username, None)
        return jsonify({"error": "OTP has expired. Please log in again."}), 400

    login_data = pending["login_data"]
    conn = get_db_connection()
    cursor = conn.cursor()

    if pending["otp"] == code:
        # Success verification
        cursor.execute(
            "INSERT INTO login_logs (user_id, username, timestamp, ip_address, device_fingerprint, device_name, location_city, location_country, risk_score, risk_level, risk_factors, status) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                login_data["user_id"],
                login_data["username"],
                datetime.now().isoformat(),
                login_data["ip_address"],
                login_data["device_fingerprint"],
                login_data["device_name"],
                login_data["location_city"],
                login_data["location_country"],
                login_data["risk_score"],
                login_data["risk_level"],
                json.dumps(login_data["risk_factors"]),
                "OTP_Verified"
            )
        )

        # If user selected to trust device
        if trust_device:
            cursor.execute(
                "INSERT INTO trusted_devices (user_id, device_fingerprint, device_name, last_used_at, is_trusted) "
                "VALUES (?, ?, ?, ?, 1) ON CONFLICT(user_id, device_fingerprint) DO UPDATE SET last_used_at=?, is_trusted=1",
                (login_data["user_id"], login_data["device_fingerprint"], login_data["device_name"], datetime.now().isoformat(), datetime.now().isoformat())
            )

        conn.commit()
        conn.close()
        pending_otps.pop(username, None)

        return jsonify({
            "action": "ACCESS",
            "user": {
                "id": login_data["user_id"],
                "username": login_data["username"]
            },
            "message": "OTP verification successful."
        }), 200
    else:
        # Failed verification
        cursor.execute(
            "INSERT INTO login_logs (user_id, username, timestamp, ip_address, device_fingerprint, device_name, location_city, location_country, risk_score, risk_level, risk_factors, status) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                login_data["user_id"],
                login_data["username"],
                datetime.now().isoformat(),
                login_data["ip_address"],
                login_data["device_fingerprint"],
                login_data["device_name"],
                login_data["location_city"],
                login_data["location_country"],
                login_data["risk_score"],
                login_data["risk_level"],
                json.dumps(login_data["risk_factors"]),
                "OTP_Failed"
            )
        )
        conn.commit()
        conn.close()

        return jsonify({"error": "Invalid OTP code."}), 400

# ----------------- DASHBOARD & ANALYTICS -----------------

@app.route('/api/dashboard/stats', methods=['GET'])
def get_stats():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Total Logins
    cursor.execute("SELECT COUNT(*) FROM login_logs")
    total_logins = cursor.fetchone()[0]

    # Successful logins
    cursor.execute("SELECT COUNT(*) FROM login_logs WHERE status IN ('Success', 'OTP_Verified')")
    successful_logins = cursor.fetchone()[0]

    # Blocked logins
    cursor.execute("SELECT COUNT(*) FROM login_logs WHERE status = 'Blocked'")
    blocked_logins = cursor.fetchone()[0]

    # High Risk attempts
    cursor.execute("SELECT COUNT(*) FROM login_logs WHERE risk_score >= 71")
    high_risk_attempts = cursor.fetchone()[0]

    # Risk Score Level Counts
    cursor.execute("SELECT risk_level, COUNT(*) FROM login_logs GROUP BY risk_level")
    levels_data = dict(cursor.fetchall())

    # Risk Score Distribution (by tens: 0-10, 11-20, etc.)
    cursor.execute("""
        SELECT (risk_score/10)*10 as bucket, COUNT(*) 
        FROM login_logs 
        GROUP BY bucket 
        ORDER BY bucket
    """)
    score_dist = {i*10: 0 for i in range(11)}
    for row in cursor.fetchall():
        bucket = row[0]
        if bucket is not None and bucket in score_dist:
            score_dist[bucket] = row[1]

    # Recent activity logs (last 15 items)
    cursor.execute("SELECT * FROM login_logs ORDER BY timestamp DESC LIMIT 15")
    logs = [dict(row) for row in cursor.fetchall()]
    for lg in logs:
        lg['risk_factors'] = json.loads(lg['risk_factors'])

    # Historical risk trend (last 7 days counts)
    cursor.execute("""
        SELECT date(timestamp) as date_val, 
               sum(case when status in ('Success', 'OTP_Verified') then 1 else 0 end) as success_cnt,
               sum(case when status = 'Blocked' then 1 else 0 end) as blocked_cnt,
               sum(case when status in ('OTP_Failed', 'OTP_Pending') then 1 else 0 end) as otp_cnt
        FROM login_logs
        GROUP BY date_val
        ORDER BY date_val DESC
        LIMIT 7
    """)
    trend_data = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return jsonify({
        "summary": {
            "total_logins": total_logins,
            "successful_logins": successful_logins,
            "blocked_logins": blocked_logins,
            "high_risk_attempts": high_risk_attempts
        },
        "risk_levels": {
            "Low": levels_data.get("Low", 0),
            "Medium": levels_data.get("Medium", 0),
            "High": levels_data.get("High", 0)
        },
        "score_distribution": score_dist,
        "recent_logs": logs,
        "trend": trend_data[::-1] # Reverse to chronological
    })

@app.route('/api/dashboard/logs', methods=['GET'])
def get_logs():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Optional filtering
    risk_level = request.args.get('risk_level')
    status = request.args.get('status')
    search = request.args.get('search')
    
    query = "SELECT * FROM login_logs WHERE 1=1"
    params = []
    
    if risk_level:
        query += " AND risk_level = ?"
        params.append(risk_level)
    if status:
        query += " AND status = ?"
        params.append(status)
    if search:
        query += " AND (username LIKE ? OR ip_address LIKE ? OR location_city LIKE ? OR location_country LIKE ?)"
        search_val = f"%{search}%"
        params.extend([search_val, search_val, search_val, search_val])
        
    query += " ORDER BY timestamp DESC"
    
    cursor.execute(query, params)
    logs = [dict(row) for row in cursor.fetchall()]
    for lg in logs:
        lg['risk_factors'] = json.loads(lg['risk_factors'])
        
    conn.close()
    return jsonify(logs)

@app.route('/api/dashboard/export-csv', methods=['GET'])
def export_csv():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM login_logs ORDER BY timestamp DESC")
    rows = cursor.fetchall()
    conn.close()

    si = StringIO()
    cw = csv.writer(si)
    cw.writerow(['ID', 'User ID', 'Username', 'Timestamp', 'IP Address', 'Device FP', 'Device Name', 'City', 'Country', 'Risk Score', 'Risk Level', 'Risk Factors', 'Status'])
    
    for row in rows:
        cw.writerow([
            row['id'], row['user_id'], row['username'], row['timestamp'],
            row['ip_address'], row['device_fingerprint'], row['device_name'],
            row['location_city'], row['location_country'], row['risk_score'],
            row['risk_level'], row['risk_factors'], row['status']
        ])
        
    output = make_response(si.getvalue())
    output.headers["Content-Disposition"] = "attachment; filename=trustguard_audit_logs.csv"
    output.headers["Content-type"] = "text/csv"
    return output

@app.route('/api/admin/devices', methods=['GET', 'POST'])
def manage_devices():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if request.method == 'GET':
        cursor.execute("""
            SELECT td.*, u.username 
            FROM trusted_devices td 
            JOIN users u ON td.user_id = u.id
            ORDER BY td.last_used_at DESC
        """)
        devices = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify(devices)
        
    elif request.method == 'POST':
        data = request.json or {}
        user_id = data.get('user_id')
        device_fingerprint = data.get('device_fingerprint')
        device_name = data.get('device_name')
        is_trusted = data.get('is_trusted', 1)
        
        if not user_id or not device_fingerprint or not device_name:
            conn.close()
            return jsonify({"error": "Missing parameters"}), 400
            
        cursor.execute("""
            INSERT INTO trusted_devices (user_id, device_fingerprint, device_name, last_used_at, is_trusted)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, device_fingerprint) 
            DO UPDATE SET last_used_at=?, is_trusted=?, device_name=?
        """, (user_id, device_fingerprint, device_name, datetime.now().isoformat(), is_trusted, datetime.now().isoformat(), is_trusted, device_name))
        
        conn.commit()
        conn.close()
        return jsonify({"message": "Device configuration saved successfully."})

@app.route('/api/admin/devices/<int:device_id>', methods=['DELETE', 'PUT'])
def update_delete_device(device_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if request.method == 'DELETE':
        cursor.execute("DELETE FROM trusted_devices WHERE id = ?", (device_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Device deleted successfully."})
        
    elif request.method == 'PUT':
        data = request.json or {}
        is_trusted = data.get('is_trusted', 1)
        cursor.execute("UPDATE trusted_devices SET is_trusted = ? WHERE id = ?", (is_trusted, device_id))
        conn.commit()
        conn.close()
        return jsonify({"message": "Device status updated."})

@app.route('/api/admin/recommendations', methods=['GET'])
def get_recommendations():
    """
    Simulates an AI analysis run over the logs. Returns contextual security tips.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Query metrics
    cursor.execute("SELECT username, COUNT(*) FROM login_logs WHERE status = 'Blocked' GROUP BY username HAVING COUNT(*) >= 2")
    blocked_users = cursor.fetchall()

    cursor.execute("SELECT device_fingerprint, device_name, COUNT(*) FROM login_logs WHERE status = 'Blocked' GROUP BY device_fingerprint HAVING COUNT(*) >= 2")
    bad_devices = cursor.fetchall()

    cursor.execute("SELECT u.username FROM users u LEFT JOIN trusted_devices td ON u.id = td.user_id GROUP BY u.username HAVING COUNT(td.id) = 0")
    no_device_users = cursor.fetchall()

    conn.close()

    recommendations = []

    # 1. Enforce MFA if multiple blocked logins
    for user in blocked_users:
        recommendations.append({
            "id": f"rec_mfa_{user[0]}",
            "type": "WARNING",
            "title": f"Enforce MFA for '{user[0]}'",
            "description": f"User '{user[0]}' has encountered {user[1]} blocked login attempts. We recommend enforcing hardware-based MFA immediately to prevent account takeover.",
            "action": "Enable Strict MFA"
        })

    # 2. Block suspicious devices
    for dev in bad_devices:
        recommendations.append({
            "id": f"rec_block_device_{dev[0]}",
            "type": "CRITICAL",
            "title": f"Revoke Device: {dev[1]}",
            "description": f"Device fingerprint '{dev[0]}' ('{dev[1]}') has been associated with {dev[2]} blocked login attempts across the network. Consider adding this device to the global blacklist.",
            "action": "Blacklist Device"
        })

    # 3. Request trusted device registration
    for user in no_device_users:
        recommendations.append({
            "id": f"rec_trust_{user[0]}",
            "type": "INFO",
            "title": f"Register Trusted Device for '{user[0]}'",
            "description": f"User '{user[0]}' does not have any registered trusted devices. Prompt them to complete trust verification on their primary logging machine.",
            "action": "Prompt Registration"
        })

    # Fallbacks if database has standard logins
    if not recommendations:
        recommendations.append({
            "id": "rec_default_mfa",
            "type": "INFO",
            "title": "Establish Baseline MFA Policies",
            "description": "Ensure all administrative accounts require Multi-Factor Authentication. Currently, 2 out of 5 users do not have MFA turned on.",
            "action": "Review Policies"
        })
        recommendations.append({
            "id": "rec_default_logs",
            "type": "INFO",
            "title": "Review Out-of-hours Activity",
            "description": "Audit shows occasional logins between 11 PM and 5 AM. Monitor these time patterns for anomalous shifts.",
            "action": "Audit Time Log"
        })

    return jsonify(recommendations)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
