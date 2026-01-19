import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = `http://${window.location.hostname}:5000`;
const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB
const MAX_WINDOW_SIZE = 64;
const generateId = () => Math.random().toString(36).substr(2, 9);

export default function FileTransfer({ authData }) {
  // We use a ref for the socket so we can access it inside closures without deps issues
  const socketRef = useRef(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [incomingReqs, setIncomingReqs] = useState([]);

  const transferEngines = useRef(new Map());
  const watchdogRef = useRef(null);

  // --- 1. SOCKET INITIALIZATION & AUTH ---
  useEffect(() => {
    // Initialize Socket with Token
    socketRef.current = io(SOCKET_URL, {
        auth: { token: authData.token },
        reconnection: true,
        transports: ['websocket']
    });

    const socket = socketRef.current;

    const handleConnect = () => {
        setIsConnected(true);
        // We don't emit 'join' manually anymore, the server does it via Token
    };
    const handleDisconnect = () => setIsConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('users_update', (u) => setUsers(u));

    // Watchdog
    watchdogRef.current = setInterval(checkStalledTransfers, 1000);

    // --- TRANSFER LISTENERS ---
    socket.on('incoming_request', (data) => {
        setIncomingReqs(prev => prev.find(r => r.transferId === data.transferId) ? prev : [...prev, data]);
    });

    socket.on('request_response', (data) => {
        if (data.accepted) setTimeout(() => startUploadEngine(data.transferId), 50);
        else updateTransferUI(data.transferId, { status: "Rejected ❌", progress: 0 });
    });

    socket.on('ack_received', (data) => {
        const engine = transferEngines.current.get(data.transferId);
        if (!engine || !engine.active) return;
        
        engine.lastActivity = Date.now();
        engine.chunksInFlight = Math.max(0, engine.chunksInFlight - 1);
        
        const timeDiff = Date.now() - engine.lastAckTime;
        if (timeDiff < 100) engine.windowSize = Math.min(engine.windowSize + 2, MAX_WINDOW_SIZE);
        else if (timeDiff < 300) engine.windowSize = Math.min(engine.windowSize + 1, MAX_WINDOW_SIZE);
        else if (timeDiff > 600) engine.windowSize = Math.max(engine.windowSize - 1, 1);
        
        engine.lastAckTime = Date.now();
        pumpUploadPipeline(data.transferId);
    });

    socket.on('receive_chunk', (data) => {
        const engine = transferEngines.current.get(data.transferId);
        if (!engine) return;
        
        engine.lastActivity = Date.now();
        if (!engine.chunkMap.has(data.offset)) {
            engine.chunkMap.set(data.offset, data.chunk);
            engine.receivedBytes += data.chunk.byteLength;
        }
        
        socket.emit('window_ack', { to: data.from, offset: data.offset, transferId: data.transferId });

        const pct = Math.floor((engine.receivedBytes / data.total) * 100);
        if (pct % 5 === 0 || pct >= 100) updateTransferUI(data.transferId, { progress: pct, status: `Downloading ${pct}%` });
        if (engine.receivedBytes >= engine.fileSize) finalizeDownload(data.transferId);
    });

    socket.on('transfer_completed', (data) => {
        const engine = transferEngines.current.get(data.transferId);
        if (engine && engine.receivedBytes >= engine.fileSize) finalizeDownload(data.transferId);
    });

    return () => {
        socket.disconnect();
        clearInterval(watchdogRef.current);
    };
  }, [authData.token]);

  // --- LOGIC FUNCTIONS (Watchdog, Pump, Send, Receive) ---
  // (Copied from previous step, adapted to use socketRef.current)

  const checkStalledTransfers = () => {
      const now = Date.now();
      transferEngines.current.forEach((engine, transferId) => {
          if (!engine.active) return;
          if (now - engine.lastActivity > 2000) {
              if (engine.type === 'send') {
                  engine.windowSize = Math.max(1, Math.floor(engine.windowSize / 2));
                  engine.chunksInFlight = 0; 
                  pumpUploadPipeline(transferId);
                  updateTransferUI(transferId, { status: "Optimizing..." });
              }
              engine.lastActivity = now; 
          }
      });
  };

  const updateTransferUI = (id, updates) => {
      setTransfers(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleUserToggle = (uid) => setSelectedUsers(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);

  const sendToSelected = () => {
      if (!selectedFile || selectedUsers.length === 0) return alert("Select file & users!");
      selectedUsers.forEach(targetId => {
          const transferId = generateId();
          const targetName = users[targetId] || "Unknown";
          transferEngines.current.set(transferId, {
              type: 'send', active: false, file: selectedFile, offset: 0,
              receiverId: targetId, windowSize: 2, chunksInFlight: 0, lastAckTime: 0, lastActivity: Date.now()
          });
          setTransfers(prev => [...prev, {
              id: transferId, type: 'outgoing', name: targetName, fileName: selectedFile.name, progress: 0, status: "Waiting...", downloadUrl: null
          }]);
          socketRef.current.emit('request_transfer', {
              to: targetId, transferId, senderName: authData.username, fileName: selectedFile.name, fileSize: selectedFile.size
          });
      });
      setSelectedUsers([]);
  };

  const startUploadEngine = (transferId) => {
      const engine = transferEngines.current.get(transferId);
      if (!engine) return;
      engine.active = true;
      engine.lastActivity = Date.now();
      updateTransferUI(transferId, { status: "Starting..." });
      pumpUploadPipeline(transferId);
  };

  const pumpUploadPipeline = (transferId) => {
      const engine = transferEngines.current.get(transferId);
      if (!engine || !engine.active) return;
      while (engine.active && engine.chunksInFlight < engine.windowSize && engine.offset < engine.file.size) {
          const offset = engine.offset;
          const isLastChunk = (offset + CHUNK_SIZE >= engine.file.size);
          const chunkBlob = engine.file.slice(offset, offset + CHUNK_SIZE);
          readAndSendChunk(transferId, chunkBlob, offset, isLastChunk);
          engine.offset += CHUNK_SIZE;
          engine.chunksInFlight++;
          engine.lastActivity = Date.now();
      }
  };

  const readAndSendChunk = (transferId, blob, offset, isLastChunk) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          const engine = transferEngines.current.get(transferId);
          if (!engine || !engine.active) return;
          socketRef.current.emit('file_chunk', {
              transferId, from: socketRef.current.id, to: engine.receiverId, chunk: e.target.result, offset, total: engine.file.size
          });
          if (isLastChunk) {
              socketRef.current.emit('transfer_completed', {
                  transferId, sender: authData.username, receiverId: engine.receiverId, fileName: engine.file.name, fileSize: engine.file.size
              });
              engine.active = false;
              updateTransferUI(transferId, { status: "Sent ✅", progress: 100 });
          }
      };
      reader.readAsArrayBuffer(blob);
  };

  const handleIncomingDecision = (req, accepted) => {
      setIncomingReqs(prev => prev.filter(r => r.transferId !== req.transferId));
      if (accepted) {
          transferEngines.current.set(req.transferId, {
              type: 'receive', fileSize: req.fileSize, fileName: req.fileName, chunkMap: new Map(), receivedBytes: 0, senderId: req.from, lastActivity: Date.now()
          });
          setTransfers(prev => [...prev, {
              id: req.transferId, type: 'incoming', name: req.senderName, fileName: req.fileName, progress: 0, status: "Waiting...", downloadUrl: null
          }]);
      }
      socketRef.current.emit('response_transfer', { to: req.from, accepted, transferId: req.transferId });
  };

  const finalizeDownload = (transferId) => {
      const engine = transferEngines.current.get(transferId);
      if (!engine || engine.finalized) return;
      engine.finalized = true;
      updateTransferUI(transferId, { status: "Verifying..." });
      setTimeout(() => {
          const sortedChunks = Array.from(engine.chunkMap.entries()).sort((a, b) => a[0] - b[0]).map(e => e[1]);
          const blob = new Blob(sortedChunks);
          if (blob.size !== engine.fileSize) { updateTransferUI(transferId, { status: "Integrity Error ❌" }); return; }
          const url = URL.createObjectURL(blob);
          updateTransferUI(transferId, { status: "Done ✅", progress: 100, downloadUrl: url });
          engine.chunkMap.clear();
          transferEngines.current.delete(transferId);
      }, 50);
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
            <div style={{ background: '#f7fafc', padding: '20px', borderRadius: '12px', border: '1px solid #edf2f7' }}>
                <h3 style={{marginTop:0}}>📤 Send File</h3>
                <input type="file" onChange={(e) => setSelectedFile(e.target.files[0])} style={{ marginBottom: '15px', display: 'block', width: '100%' }} />
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white' }}>
                    {Object.entries(users).map(([id, name]) => id !== socketRef.current?.id && (
                        <div key={id} onClick={() => handleUserToggle(id)} style={{ padding: '10px', cursor: 'pointer', background: selectedUsers.includes(id) ? '#ebf8ff' : 'transparent', borderBottom: '1px solid #eee' }}>
                            {name} {selectedUsers.includes(id) && '✓'}
                        </div>
                    ))}
                </div>
                <button onClick={sendToSelected} style={{ width: '100%', marginTop: '15px', padding: '12px', background: '#3182ce', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Send</button>
            </div>

            <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <h3 style={{marginTop:0}}>📊 Transfers</h3>
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                    {transfers.map(t => (
                        <div key={t.id} style={{ marginBottom: '15px', padding: '10px', background: t.type === 'outgoing' ? '#ebf8ff' : '#f0fff4', borderRadius: '8px', borderLeft: `4px solid ${t.type === 'outgoing' ? '#3182ce' : '#38b2ac'}` }}>
                            <div style={{display:'flex', justifyContent:'space-between'}}><strong>{t.type === 'outgoing' ? `To: ${t.name}` : `From: ${t.name}`}</strong> <small>{t.status}</small></div>
                            <div style={{ fontSize: '0.9em', margin: '5px 0' }}>{t.fileName}</div>
                            <div style={{ width: '100%', height: '6px', background: '#cbd5e0', borderRadius: '3px' }}><div style={{ width: `${t.progress}%`, height: '100%', background: t.type === 'outgoing' ? '#3182ce' : '#38b2ac', transition: 'width 0.2s' }}></div></div>
                            {t.downloadUrl && <a href={t.downloadUrl} download={t.fileName} style={{ display: 'inline-block', marginTop: '5px', color: '#276749', textDecoration: 'none', fontWeight: 'bold' }}>⬇ Save</a>}
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {incomingReqs.map((req, idx) => (
            <div key={idx} style={{ position: 'fixed', bottom: '20px', right: '20px', background: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 10px 15px rgba(0,0,0,0.1)', border: '1px solid #cbd5e0', zIndex: 999 }}>
                <h4>📥 {req.fileName}</h4>
                <p>From: {req.senderName}</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => handleIncomingDecision(req, true)} style={{ background: '#48bb78', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px' }}>Accept</button>
                    <button onClick={() => handleIncomingDecision(req, false)} style={{ background: '#f56565', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px' }}>Reject</button>
                </div>
            </div>
        ))}
    </div>
  );
}