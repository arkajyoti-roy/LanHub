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
        <div style={{ maxWidth: '350px', margin: '100px auto', padding: '30px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', borderRadius: '8px', background: 'white' }}>
            <h2 style={{ textAlign: 'center', color: '#2d3748' }}>🔐 Secure Login</h2>
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em', color: '#4a5568' }}>Username or Email</label>
                    <input 
                        value={identifier} 
                        onChange={e => setIdentifier(e.target.value)} 
                        style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #cbd5e0' }} 
                        required 
                    />
                </div>
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em', color: '#4a5568' }}>Password</label>
                    <input 
                        type="password" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #cbd5e0' }} 
                        required 
                    />
                </div>
                <button type="submit" style={{ width: '100%', padding: '12px', background: '#3182ce', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Login</button>
            </form>
            {error && <p style={{ color: '#e53e3e', textAlign: 'center', marginTop: '15px' }}>{error}</p>}
        </div>
    );
}