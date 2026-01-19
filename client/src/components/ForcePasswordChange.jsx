import React, { useState } from 'react';
import axios from 'axios';

const API_URL = `http://${window.location.hostname}:5000`;

export default function ForcePasswordChange({ token, onPasswordChanged }) {
    const [newPassword, setNewPassword] = useState('');
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/api/auth/change-password`, 
                { newPassword }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert("Success! Please login with your new password.");
            onPasswordChanged();
        } catch (err) {
            alert("Error updating password.");
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            padding: '20px'
        }}>
            <div style={{ 
                width: '100%',
                maxWidth: '480px',
                padding: '40px',
                border: '1px solid #fbbf24',
                borderRadius: '12px',
                background: 'white',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
            }}>
                {/* Alert Icon */}
                <div style={{
                    width: '64px',
                    height: '64px',
                    margin: '0 auto 20px',
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px'
                }}>
                    ⚠️
                </div>

                {/* Header */}
                <h3 style={{
                    color: '#1a202c',
                    marginTop: 0,
                    marginBottom: '12px',
                    fontSize: '22px',
                    fontWeight: '600',
                    textAlign: 'center'
                }}>
                    Action Required
                </h3>

                {/* Description */}
                <div style={{
                    padding: '16px',
                    background: '#fffbeb',
                    border: '1px solid #fef3c7',
                    borderRadius: '8px',
                    marginBottom: '24px'
                }}>
                    <p style={{
                        color: '#92400e',
                        margin: 0,
                        fontSize: '14px',
                        lineHeight: '1.6'
                    }}>
                        This is your first login. For security, you must create a new password before continuing.
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
                            New Password
                        </label>
                        <input 
                            type="password" 
                            placeholder="Enter new password (min 6 characters)" 
                            value={newPassword} 
                            onChange={e => setNewPassword(e.target.value)} 
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
                                e.target.style.borderColor = '#fbbf24';
                                e.target.style.boxShadow = '0 0 0 3px rgba(251, 191, 36, 0.1)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = '#cbd5e0';
                                e.target.style.boxShadow = 'none';
                            }}
                            required 
                            minLength={6} 
                        />
                        <p style={{
                            margin: '6px 0 0 0',
                            fontSize: '12px',
                            color: '#718096'
                        }}>
                            Password must be at least 6 characters long
                        </p>
                    </div>

                    <button 
                        type="submit" 
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            boxShadow: '0 2px 4px rgba(251, 191, 36, 0.3)',
                            transition: 'transform 0.1s, box-shadow 0.1s'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.transform = 'translateY(-1px)';
                            e.target.style.boxShadow = '0 4px 8px rgba(251, 191, 36, 0.4)';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 2px 4px rgba(251, 191, 36, 0.3)';
                        }}
                    >
                        Update Password & Continue
                    </button>
                </form>

                {/* Security Note */}
                <div style={{
                    marginTop: '24px',
                    paddingTop: '20px',
                    borderTop: '1px solid #e2e8f0',
                    textAlign: 'center'
                }}>
                    <p style={{
                        margin: 0,
                        fontSize: '12px',
                        color: '#a0aec0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                    }}>
                        <span>🔒</span>
                        Your password will be encrypted and stored securely
                    </p>
                </div>
            </div>
        </div>
    );
}