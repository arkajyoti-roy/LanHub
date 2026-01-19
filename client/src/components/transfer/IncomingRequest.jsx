import React, { memo } from 'react';

const IncomingRequest = ({ req, onDecision }) => (
    <div style={{ background: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', marginBottom: '10px', border: '1px solid #cbd5e0' }}>
        <h4 style={{ margin: '0 0 5px 0', color: '#2d3748' }}>📥 Incoming File</h4>
        <p style={{ margin: 0, fontSize: '0.9em', color: '#718096' }}>From: <strong>{req.senderName}</strong></p>
        <p style={{ margin: '5px 0', color: '#3182ce', fontWeight: 'bold' }}>{req.fileName}</p>
        <small style={{color:'#a0aec0'}}>{(req.fileSize/1024/1024).toFixed(2)} MB</small>
        <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
            <button onClick={() => onDecision(req, true)} style={{ flex: 1, background: '#48bb78', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>Accept</button>
            <button onClick={() => onDecision(req, false)} style={{ flex: 1, background: '#f56565', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>Reject</button>
        </div>
    </div>
);

export default memo(IncomingRequest);