import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

// 🌐 AUTO-DETECT IP
const SOCKET_URL = `http://${window.location.hostname}:5000`;

const socket = io(SOCKET_URL, {
    reconnection: true,
    reconnectionAttempts: 20,
    transports: ['websocket'],
    autoConnect: true
});

// 🚀 ELASTIC CONFIGURATION (The "Secret Sauce")
// Smaller chunks (1MB) prevent 2.4GHz stalling.
// Larger Window (64) allows 5GHz to scream at max speed.
const CHUNK_SIZE = 1 * 1024 * 1024; 
const MAX_WINDOW_SIZE = 64; 

const generateId = () => Math.random().toString(36).substr(2, 9);

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [myID, setMyID] = useState(socket.id);
  const [myName, setMyName] = useState(localStorage.getItem('userName') || `User-${Math.floor(Math.random() * 1000)}`);
  const [users, setUsers] = useState({});

  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]); 
  const [transfers, setTransfers] = useState([]);
  const [incomingReqs, setIncomingReqs] = useState([]);

  const transferEngines = useRef(new Map()); 
  const watchdogRef = useRef(null);

  // 1. CONNECTION LOGIC
  useEffect(() => {
    if (!localStorage.getItem('userName')) {
      const input = prompt("Enter Display Name:", myName);
      if (input) { setMyName(input); localStorage.setItem('userName', input); }
    }

    const handleConnect = () => {
        setIsConnected(true);
        setMyID(socket.id);
        socket.emit('join', localStorage.getItem('userName') || myName);
    };

    const handleDisconnect = () => setIsConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('users_update', (u) => setUsers(u));
    if (socket.connected) handleConnect();

    // 🐕 WATCHDOG: Checks every 1s (Faster reaction for 2.4GHz drops)
    clearInterval(watchdogRef.current);
    watchdogRef.current = setInterval(checkStalledTransfers, 1000);

    return () => {
        socket.off();
        clearInterval(watchdogRef.current);
    };
  }, [myName]);

  // 2. WATCHDOG (Anti-Stuck)
  const checkStalledTransfers = () => {
      const now = Date.now();
      transferEngines.current.forEach((engine, transferId) => {
          if (!engine.active) return;
          
          // If stuck for > 2 seconds (High latency tolerance)
          if (now - engine.lastActivity > 2000) {
              if (engine.type === 'send') {
                  // Cut window size in half (Congestion Control)
                  engine.windowSize = Math.max(1, Math.floor(engine.windowSize / 2));
                  engine.chunksInFlight = 0; 
                  pumpUploadPipeline(transferId); // Kickstart
                  updateTransferUI(transferId, { status: "Optimizing Connection..." });
              }
              engine.lastActivity = now; 
          }
      });
  };

  // 3. TRANSFER LISTENERS
  useEffect(() => {
    socket.on('incoming_request', (data) => {
        setIncomingReqs(prev => prev.find(r => r.transferId === data.transferId) ? prev : [...prev, data]);
    });

    socket.on('request_response', (data) => {
        if (data.accepted) setTimeout(() => startUploadEngine(data.transferId), 50);
        else updateTransferUI(data.transferId, { status: "Rejected ❌", progress: 0 });
    });

    // 🚀 ADAPTIVE SPEED CONTROL
    socket.on('ack_received', (data) => {
        const engine = transferEngines.current.get(data.transferId);
        if (!engine || !engine.active) return;

        engine.lastActivity = Date.now();
        engine.chunksInFlight = Math.max(0, engine.chunksInFlight - 1);

        const timeDiff = Date.now() - engine.lastAckTime;
        
        // 🧠 SMART TUNING LOGIC:
        if (timeDiff < 100) {
            // Cable/5GHz (Super Fast) -> Aggressive Growth
            engine.windowSize = Math.min(engine.windowSize + 2, MAX_WINDOW_SIZE);
        } else if (timeDiff < 300) {
            // 2.4GHz (Good Signal) -> Steady Growth
            engine.windowSize = Math.min(engine.windowSize + 1, MAX_WINDOW_SIZE);
        } else if (timeDiff > 600) {
            // Congestion Detected -> Back off gently
            engine.windowSize = Math.max(engine.windowSize - 1, 1);
        }
        // If between 300-600ms, we keep window stable (Equilibrium)

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
        if (pct % 5 === 0 || pct >= 100) {
            // Show Speed Indicator based on Window Size
            const netType = engine.lastAckTime ? (Date.now() - engine.lastActivity < 100 ? "⚡ 5GHz/LAN" : "📶 2.4GHz") : "🚀";
            updateTransferUI(data.transferId, { progress: pct, status: `Downloading ${pct}% ${netType}` });
        }

        if (engine.receivedBytes >= engine.fileSize) finalizeDownload(data.transferId);
    });

    socket.on('transfer_completed', (data) => {
        const engine = transferEngines.current.get(data.transferId);
        if (engine && engine.receivedBytes >= engine.fileSize) finalizeDownload(data.transferId);
    });

    return () => { socket.off(); };
  }, []);

  const updateTransferUI = (id, updates) => {
      setTransfers(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  // --- SENDER ---
  const handleUserToggle = (uid) => setSelectedUsers(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);

  const sendToSelected = () => {
      if (!selectedFile || selectedUsers.length === 0) return alert("Select file & users!");

      selectedUsers.forEach(targetId => {
          const transferId = generateId();
          const targetName = users[targetId] || "Unknown";

          transferEngines.current.set(transferId, {
              type: 'send', active: false, file: selectedFile, offset: 0,
              receiverId: targetId, windowSize: 2, chunksInFlight: 0, 
              lastAckTime: 0, lastActivity: Date.now()
          });

          setTransfers(prev => [...prev, {
              id: transferId, type: 'outgoing', name: targetName,
              fileName: selectedFile.name, progress: 0, status: "Waiting...", downloadUrl: null
          }]);

          socket.emit('request_transfer', {
              to: targetId, transferId, senderName: myName,
              fileName: selectedFile.name, fileSize: selectedFile.size
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

      while (
          engine.active &&
          engine.chunksInFlight < engine.windowSize &&
          engine.offset < engine.file.size
      ) {
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

          socket.emit('file_chunk', {
              transferId, from: socket.id, to: engine.receiverId,
              chunk: e.target.result, offset, total: engine.file.size
          });

          if (isLastChunk) {
              socket.emit('transfer_completed', {
                  transferId, sender: myName, receiverId: engine.receiverId,
                  fileName: engine.file.name, fileSize: engine.file.size
              });
              engine.active = false;
              updateTransferUI(transferId, { status: "Sent ✅", progress: 100 });
          } else {
              const pct = Math.round((offset / engine.file.size) * 100);
              if (pct % 5 === 0) {
                 const speed = engine.windowSize > 10 ? "⚡ Turbo" : "🟢 Stable";
                 updateTransferUI(transferId, { status: `Sending... (${speed})`, progress: pct });
              }
          }
      };
      reader.readAsArrayBuffer(blob);
  };

  // --- RECEIVER ---
  const handleIncomingDecision = (req, accepted) => {
      setIncomingReqs(prev => prev.filter(r => r.transferId !== req.transferId));
      if (accepted) {
          transferEngines.current.set(req.transferId, {
              type: 'receive', fileSize: req.fileSize, fileName: req.fileName,
              chunkMap: new Map(), receivedBytes: 0, senderId: req.from,
              lastActivity: Date.now()
          });
          setTransfers(prev => [...prev, {
              id: req.transferId, type: 'incoming', name: req.senderName,
              fileName: req.fileName, progress: 0, status: "Waiting...", downloadUrl: null
          }]);
      }
      socket.emit('response_transfer', { to: req.from, accepted, transferId: req.transferId });
  };

  const finalizeDownload = (transferId) => {
      const engine = transferEngines.current.get(transferId);
      if (!engine || engine.finalized) return;
      engine.finalized = true;
      updateTransferUI(transferId, { status: "Verifying..." });

      setTimeout(() => {
          const sortedChunks = Array.from(engine.chunkMap.entries()).sort((a, b) => a[0] - b[0]).map(e => e[1]);
          const blob = new Blob(sortedChunks);
          if (blob.size !== engine.fileSize) {
              updateTransferUI(transferId, { status: "Integrity Error ❌" });
              return;
          }
          const url = URL.createObjectURL(blob);
          updateTransferUI(transferId, { status: "Done ✅", progress: 100, downloadUrl: url });
          engine.chunkMap.clear();
          transferEngines.current.delete(transferId);
      }, 50);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Segoe UI, sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ padding: '15px', background: isConnected ? '#e6fffa' : '#fff5f5', borderRadius: '8px', marginBottom: '20px', textAlign:'center', border: `1px solid ${isConnected?'#38b2ac':'#fc8181'}` }}>
        <h2 style={{margin:0}}>🚀 LAN Parallel Share</h2>
        <div style={{display:'flex', justifyContent:'space-between', marginTop:'10px', fontSize:'0.9em'}}>
            <span>Status: <strong>{isConnected ? "ONLINE" : "OFFLINE"}</strong></span>
            <span>IP: {window.location.hostname}</span>
            <span>Name: <strong>{myName}</strong></span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={{ background: '#f7fafc', padding: '20px', borderRadius: '12px', border: '1px solid #edf2f7' }}>
            <h3>📤 Send File</h3>
            <div style={{marginBottom:'15px'}}>
                <input type="file" onChange={(e) => setSelectedFile(e.target.files[0])} style={{display:'block', width:'100%'}}/>
                {selectedFile && <div style={{fontSize:'0.8em', color:'#4a5568', marginTop:'5px'}}>{(selectedFile.size/1024/1024).toFixed(1)} MB</div>}
            </div>
            <h4>Select Recipients:</h4>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border:'1px solid #e2e8f0', borderRadius:'6px', background:'white' }}>
                {Object.entries(users).map(([id, name]) => id !== myID && (
                    <div key={id} onClick={() => handleUserToggle(id)} style={{ padding: '10px', cursor: 'pointer', background: selectedUsers.includes(id) ? '#ebf8ff' : 'transparent', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center' }}>
                         <div style={{width:'16px', height:'16px', borderRadius:'3px', border:'1px solid #cbd5e0', marginRight:'10px', background: selectedUsers.includes(id) ? '#3182ce' : 'white'}}></div> {name}
                    </div>
                ))}
            </div>
            <button onClick={sendToSelected} disabled={!selectedFile || selectedUsers.length===0} style={{ width:'100%', marginTop:'15px', padding:'12px', background:'#3182ce', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'bold', opacity: (!selectedFile || selectedUsers.length===0) ? 0.5 : 1 }}>Send</button>
        </div>

        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <h3>📊 Live Dashboard</h3>
            {transfers.length === 0 && <div style={{textAlign:'center', color:'gray', marginTop:'50px'}}>No active transfers</div>}
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {transfers.map(t => (
                    <div key={t.id} style={{ marginBottom: '15px', padding: '10px', borderRadius: '8px', background: t.type === 'outgoing' ? '#ebf8ff' : '#f0fff4', borderLeft: `4px solid ${t.type === 'outgoing' ? '#3182ce' : '#38b2ac'}` }}>
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                            <strong>{t.type === 'outgoing' ? `To: ${t.name}` : `From: ${t.name}`}</strong>
                            <span style={{fontSize:'0.8em', color:'gray'}}>{t.type === 'outgoing' ? 'Upload' : 'Download'}</span>
                        </div>
                        <div style={{fontSize:'0.9em', marginBottom:'5px', wordBreak:'break-all'}}>{t.fileName}</div>
                        <div style={{width:'100%', height:'8px', background:'#cbd5e0', borderRadius:'4px', overflow:'hidden'}}>
                            <div style={{width: `${t.progress}%`, height:'100%', background: t.type === 'outgoing' ? '#3182ce' : '#38b2ac', transition: 'width 0.2s'}}></div>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between', marginTop:'5px', alignItems:'center'}}>
                            <small>{t.status}</small>
                            {t.downloadUrl && <a href={t.downloadUrl} download={t.fileName} style={{background:'#38b2ac', color:'white', textDecoration:'none', padding:'4px 10px', borderRadius:'4px', fontSize:'0.8em'}}>Save</a>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {incomingReqs.length > 0 && (
          <div style={{ position:'fixed', bottom:'20px', right:'20px', width:'300px', zIndex:1000 }}>
              {incomingReqs.map((req, idx) => (
                  <div key={idx} style={{ background:'white', padding:'15px', borderRadius:'8px', boxShadow:'0 10px 15px -3px rgba(0,0,0,0.1)', marginBottom:'10px', border:'1px solid #cbd5e0' }}>
                      <h4 style={{margin:'0 0 10px 0'}}>📥 Incoming File</h4>
                      <p style={{margin:0}}><strong>{req.senderName}</strong> sends:</p>
                      <p style={{margin:'5px 0', color:'#3182ce', wordBreak:'break-all'}}>{req.fileName}</p>
                      <div style={{marginTop:'10px', display:'flex', gap:'10px'}}>
                          <button onClick={() => handleIncomingDecision(req, true)} style={{flex:1, background:'#48bb78', color:'white', border:'none', padding:'8px', borderRadius:'4px', cursor:'pointer'}}>Accept</button>
                          <button onClick={() => handleIncomingDecision(req, false)} style={{flex:1, background:'#f56565', color:'white', border:'none', padding:'8px', borderRadius:'4px', cursor:'pointer'}}>Reject</button>
                      </div>
                  </div>
              ))}
          </div>
      )}
    </div>
  );
}

export default App;