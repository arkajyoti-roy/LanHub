import React, { useEffect, useState } from 'react';
import Login from './components/Login';
import ForcePasswordChange from './components/ForcePasswordChange';
import AdminDashboard from './components/AdminDashboard';
import FileTransfer from './components/FileTransfer';

export default function App() {
    const [auth, setAuth] = useState(null);

    // Load auth from local storage on startup
    useEffect(() => {
        const stored = localStorage.getItem('auth');
        if (stored) setAuth(JSON.parse(stored));
    }, []);

    const handleLogin = (data) => {
        setAuth(data);
        localStorage.setItem('auth', JSON.stringify(data));
    };

    const handleLogout = () => {
        setAuth(null);
        localStorage.removeItem('auth');
    };

    const handlePasswordReset = () => {
        alert("Password updated successfully. Please login again.");
        handleLogout();
    };

    // 1. Not Logged In
    if (!auth) {
        return <Login onLogin={handleLogin} />;
    }

    // 2. First Time Login (Force Change)
    if (auth.isFirstLogin) {
        return <ForcePasswordChange token={auth.token} onPasswordChanged={handlePasswordReset} />;
    }

    // 3. Authenticated App
    return (
        <div style={{ minHeight: '100vh', background: '#f7fafc', paddingBottom: '50px' }}>
            {/* Header */}
            <div style={{ background: 'white', padding: '15px 30px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, color: '#2d3748' }}>🚀 LAN Share Pro</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{textAlign:'right'}}>
                        <span style={{ display:'block', color: '#4a5568', fontSize:'0.9em' }}>Logged in as</span>
                        <strong style={{color:'#2d3748'}}>{auth.username}</strong>
                    </div>
                    <button onClick={handleLogout} style={{ background: '#e53e3e', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight:'bold' }}>Logout</button>
                </div>
            </div>

            <div style={{ padding: '20px' }}>
                {/* Admin Panel (Only for Admins) */}
                {auth.role === 'admin' && <AdminDashboard token={auth.token} />}
                
                {/* Main Transfer App */}
                <FileTransfer authData={auth} />
            </div>
        </div>
    );
}