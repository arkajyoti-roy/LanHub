import React, { memo } from 'react';

const IncomingRequest = ({ req, onDecision }) => (
    <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
        marginBottom: '12px',
        border: '1px solid #e2e8f0',
        minWidth: '320px',
        maxWidth: '380px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        animation: 'slideIn 0.3s ease-out'
    }}>
        {/* Header */}
        <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '12px',
            paddingBottom: '12px',
            borderBottom: '1px solid #e2e8f0'
        }}>
            <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                marginRight: '12px'
            }}>
                📥
            </div>
            <div>
                <h4 style={{
                    margin: 0,
                    color: '#1a202c',
                    fontSize: '16px',
                    fontWeight: '600'
                }}>
                    Incoming File
                </h4>
                <p style={{
                    margin: '2px 0 0 0',
                    fontSize: '13px',
                    color: '#718096'
                }}>
                    From: <strong style={{ color: '#2d3748' }}>{req.senderName}</strong>
                </p>
            </div>
        </div>

        {/* File Info */}
        <div style={{
            background: '#f7fafc',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            border: '1px solid #e2e8f0'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '6px'
            }}>
                <span style={{ fontSize: '24px', marginRight: '10px' }}>📄</span>
                <p style={{
                    margin: 0,
                    color: '#1e40af',
                    fontWeight: '600',
                    fontSize: '14px',
                    wordBreak: 'break-word',
                    flex: 1
                }}>
                    {req.fileName}
                </p>
            </div>
            <div style={{
                fontSize: '12px',
                color: '#718096',
                marginLeft: '34px'
            }}>
                {(req.fileSize / 1024 / 1024).toFixed(2)} MB
            </div>
        </div>

        {/* Action Buttons */}
        <div style={{
            display: 'flex',
            gap: '10px'
        }}>
            <button
                onClick={() => onDecision(req, true)}
                style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '11px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)',
                    transition: 'transform 0.1s, box-shadow 0.1s'
                }}
                onMouseOver={(e) => {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.4)';
                }}
                onMouseOut={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)';
                }}
            >
                ✓ Accept
            </button>
            <button
                onClick={() => onDecision(req, false)}
                style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '11px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)',
                    transition: 'transform 0.1s, box-shadow 0.1s'
                }}
                onMouseOver={(e) => {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 8px rgba(220, 38, 38, 0.4)';
                }}
                onMouseOut={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 4px rgba(220, 38, 38, 0.3)';
                }}
            >
                ✕ Reject
            </button>
        </div>
    </div>
);

export default memo(IncomingRequest);