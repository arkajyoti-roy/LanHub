import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = `http://${window.location.hostname}:5000`;

export default function AdminDashboard({ token }) {
    const [users, setUsers] = useState([]);
    const [newUsername, setNewUsername] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState('user');

    useEffect(() => { fetchUsers(); }, []);

    const fetchUsers = async () => {
        const res = await axios.get(`${API_URL}/api/users`, { headers: { Authorization: `Bearer ${token}` } });
        setUsers(res.data);
    };

    const createUser = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/api/users`, 
                { username: newUsername, email: newEmail, role: newRole }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setNewUsername(''); setNewEmail(''); fetchUsers();
        } catch (err) { alert("Failed. Username or Email might be taken."); }
    };

    const deleteUser = async (id) => {
        if (!window.confirm("Delete this user?")) return;
        await axios.delete(`${API_URL}/api/users/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        fetchUsers();
    };

    return (
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
            <h3 style={{ borderBottom: '2px solid #3182ce', paddingBottom: '10px', color: '#2c5282' }}>👑 Admin Dashboard</h3>
            
            {/* Create Form */}
            <div style={{ background: '#ebf8ff', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#2b6cb0' }}>Create New User</h4>
                <form onSubmit={createUser} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <input placeholder="Username" value={newUsername} onChange={e => setNewUsername(e.target.value)} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e0', flex: 1 }} />
                    <input type="email" placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e0', flex: 1 }} />
                    <select value={newRole} onChange={e => setNewRole(e.target.value)} style={{ padding: '8px', borderRadius: '4px' }}>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                    </select>
                    <button type="submit" style={{ background: '#48bb78', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Add User</button>
                </form>
            </div>

            {/* User Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                <thead>
                    <tr style={{ background: '#edf2f7', textAlign: 'left' }}>
                        <th style={{ padding: '10px' }}>Username</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(u => (
                        <tr key={u._id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{u.username}</td>
                            <td style={{ color: '#718096' }}>{u.email}</td>
                            <td><span style={{ background: u.role === 'admin' ? '#e9d8fd' : '#c6f6d5', color: u.role === 'admin' ? '#553c9a' : '#22543d', padding: '2px 8px', borderRadius: '10px', fontSize: '0.85em' }}>{u.role.toUpperCase()}</span></td>
                            <td>{u.isFirstLogin ? <span style={{ color: '#d69e2e' }}>⚠️ Pending Reset</span> : <span style={{ color: '#38a169' }}>✅ Active</span>}</td>
                            <td>
                                {u.username !== 'admin' && (
                                    <button onClick={() => deleteUser(u._id)} style={{ color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Delete</button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}