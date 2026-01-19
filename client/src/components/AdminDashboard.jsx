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
        <div style={{ 
            maxWidth: '1200px', 
            margin: '0 auto', 
            padding: '24px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        }}>
            {/* Header */}
            <div style={{ 
                background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                padding: '32px',
                borderRadius: '12px',
                marginBottom: '24px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.07)'
            }}>
                <h2 style={{ 
                    margin: 0,
                    color: 'white',
                    fontSize: '28px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <span style={{ fontSize: '32px' }}>👑</span>
                    LanHub Admin Dashboard
                </h2>
                <p style={{ 
                    margin: '8px 0 0 0',
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: '14px'
                }}>
                    Manage users and permissions
                </p>
            </div>

            {/* Create User Card */}
            <div style={{ 
                background: 'white',
                padding: '24px',
                borderRadius: '12px',
                marginBottom: '24px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                border: '1px solid #e2e8f0'
            }}>
                <h3 style={{ 
                    margin: '0 0 20px 0',
                    color: '#2d3748',
                    fontSize: '18px',
                    fontWeight: '600'
                }}>
                    Create New User
                </h3>
                <form onSubmit={createUser}>
                    <div style={{ 
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '12px',
                        marginBottom: '16px'
                    }}>
                        <div>
                            <label style={{ 
                                display: 'block',
                                marginBottom: '6px',
                                fontSize: '13px',
                                fontWeight: '500',
                                color: '#4a5568'
                            }}>
                                Username
                            </label>
                            <input 
                                placeholder="Enter username" 
                                value={newUsername} 
                                onChange={e => setNewUsername(e.target.value)} 
                                required 
                                style={{ 
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e0',
                                    fontSize: '14px',
                                    boxSizing: 'border-box',
                                    transition: 'border-color 0.2s',
                                    outline: 'none'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                                onBlur={(e) => e.target.style.borderColor = '#cbd5e0'}
                            />
                        </div>
                        <div>
                            <label style={{ 
                                display: 'block',
                                marginBottom: '6px',
                                fontSize: '13px',
                                fontWeight: '500',
                                color: '#4a5568'
                            }}>
                                Email
                            </label>
                            <input 
                                type="email" 
                                placeholder="Enter email" 
                                value={newEmail} 
                                onChange={e => setNewEmail(e.target.value)} 
                                required 
                                style={{ 
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e0',
                                    fontSize: '14px',
                                    boxSizing: 'border-box',
                                    transition: 'border-color 0.2s',
                                    outline: 'none'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                                onBlur={(e) => e.target.style.borderColor = '#cbd5e0'}
                            />
                        </div>
                        <div>
                            <label style={{ 
                                display: 'block',
                                marginBottom: '6px',
                                fontSize: '13px',
                                fontWeight: '500',
                                color: '#4a5568'
                            }}>
                                Role
                            </label>
                            <select 
                                value={newRole} 
                                onChange={e => setNewRole(e.target.value)} 
                                style={{ 
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e0',
                                    fontSize: '14px',
                                    boxSizing: 'border-box',
                                    backgroundColor: 'white',
                                    cursor: 'pointer',
                                    outline: 'none'
                                }}
                            >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                    </div>
                    <button 
                        type="submit" 
                        style={{ 
                            background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '14px',
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
                        + Add User
                    </button>
                </form>
            </div>

            {/* Users List Card */}
            <div style={{ 
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                border: '1px solid #e2e8f0',
                overflow: 'hidden'
            }}>
                <div style={{ 
                    padding: '20px 24px',
                    borderBottom: '1px solid #e2e8f0'
                }}>
                    <h3 style={{ 
                        margin: 0,
                        color: '#2d3748',
                        fontSize: '18px',
                        fontWeight: '600'
                    }}>
                        Users ({users.length})
                    </h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ 
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '14px'
                    }}>
                        <thead>
                            <tr style={{ 
                                background: '#f7fafc',
                                borderBottom: '2px solid #e2e8f0'
                            }}>
                                <th style={{ 
                                    padding: '14px 24px',
                                    textAlign: 'left',
                                    fontWeight: '600',
                                    color: '#4a5568',
                                    fontSize: '13px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>Username</th>
                                <th style={{ 
                                    padding: '14px 24px',
                                    textAlign: 'left',
                                    fontWeight: '600',
                                    color: '#4a5568',
                                    fontSize: '13px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>Email</th>
                                <th style={{ 
                                    padding: '14px 24px',
                                    textAlign: 'left',
                                    fontWeight: '600',
                                    color: '#4a5568',
                                    fontSize: '13px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>Role</th>
                                <th style={{ 
                                    padding: '14px 24px',
                                    textAlign: 'left',
                                    fontWeight: '600',
                                    color: '#4a5568',
                                    fontSize: '13px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>Status</th>
                                <th style={{ 
                                    padding: '14px 24px',
                                    textAlign: 'left',
                                    fontWeight: '600',
                                    color: '#4a5568',
                                    fontSize: '13px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr 
                                    key={u._id} 
                                    style={{ 
                                        borderBottom: '1px solid #e2e8f0',
                                        transition: 'background-color 0.15s'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f7fafc'}
                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    <td style={{ 
                                        padding: '16px 24px',
                                        fontWeight: '600',
                                        color: '#2d3748'
                                    }}>{u.username}</td>
                                    <td style={{ 
                                        padding: '16px 24px',
                                        color: '#718096'
                                    }}>{u.email}</td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <span style={{ 
                                            background: u.role === 'admin' ? '#e9d8fd' : '#c6f6d5',
                                            color: u.role === 'admin' ? '#553c9a' : '#22543d',
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.3px'
                                        }}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        {u.isFirstLogin ? (
                                            <span style={{ 
                                                color: '#d69e2e',
                                                fontSize: '13px',
                                                fontWeight: '500',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}>
                                                <span>⚠️</span> Pending Reset
                                            </span>
                                        ) : (
                                            <span style={{ 
                                                color: '#38a169',
                                                fontSize: '13px',
                                                fontWeight: '500',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}>
                                                <span>✅</span> Active
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        {u.username !== 'admin' && (
                                            <button 
                                                onClick={() => deleteUser(u._id)} 
                                                style={{ 
                                                    color: '#e53e3e',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontWeight: '600',
                                                    fontSize: '13px',
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    transition: 'background-color 0.15s'
                                                }}
                                                onMouseOver={(e) => e.target.style.backgroundColor = '#fed7d7'}
                                                onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}