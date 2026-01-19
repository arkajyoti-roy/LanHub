import React, { memo } from 'react';

const UserItem = memo(({ id, name, isSelected, onToggle }) => (
    <div 
        onClick={() => onToggle(id)} 
        style={{ 
            padding: '10px', cursor: 'pointer', 
            background: isSelected ? '#ebf8ff' : 'transparent', 
            borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center'
        }}
    >
        <div style={{
            width:'16px', height:'16px', borderRadius:'3px', 
            border:'1px solid #cbd5e0', marginRight:'10px', 
            background: isSelected ? '#3182ce' : 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: '12px'
        }}>
            {isSelected && '✓'}
        </div>
        {name}
    </div>
));

const UserList = ({ users, myId, selectedUsers, onToggle }) => {
    return (
        <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white' }}>
            {Object.entries(users).map(([id, name]) => id !== myId && (
                <UserItem 
                    key={id} id={id} name={name} 
                    isSelected={selectedUsers.includes(id)} 
                    onToggle={onToggle} 
                />
            ))}
            {Object.keys(users).length < 2 && <div style={{padding:'15px', color:'gray', textAlign:'center', fontSize:'0.9em'}}>No active users found</div>}
        </div>
    );
};

export default memo(UserList);