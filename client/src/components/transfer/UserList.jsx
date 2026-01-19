import React, { memo } from 'react';

const UserItem = memo(({ id, name, isSelected, onToggle }) => (
    <div 
        onClick={() => onToggle(id)} 
        style={{ 
            padding: '12px 16px',
            cursor: 'pointer', 
            background: isSelected ? '#eff6ff' : 'transparent', 
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            transition: 'background-color 0.15s',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        }}
        onMouseOver={(e) => {
            if (!isSelected) {
                e.currentTarget.style.backgroundColor = '#f7fafc';
            }
        }}
        onMouseOut={(e) => {
            if (!isSelected) {
                e.currentTarget.style.backgroundColor = 'transparent';
            }
        }}
    >
        <div style={{
            width: '18px',
            height: '18px',
            borderRadius: '4px', 
            border: isSelected ? '2px solid #1e40af' : '2px solid #cbd5e0',
            marginRight: '12px', 
            background: isSelected ? '#1e40af' : 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '11px',
            fontWeight: 'bold',
            transition: 'all 0.15s',
            flexShrink: 0
        }}>
            {isSelected && '✓'}
        </div>
        <span style={{
            fontSize: '14px',
            color: isSelected ? '#1e40af' : '#2d3748',
            fontWeight: isSelected ? '500' : '400'
        }}>
            {name}
        </span>
    </div>
));

const UserList = ({ users, myId, selectedUsers, onToggle }) => {
    return (
        <div style={{
            maxHeight: '240px',
            overflowY: 'auto',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            background: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        }}>
            {Object.entries(users).map(([id, name]) => id !== myId && (
                <UserItem 
                    key={id}
                    id={id}
                    name={name} 
                    isSelected={selectedUsers.includes(id)} 
                    onToggle={onToggle} 
                />
            ))}
            {Object.keys(users).length < 2 && (
                <div style={{
                    padding: '32px 20px',
                    color: '#a0aec0',
                    textAlign: 'center',
                    fontSize: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <div style={{ fontSize: '32px', opacity: 0.5 }}>👥</div>
                    <div>No active users found</div>
                </div>
            )}
        </div>
    );
};

export default memo(UserList);