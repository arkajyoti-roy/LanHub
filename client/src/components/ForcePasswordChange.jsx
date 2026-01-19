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
        <div style={{ maxWidth: '400px', margin: '100px auto', padding: '30px', border: '1px solid #ed8936', borderRadius: '8px', background: '#fffaf0' }}>
            <h3 style={{ color: '#c05621', marginTop: 0 }}>⚠️ Action Required</h3>
            <p style={{ color: '#7b341e' }}>This is your first login. For security, you must create a new password.</p>
            <form onSubmit={handleSubmit}>
                <input 
                    type="password" 
                    placeholder="New Password (min 6 chars)" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '5px', border: '1px solid #cbd5e0' }} 
                    required 
                    minLength={6} 
                />
                <button type="submit" style={{ width: '100%', padding: '10px', background: '#dd6b20', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Update Password</button>
            </form>
        </div>
    );
}