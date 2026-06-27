import sqlite3
import os
import hashlib
from datetime import datetime, timedelta
import json

DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def seed_db():
    print(f"Connecting to database at: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Drop tables if they exist to start fresh
    cursor.execute("DROP TABLE IF EXISTS login_logs")
    cursor.execute("DROP TABLE IF EXISTS trusted_devices")
    cursor.execute("DROP TABLE IF EXISTS users")

    # Create users table
    cursor.execute("""
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        mfa_enabled INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    )
    """)

    # Create trusted_devices table
    cursor.execute("""
    CREATE TABLE trusted_devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        device_fingerprint TEXT NOT NULL,
        device_name TEXT NOT NULL,
        is_trusted INTEGER DEFAULT 1,
        last_used_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, device_fingerprint)
    )
    """)

    # Create login_logs table
    cursor.execute("""
    CREATE TABLE login_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        device_fingerprint TEXT NOT NULL,
        device_name TEXT NOT NULL,
        location_city TEXT NOT NULL,
        location_country TEXT NOT NULL,
        risk_score INTEGER NOT NULL,
        risk_level TEXT NOT NULL,
        risk_factors TEXT NOT NULL, -- JSON string list of flags
        status TEXT NOT NULL -- 'Success', 'Blocked', 'OTP_Pending', 'OTP_Verified', 'OTP_Failed'
    )
    """)

    # 1. Create 5 users
    users_data = [
        ("admin", "admin123", 1),
        ("alice", "alice123", 0),
        ("bob", "bob123", 1),
        ("charlie", "charlie123", 0),
        ("diana", "diana123", 0)
    ]

    inserted_users = {}
    for username, password, mfa in users_data:
        pwd_hash = hash_password(password)
        created_at = (datetime.now() - timedelta(days=30)).isoformat()
        cursor.execute(
            "INSERT INTO users (username, password_hash, mfa_enabled, created_at) VALUES (?, ?, ?, ?)",
            (username, pwd_hash, mfa, created_at)
        )
        inserted_users[username] = cursor.lastrowid

    # 2. Create trusted devices
    devices_data = [
        (inserted_users["admin"], "fp_admin_mac", "MacBook Pro (Chrome/macOS)"),
        (inserted_users["alice"], "fp_alice_iphone", "iPhone 15 (Safari/iOS)"),
        (inserted_users["alice"], "fp_alice_dell", "Dell XPS (Chrome/Windows)"),
        (inserted_users["bob"], "fp_bob_thinkpad", "ThinkPad T14 (Firefox/Linux)"),
        (inserted_users["charlie"], "fp_charlie_pixel", "Pixel 8 Pro (Chrome/Android)"),
        (inserted_users["diana"], "fp_diana_ipad", "iPad Pro (Safari/iOS)")
    ]

    for user_id, fp, name in devices_data:
        last_used = (datetime.now() - timedelta(hours=5)).isoformat()
        cursor.execute(
            "INSERT INTO trusted_devices (user_id, device_fingerprint, device_name, last_used_at) VALUES (?, ?, ?, ?)",
            (user_id, fp, name, last_used)
        )

    # 3. Create 25 realistic historical login logs over the past week
    # Columns: user_id, username, timestamp, ip, fp, device_name, city, country, score, level, factors, status
    base_time = datetime.now() - timedelta(days=7)
    
    logs = [
        # Alice standard logins (Low Risk)
        (inserted_users["alice"], "alice", base_time + timedelta(hours=2), "198.51.100.12", "fp_alice_iphone", "iPhone 15 (Safari/iOS)", "New York", "USA", 10, "Low", ["device_trusted", "known_location"], "Success"),
        (inserted_users["alice"], "alice", base_time + timedelta(hours=14), "198.51.100.12", "fp_alice_iphone", "iPhone 15 (Safari/iOS)", "New York", "USA", 10, "Low", ["device_trusted", "known_location"], "Success"),
        
        # Bob standard logins (Low Risk but MFA enabled, so Success after OTP)
        (inserted_users["bob"], "bob", base_time + timedelta(hours=3), "203.0.113.45", "fp_bob_thinkpad", "ThinkPad T14 (Firefox/Linux)", "London", "UK", 15, "Low", ["device_trusted", "known_location"], "Success"),
        
        # Charlie standard logins
        (inserted_users["charlie"], "charlie", base_time + timedelta(hours=5), "185.190.140.23", "fp_charlie_pixel", "Pixel 8 Pro (Chrome/Android)", "Paris", "France", 10, "Low", ["device_trusted", "known_location"], "Success"),
        
        # Admin standard logins
        (inserted_users["admin"], "admin", base_time + timedelta(days=1), "192.168.1.50", "fp_admin_mac", "MacBook Pro (Chrome/macOS)", "San Francisco", "USA", 10, "Low", ["device_trusted", "known_location"], "Success"),
        
        # Scenario 1: Unknown device for Alice -> Medium Risk (OTP verified successfully)
        (inserted_users["alice"], "alice", base_time + timedelta(days=1, hours=4), "198.51.100.15", "fp_alice_unknown_safari", "Safari (macOS)", "New York", "USA", 45, "Medium", ["new_device"], "OTP_Verified"),
        
        # Scenario 2: Suspicious login from Moscow for Bob -> High Risk (Blocked)
        (inserted_users["bob"], "bob", base_time + timedelta(days=1, hours=8), "95.108.174.12", "fp_hacker_chrome", "Chrome (Windows)", "Moscow", "Russia", 85, "High", ["new_device", "unusual_location", "impossible_travel"], "Blocked"),
        
        # Scenario 3: Diana login (unusual location, medium risk -> OTP fails)
        (inserted_users["diana"], "diana", base_time + timedelta(days=2, hours=10), "77.111.246.5", "fp_diana_ipad", "iPad Pro (Safari/iOS)", "Berlin", "Germany", 40, "Medium", ["unusual_location"], "OTP_Failed"),
        
        # Scenario 4: Multiple failed login attempts leading to block
        (None, "alice", base_time + timedelta(days=3, hours=1), "198.51.100.20", "fp_attacker_device", "Chrome (Linux)", "New York", "USA", 35, "Medium", ["new_device", "failed_password_attempt"], "OTP_Pending"),
        (inserted_users["alice"], "alice", base_time + timedelta(days=3, hours=1, minutes=2), "198.51.100.20", "fp_attacker_device", "Chrome (Linux)", "New York", "USA", 55, "Medium", ["new_device", "multiple_failed_attempts"], "OTP_Failed"),
        (inserted_users["alice"], "alice", base_time + timedelta(days=3, hours=1, minutes=4), "198.51.100.20", "fp_attacker_device", "Chrome (Linux)", "New York", "USA", 75, "High", ["new_device", "multiple_failed_attempts", "brute_force_detected"], "Blocked"),

        # Charlie travels to Tokyo (Unusual location -> Medium Risk -> OTP verified)
        (inserted_users["charlie"], "charlie", base_time + timedelta(days=4, hours=6), "210.140.10.33", "fp_charlie_pixel", "Pixel 8 Pro (Chrome/Android)", "Tokyo", "Japan", 40, "Medium", ["unusual_location"], "OTP_Verified"),
        (inserted_users["charlie"], "charlie", base_time + timedelta(days=4, hours=12), "210.140.10.33", "fp_charlie_pixel", "Pixel 8 Pro (Chrome/Android)", "Tokyo", "Japan", 10, "Low", ["device_trusted", "known_location"], "Success"),

        # Alice logs in normally
        (inserted_users["alice"], "alice", base_time + timedelta(days=4, hours=18), "198.51.100.12", "fp_alice_iphone", "iPhone 15 (Safari/iOS)", "New York", "USA", 10, "Low", ["device_trusted", "known_location"], "Success"),

        # Diana logs in normally from Paris (unusual location but trusted device -> OTP verified)
        (inserted_users["diana"], "diana", base_time + timedelta(days=5, hours=2), "82.120.10.4", "fp_diana_ipad", "iPad Pro (Safari/iOS)", "Paris", "France", 40, "Medium", ["unusual_location"], "OTP_Verified"),

        # Failed logins from hacker on admin account (High Risk -> Blocked)
        (inserted_users["admin"], "admin", base_time + timedelta(days=5, hours=9), "185.220.101.44", "fp_tor_browser", "Firefox (Linux)", "Reykjavik", "Iceland", 95, "High", ["new_device", "unusual_location", "unusual_time", "mfa_bypass_attempt"], "Blocked"),

        # More low/medium logs to round out stats
        (inserted_users["alice"], "alice", base_time + timedelta(days=5, hours=22), "198.51.100.12", "fp_alice_dell", "Dell XPS (Chrome/Windows)", "New York", "USA", 10, "Low", ["device_trusted", "known_location"], "Success"),
        (inserted_users["bob"], "bob", base_time + timedelta(days=6, hours=1), "203.0.113.45", "fp_bob_thinkpad", "ThinkPad T14 (Firefox/Linux)", "London", "UK", 15, "Low", ["device_trusted", "known_location"], "Success"),
        (inserted_users["charlie"], "charlie", base_time + timedelta(days=6, hours=14), "185.190.140.23", "fp_charlie_pixel", "Pixel 8 Pro (Chrome/Android)", "Paris", "France", 10, "Low", ["device_trusted", "known_location"], "Success"),
        
        # Unusual time login for Bob (Medium Risk -> verified via OTP)
        (inserted_users["bob"], "bob", base_time + timedelta(days=6, hours=23, minutes=30), "203.0.113.45", "fp_bob_thinkpad", "ThinkPad T14 (Firefox/Linux)", "London", "UK", 35, "Medium", ["unusual_time"], "OTP_Verified"),
        
        # New Device for Diana (Medium Risk -> Verified)
        (inserted_users["diana"], "diana", base_time + timedelta(days=7, hours=1), "82.120.10.4", "fp_diana_laptop", "MacBook Air (Chrome/macOS)", "Paris", "France", 45, "Medium", ["new_device"], "OTP_Verified"),
        
        # Real-time simulation demo data (recently failed attempt)
        (None, "diana", base_time + timedelta(days=7, hours=3), "82.120.10.4", "fp_diana_unknown", "Chrome (Windows)", "Paris", "France", 45, "Medium", ["new_device"], "OTP_Failed"),
    ]

    for uid, name, ts, ip, fp, dname, city, country, score, level, factors, status in logs:
        factors_json = json.dumps(factors)
        cursor.execute("""
        INSERT INTO login_logs (user_id, username, timestamp, ip_address, device_fingerprint, device_name, location_city, location_country, risk_score, risk_level, risk_factors, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (uid, name, ts.isoformat(), ip, fp, dname, city, country, score, level, factors_json, status))

    conn.commit()
    conn.close()
    print("Database seeded successfully!")

if __name__ == "__main__":
    seed_db()
