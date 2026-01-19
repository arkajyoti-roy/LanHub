import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import IncomingRequest from './transfer/IncomingRequest';

const SOCKET_URL = `http://${window.location.hostname}:5000`;
const API_URL = `http://${window.location.hostname}:5000`;

// ⚡ PERFORMANCE CONFIGURATION
const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB Chunks (Best balance for Node.js)
const MAX_WINDOW_SIZE = 128;        // 🚀 Max 128MB in flight (Massive speed for LAN Cable/5GHz)
const MIN_WINDOW_SIZE = 4;          // 🛡️ Never drop below 4MB (Prevents 2.4GHz stalls)

const generateId = () => Math.random().toString(36).substr(2, 9);

export default function FileTransfer({ authData }) {
  const socketRef = useRef(null);
  const chatBottomRef = useRef(null);
  
  // --- STATE ---
  const [onlineUsers, setOnlineUsers] = useState({}); 
  const [historyLogs, setHistoryLogs] = useState([]);
  const [transfers, setTransfers] = useState([]); 
  const [incomingReqs, setIncomingReqs] = useState([]); 
  
  const [selectedUser, setSelectedUser] = useState(null); 
  const [selectedFile, setSelectedFile] = useState(null);

  const transferEngines = useRef(new Map());
  const watchdogRef = useRef(null);

  // --- 1. SETUP & LISTENERS ---
  useEffect(() => {
    fetchHistory();
    
    // 🔌 HIGH PERFORMANCE SOCKET OPTIONS
    socketRef.current = io(SOCKET_URL, {
        auth: { token: authData.token },
        reconnection: true,
        transports: ['websocket'], // Force WebSocket (No polling latency)
        upgrade: false
    });

    const socket = socketRef.current;
    
    socket.on('connect', () => console.log("✅ Socket Connected"));
    socket.on('users_update', (u) => setOnlineUsers(u));

    socket.on('incoming_request', (data) => {
        setIncomingReqs(prev => {
            if (prev.find(r => r.transferId === data.transferId)) return prev;
            return [...prev, data];
        });
    });

    socket.on('request_response', (data) => {
        if (data.accepted) {
            // Instant start (No artificial delay)
            startUploadEngine(data.transferId);
        } else {
            updateTransferUI(data.transferId, { status: "Rejected ❌", progress: 0 });
        }
    });

    socket.on('ack_received', (data) => handleAck(data));
    socket.on('receive_chunk', (data) => handleChunk(data));
    socket.on('transfer_completed', (data) => {
        finalizeDownload(data.transferId);
    });

    // 🐕 Fast Watchdog (500ms) to catch drops instantly
    watchdogRef.current = setInterval(checkStalledTransfers, 500);

    return () => { socket.disconnect(); clearInterval(watchdogRef.current); };
  }, [authData.token]);

  useEffect(() => {
      if (chatBottomRef.current) chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [historyLogs, transfers, selectedUser]);


  // --- 2. DATA MANAGEMENT ---

  const fetchHistory = async () => {
      try {
          const res = await axios.get(`${API_URL}/api/history`, {
              headers: { Authorization: `Bearer ${authData.token}` }
          });
          setHistoryLogs(res.data);
      } catch (err) { console.error("History Error"); }
  };

  const contactList = useMemo(() => {
      const contacts = new Set();
      Object.entries(onlineUsers).forEach(([id, name]) => {
          if (name !== authData.username) contacts.add(name);
      });
      historyLogs.forEach(log => {
          const other = log.sender === authData.username ? log.receiver : log.sender;
          if(other) contacts.add(other);
      });

      return Array.from(contacts).map(name => {
          const socketId = Object.keys(onlineUsers).find(key => onlineUsers[key] === name);
          return { name, isOnline: !!socketId, socketId: socketId || null };
      }).sort((a,b) => (b.isOnline - a.isOnline));
  }, [onlineUsers, historyLogs, authData.username]);

  const chatMessages = useMemo(() => {
      if (!selectedUser) return [];

      const live = transfers
          .filter(t => t.peerName === selectedUser.name)
          .map(t => ({ ...t, isActive: true, timestamp: t.startTime }));

      const past = historyLogs
          .filter(l => l.sender === selectedUser.name || l.receiver === selectedUser.name)
          .filter(l => {
              const isDuplicate = live.some(t => 
                  t.fileName === l.fileName && 
                  t.fileSize === l.fileSize && 
                  Math.abs(new Date(t.startTime).getTime() - new Date(l.timestamp).getTime()) < 10000
              );
              return !isDuplicate;
          })
          .map(l => ({ ...l, isActive: false, id: l._id }));

      return [...past, ...live].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [selectedUser, historyLogs, transfers]);


  // --- 3. SEND / RECEIVE LOGIC ---

  const updateTransferUI = (id, updates) => {
      setTransfers(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleSendFile = () => {
      if (!selectedFile || !selectedUser) return;
      
      const currentSocketId = Object.keys(onlineUsers).find(key => onlineUsers[key] === selectedUser.name);
      
      if (!currentSocketId) {
          alert(`${selectedUser.name} is offline.`);
          return;
      }

      const transferId = generateId();

      // Initialize Engine
      transferEngines.current.set(transferId, {
          type: 'send', 
          active: false, 
          file: selectedFile, 
          offset: 0, 
          highestAckedOffset: 0, 
          receiverId: currentSocketId,
          receiverName: selectedUser.name, 
          windowSize: 4, // Start conservative, ramp up fast
          chunksInFlight: 0, 
          lastAckTime: 0, 
          lastActivity: Date.now()
      });

      setTransfers(prev => [...prev, {
          id: transferId,
          peerName: selectedUser.name, 
          type: 'outgoing',
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          progress: 0,
          status: "Waiting...",
          startTime: Date.now()
      }]);

      socketRef.current.emit('request_transfer', {
          to: currentSocketId,
          transferId,
          senderName: authData.username,
          fileName: selectedFile.name,
          fileSize: selectedFile.size
      });
      
      setSelectedFile(null);
  };

  const handleIncomingDecision = (req, accepted) => {
      setIncomingReqs(prev => prev.filter(r => r.transferId !== req.transferId));
      
      if (accepted) {
          transferEngines.current.set(req.transferId, {
              type: 'receive', fileSize: req.fileSize, fileName: req.fileName, 
              chunkMap: new Map(), receivedBytes: 0, senderId: req.from, 
              lastActivity: Date.now()
          });

          setTransfers(prev => [...prev, {
              id: req.transferId,
              peerName: req.senderName, 
              type: 'incoming',
              fileName: req.fileName,
              fileSize: req.fileSize,
              progress: 0,
              status: "Starting...",
              startTime: Date.now()
          }]);
      }
      
      socketRef.current.emit('response_transfer', { 
          to: req.from, accepted, transferId: req.transferId 
      });
  };

  // --- 4. ⚡ TURBO ENGINE CORE ---
  
  const startUploadEngine = (id) => {
      const e = transferEngines.current.get(id);
      if(e) { 
          e.active=true; 
          e.lastActivity=Date.now(); 
          updateTransferUI(id, {status:"Sending..."}); 
          pumpUploadPipeline(id); 
      }
  };

  const handleAck = (data) => {
      const engine = transferEngines.current.get(data.transferId);
      if (!engine || !engine.active) return;
      
      if (data.offset > engine.highestAckedOffset) engine.highestAckedOffset = data.offset;
      engine.chunksInFlight = Math.max(0, engine.chunksInFlight - 1);
      engine.lastActivity = Date.now();
      
      // 🚀 AGGRESSIVE ADAPTIVE SPEED
      // 2.4GHz can have ping ~200ms. We should still grow the window!
      const timeDiff = Date.now() - engine.lastAckTime;
      
      if (timeDiff < 200) { 
          // Excellent Connection (LAN/5GHz) -> Double Growth
          engine.windowSize = Math.min(engine.windowSize + 2, MAX_WINDOW_SIZE);
      } else if (timeDiff < 600) {
          // Good Connection (2.4GHz) -> Steady Growth
          engine.windowSize = Math.min(engine.windowSize + 1, MAX_WINDOW_SIZE);
      } else if (timeDiff > 1500) {
          // Congestion -> Gentle Backoff (Don't crash to 1)
          engine.windowSize = Math.max(engine.windowSize - 1, MIN_WINDOW_SIZE);
      }
      
      engine.lastAckTime = Date.now();

      if (engine.highestAckedOffset + CHUNK_SIZE >= engine.file.size) {
          finishSender(data.transferId, engine);
      } else {
          pumpUploadPipeline(data.transferId);
      }
  };

  const handleChunk = (data) => {
      const engine = transferEngines.current.get(data.transferId);
      if (!engine) return;
      
      engine.lastActivity = Date.now();
      if (!engine.chunkMap.has(data.offset)) { 
          engine.chunkMap.set(data.offset, data.chunk); 
          engine.receivedBytes += data.chunk.byteLength; 
      }
      
      // ACK immediately to keep pipeline full
      socketRef.current.emit('window_ack', { to: data.from, offset: data.offset, transferId: data.transferId });
      
      const pct = Math.floor((engine.receivedBytes / data.total) * 100);
      
      // Update UI less frequently for performance
      if (pct % 5 === 0 || pct >= 100) {
           updateTransferUI(data.transferId, { progress: pct, status: `Downloading ${pct}%` });
      }
      
      if (engine.receivedBytes >= engine.fileSize) finalizeDownload(data.transferId);
  };

  const pumpUploadPipeline = (id) => { 
      const e = transferEngines.current.get(id); 
      if(!e || !e.active) return; 
      
      // Keep pumping until window is full OR file is done
      while(e.active && e.chunksInFlight < e.windowSize && e.offset < e.file.size){ 
          const blob = e.file.slice(e.offset, e.offset+CHUNK_SIZE); 
          const r = new FileReader();
          const currentOffset = e.offset;
          
          r.onload=(evt)=>{ 
             if(transferEngines.current.get(id)?.active) {
                socketRef.current.emit('file_chunk', { 
                    transferId: id, 
                    from: socketRef.current.id, 
                    to: e.receiverId, 
                    chunk: evt.target.result, 
                    offset: currentOffset, 
                    total: e.file.size 
                }); 
                
                // Throttle UI updates to save CPU cycles
                if(Math.random() > 0.7) {
                    const pct=Math.round((currentOffset/e.file.size)*100);
                    updateTransferUI(id, {progress:pct});
                }
             }
          }; 
          r.readAsArrayBuffer(blob);
          
          e.offset+=CHUNK_SIZE; 
          e.chunksInFlight++; 
          e.lastActivity=Date.now(); 
      } 
  };

  const finishSender = (id, e) => {
      if(e.active){
          const finalReceiverName = e.receiverName || onlineUsers[e.receiverId] || "Unknown";
          socketRef.current.emit('transfer_completed', { 
              transferId: id, 
              sender: authData.username, 
              receiver: finalReceiverName, 
              receiverId: e.receiverId, 
              fileName: e.file.name, 
              fileSize: e.file.size 
          }); 
          
          e.active=false; 
          updateTransferUI(id, {status:"Sent ✅", progress:100});
          setTimeout(fetchHistory, 1500); 
      }
  };

  const finalizeDownload = (id) => { 
      const e = transferEngines.current.get(id); if(!e||e.finalized)return; e.finalized=true; 
      
      updateTransferUI(id, {status:"Verifying Integrity..."}); 
      
      setTimeout(()=>{ 
          // 🛡️ INTEGRITY CHECK: Sort & Merge
          const sortedChunks = Array.from(e.chunkMap.entries()).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
          const b = new Blob(sortedChunks); 
          
          // 🛡️ VERIFY SIZE
          if (b.size !== e.fileSize) {
              console.error(`Integrity Mismatch! Expected ${e.fileSize}, got ${b.size}`);
              updateTransferUI(id, {status: "Integrity Error ❌"});
              return;
          }

          const url = URL.createObjectURL(b);
          updateTransferUI(id,{status:"Done ✅", progress:100, downloadUrl:url}); 
          
          e.chunkMap.clear(); 
          setTimeout(fetchHistory, 5000); 
      }, 50); 
  };

  const checkStalledTransfers = () => {
      const now = Date.now();
      transferEngines.current.forEach((engine, transferId) => {
          if (!engine.active) return;
          
          // Stuck? (Greater than 3s silence)
          if (now - engine.lastActivity > 3000 && engine.type === 'send') {
               // 🧠 SMART RECOVERY: Don't kill speed. Cut window in half.
               engine.offset = engine.highestAckedOffset || 0;
               engine.windowSize = Math.max(MIN_WINDOW_SIZE, Math.floor(engine.windowSize / 2));
               engine.chunksInFlight = 0;
               
               updateTransferUI(transferId, { status: "Recovering..." });
               pumpUploadPipeline(transferId);
               engine.lastActivity = now;
          }
      });
  };

  // --- RENDER ---
  return (
    <div style={{ maxWidth: '1200px', margin: '20px auto', fontFamily: 'Segoe UI, sans-serif', display: 'grid', gridTemplateColumns: '300px 1fr', height: '80vh', background: 'white', borderRadius: '12px', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        
        {/* LEFT SIDEBAR */}
        <div style={{ borderRight: '1px solid #e2e8f0', background: '#fff', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '15px', background: '#f7fafc', borderBottom: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: 0, color: '#2d3748' }}>Chats</h3>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {contactList.map(contact => (
                    <div 
                        key={contact.name}
                        onClick={() => setSelectedUser(contact)}
                        style={{ 
                            padding: '15px', cursor: 'pointer', 
                            background: selectedUser?.name === contact.name ? '#ebf8ff' : 'white',
                            borderLeft: selectedUser?.name === contact.name ? '4px solid #3182ce' : '4px solid transparent',
                            display: 'flex', alignItems: 'center', borderBottom:'1px solid #f7fafc'
                        }}
                    >
                        <div style={{ position:'relative', width:'40px', height:'40px', borderRadius:'50%', background:'#cbd5e0', marginRight:'12px', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold' }}>
                            {contact.name.charAt(0).toUpperCase()}
                            {contact.isOnline && <div style={{ position:'absolute', bottom:0, right:0, width:'10px', height:'10px', background:'#48bb78', borderRadius:'50%', border:'2px solid white'}}></div>}
                        </div>
                        <div>
                            <div style={{ fontWeight: '600', color: '#2d3748' }}>{contact.name}</div>
                            <div style={{ fontSize: '0.8em', color: contact.isOnline ? '#48bb78' : '#a0aec0' }}>
                                {contact.isOnline ? 'Online' : 'Offline'}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#e5ddd5' }}>
            
            {/* Header */}
            <div style={{ padding: '15px', background: 'white', borderBottom: '1px solid #e2e8f0', display:'flex', alignItems:'center' }}>
                {selectedUser ? (
                    <>
                        <div style={{ width:'35px', height:'35px', borderRadius:'50%', background:'#3182ce', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold', marginRight:'10px' }}>
                            {selectedUser.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style={{ fontWeight: 'bold' }}>{selectedUser.name}</div>
                            {selectedUser.isOnline && <div style={{ fontSize: '0.75em', color: '#48bb78' }}>● Online</div>}
                        </div>
                    </>
                ) : <div style={{ color: '#718096' }}>Select a user</div>}
            </div>

            {/* Messages Area */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                {selectedUser ? (
                    chatMessages.map((msg, idx) => {
                        const isMe = (msg.type === 'outgoing') || (msg.sender === authData.username);
                        const showProgress = msg.isActive === true; 

                        return (
                            <div key={idx} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: '15px' }}>
                                <div style={{ 
                                    maxWidth: '60%', minWidth: '220px',
                                    background: isMe ? '#dcf8c6' : 'white', 
                                    padding: '10px', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                }}>
                                    
                                    <div style={{ display:'flex', alignItems:'center', marginBottom:'8px' }}>
                                        <div style={{ fontSize:'24px', marginRight:'10px' }}>📄</div>
                                        <div style={{ fontWeight: 'bold', wordBreak:'break-all', fontSize:'0.95em' }}>{msg.fileName}</div>
                                    </div>

                                    {/* Progress Bar (Always visible during active transfer) */}
                                    {showProgress ? (
                                        <div style={{ marginBottom:'5px' }}>
                                            <div style={{ width:'100%', height:'6px', background:'rgba(0,0,0,0.1)', borderRadius:'3px' }}>
                                                <div style={{ width:`${msg.progress}%`, height:'100%', background: isMe ? '#128c7e' : '#3182ce', transition:'width 0.2s' }}></div>
                                            </div>
                                            <div style={{ fontSize:'0.75em', marginTop:'4px', display:'flex', justifyContent:'space-between', fontWeight:'bold', color: '#555' }}>
                                                <span>{msg.status}</span> 
                                                <span>{msg.progress}%</span>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Static History Info */
                                        <div style={{ fontSize:'0.8em', color:'#666', display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'5px' }}>
                                            <span>{(msg.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                                            <span style={{ display:'flex', alignItems:'center' }}>
                                                {new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                                {isMe && <span style={{ marginLeft:'5px', color:'#4fc3f7' }}>✓✓</span>}
                                            </span>
                                        </div>
                                    )}

                                    {/* Download Button */}
                                    {(msg.downloadUrl) && (
                                        <a href={msg.downloadUrl} download={msg.fileName} style={{ display:'block', textAlign:'center', marginTop:'8px', padding:'8px', background:'#34b7f1', color:'white', borderRadius:'4px', textDecoration:'none', fontWeight:'bold', fontSize:'0.9em' }}>
                                            ⬇ Save File
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0aec0', flexDirection: 'column' }}>
                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>👋</div>
                        <div>Select a contact to share files</div>
                    </div>
                )}
                <div ref={chatBottomRef} />
            </div>

            {/* Footer */}
            {selectedUser && (
                <div style={{ padding: '15px', background: '#f0f0f0', borderTop: '1px solid #ccc', display:'flex', gap:'10px', alignItems:'center' }}>
                    <label style={{ cursor:'pointer', background:'white', padding:'10px 15px', borderRadius:'20px', border:'1px solid #ccc', display:'flex', alignItems:'center', color:'#555' }}>
                        📎 <span style={{marginLeft:'5px'}}>{selectedFile ? selectedFile.name : "Choose File"}</span>
                        <input type="file" onChange={(e) => setSelectedFile(e.target.files[0])} style={{ display: 'none' }} />
                    </label>
                    <button 
                        onClick={handleSendFile}
                        disabled={!selectedFile || !selectedUser.isOnline}
                        style={{ flex: 1, padding: '12px', borderRadius: '20px', border: 'none', background: (selectedFile && selectedUser.isOnline) ? '#128c7e' : '#ccc', color: 'white', fontWeight: 'bold', cursor: (selectedFile && selectedUser.isOnline) ? 'pointer' : 'not-allowed' }}
                    >
                        Send ➤
                    </button>
                </div>
            )}
        </div>

        {/* Global Popups */}
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999 }}>
            {incomingReqs.map((req) => (<IncomingRequest key={req.transferId} req={req} onDecision={handleIncomingDecision} />))}
        </div>

    </div>
  );
}