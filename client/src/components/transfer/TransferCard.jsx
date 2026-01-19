import React, { memo } from 'react';

const TransferCard = ({ transfer }) => {
    const isOutgoing = transfer.type === 'outgoing';
    const barColor = isOutgoing ? '#3182ce' : '#38b2ac';
    const bgColor = isOutgoing ? '#ebf8ff' : '#f0fff4';
    const borderColor = isOutgoing ? '#3182ce' : '#38b2ac';

    return (
        <div style={{ marginBottom: '15px', padding: '12px', background: bgColor, borderRadius: '8px', borderLeft: `4px solid ${borderColor}` }}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                <strong style={{color:'#2d3748'}}>{isOutgoing ? `To: ${transfer.name}` : `From: ${transfer.name}`}</strong> 
                <span style={{fontSize:'0.75em', color: isOutgoing ? '#2b6cb0' : '#276749', fontWeight:'bold', textTransform:'uppercase'}}>{transfer.status}</span>
            </div>
            <div style={{ fontSize: '0.9em', marginBottom: '8px', color:'#4a5568', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{transfer.fileName}</div>
            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow:'hidden' }}>
                <div style={{ width: `${transfer.progress}%`, height: '100%', background: barColor, transition: 'width 0.2s linear' }}></div>
            </div>
            {transfer.downloadUrl && (
                <div style={{marginTop:'10px', textAlign:'right'}}>
                    <a href={transfer.downloadUrl} download={transfer.fileName} style={{ background: '#38b2ac', color: 'white', textDecoration: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '0.85em', fontWeight:'bold' }}>⬇ Save File</a>
                </div>
            )}
        </div>
    );
};

export default memo(TransferCard);