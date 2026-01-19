import React, { useState } from 'react';
import axios from 'axios';

const API_URL = `http://${window.location.hostname}:5000`;

export default function Login({ onLogin }) {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(`${API_URL}/api/auth/login`, { identifier, password });
            onLogin(res.data);
        } catch (err) {
            setError('Invalid Credentials');
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        }}>
            <div style={{ 
                width: '100%',
                maxWidth: '420px', 
                margin: '20px',
                padding: '40px', 
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)', 
                borderRadius: '12px', 
                background: 'white',
                border: '1px solid #e2e8f0'
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        margin: '0 auto 16px',
                        background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '32px'
                    }}>
                        🔐
                    </div>
                    <h2 style={{ 
                        margin: '0 0 8px 0',
                        color: '#1a202c',
                        fontSize: '24px',
                        fontWeight: '600'
                    }}>
                        Welcome to LanHub
                    </h2>
                    <p style={{
                        margin: 0,
                        color: '#718096',
                        fontSize: '14px'
                    }}>
                        Sign in to your account
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ 
                            display: 'block', 
                            marginBottom: '8px', 
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#4a5568'
                        }}>
                            Username or Email
                        </label>
                        <input 
                            value={identifier} 
                            onChange={e => setIdentifier(e.target.value)} 
                            style={{ 
                                width: '100%', 
                                padding: '12px 14px', 
                                borderRadius: '8px', 
                                border: '1px solid #cbd5e0',
                                fontSize: '14px',
                                boxSizing: 'border-box',
                                transition: 'border-color 0.2s, box-shadow 0.2s',
                                outline: 'none'
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = '#2563eb';
                                e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = '#cbd5e0';
                                e.target.style.boxShadow = 'none';
                            }}
                            required 
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ 
                            display: 'block', 
                            marginBottom: '8px', 
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#4a5568'
                        }}>
                            Password
                        </label>
                        <input 
                            type="password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            style={{ 
                                width: '100%', 
                                padding: '12px 14px', 
                                borderRadius: '8px', 
                                border: '1px solid #cbd5e0',
                                fontSize: '14px',
                                boxSizing: 'border-box',
                                transition: 'border-color 0.2s, box-shadow 0.2s',
                                outline: 'none'
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = '#2563eb';
                                e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = '#cbd5e0';
                                e.target.style.boxShadow = 'none';
                            }}
                            required 
                        />
                    </div>

                    <button 
                        type="submit" 
                        style={{ 
                            width: '100%', 
                            padding: '12px', 
                            background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '8px', 
                            fontWeight: '600',
                            fontSize: '14px',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(30, 64, 175, 0.3)',
                            transition: 'transform 0.1s, box-shadow 0.1s'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.transform = 'translateY(-1px)';
                            e.target.style.boxShadow = '0 4px 8px rgba(30, 64, 175, 0.4)';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 2px 4px rgba(30, 64, 175, 0.3)';
                        }}
                    >
                        Sign In
                    </button>
                </form>

                {/* Error Message */}
                {error && (
                    <div style={{
                        marginTop: '20px',
                        padding: '12px',
                        background: '#fee',
                        border: '1px solid #fcc',
                        borderRadius: '8px',
                        color: '#c53030',
                        fontSize: '14px',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                {/* Footer */}
                <div style={{
                    marginTop: '24px',
                    paddingTop: '24px',
                    borderTop: '1px solid #e2e8f0',
                    textAlign: 'center'
                }}>
                    <p style={{
                        margin: 0,
                        fontSize: '12px',
                        color: '#a0aec0'
                    }}>
                        Secured by LanHub Authentication
                    </p>
                </div>
            </div>
        </div>
    );
}