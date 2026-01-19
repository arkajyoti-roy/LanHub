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
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(to bottom, #f7fafc 0%, #edf2f7 100%)',
            paddingBottom: '50px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        }}>
            {/* Header */}
            <div style={{
                background: 'white',
                padding: '16px 32px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                borderBottom: '1px solid #e2e8f0',
                position: 'sticky',
                top: 0,
                zIndex: 100
            }}>
                <div style={{
                    maxWidth: '1400px',
                    margin: '0 auto',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    {/* Logo/Brand */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            background: 'linear-gradient(135deg, #bfc6da 0%, #9aa6c9 100%)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px'
                        }}>
                            L
                        </div>
                        <h2 style={{
                            margin: 0,
                            color: '#1a202c',
                            fontSize: '20px',
                            fontWeight: '600'
                        }}>
                            LanHub
                        </h2>
                    </div>

                    {/* User Info & Actions */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px'
                    }}>
                        {/* User Badge */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '8px 16px',
                            background: '#f7fafc',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0'
                        }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: '600',
                                fontSize: '14px'
                            }}>
                                {auth.username.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{
                                    fontSize: '11px',
                                    color: '#718096',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    fontWeight: '500'
                                }}>
                                    {auth.role}
                                </div>
                                <div style={{
                                    color: '#2d3748',
                                    fontSize: '14px',
                                    fontWeight: '600'
                                }}>
                                    {auth.username}
                                </div>
                            </div>
                        </div>

                        {/* Logout Button */}
                        <button
                            onClick={handleLogout}
                            style={{
                                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                                color: 'white',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                fontSize: '14px',
                                boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)',
                                transition: 'transform 0.1s, box-shadow 0.1s'
                            }}
                            onMouseOver={(e) => {
                                e.target.style.transform = 'translateY(-1px)';
                                e.target.style.boxShadow = '0 4px 8px rgba(220, 38, 38, 0.4)';
                            }}
                            onMouseOut={(e) => {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 2px 4px rgba(220, 38, 38, 0.3)';
                            }}
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div style={{
                maxWidth: '1400px',
                margin: '0 auto',
                padding: '24px 32px'
            }}>
                {/* Admin Panel (Only for Admins) */}
                {auth.role === 'admin' && <AdminDashboard token={auth.token} />}
                
                {/* Main Transfer App */}
                <FileTransfer authData={auth} />
            </div>
        </div>
    );
}