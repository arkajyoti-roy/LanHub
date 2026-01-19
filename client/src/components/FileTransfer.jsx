import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import IncomingRequest from './transfer/IncomingRequest';

const SOCKET_URL = `http://${window.location.hostname}:5000`;
const API_URL = `http://${window.location.hostname}:5000`;

const CHUNK_SIZE = 1 * 1024 * 1024;
const MAX_WINDOW_SIZE = 128;
const MIN_WINDOW_SIZE = 4;

const generateId = () => Math.random().toString(36).substr(2, 9);

export default function FileTransfer({ authData }) {
  const socketRef = useRef(null);
  const chatBottomRef = useRef(null);
  
  const [onlineUsers, setOnlineUsers] = useState({}); 
  const [historyLogs, setHistoryLogs] = useState([]);
  const [transfers, setTransfers] = useState([]); 
  const [incomingReqs, setIncomingReqs] = useState([]); 
  const [selectedUser, setSelectedUser] = useState(null); 
  const [selectedFile, setSelectedFile] = useState(null);

  const transferEngines = useRef(new Map());
  const watchdogRef = useRef(null);

  useEffect(() => {
    fetchHistory();
    socketRef.current = io(SOCKET_URL, {
        auth: { token: authData.token },
        reconnection: true,
        transports: ['websocket'],
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
    watchdogRef.current = setInterval(checkStalledTransfers, 500);
    return () => { socket.disconnect(); clearInterval(watchdogRef.current); };
  }, [authData.token]);

  useEffect(() => {
      if (chatBottomRef.current) chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [historyLogs, transfers, selectedUser]);

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
      const live = transfers.filter(t => t.peerName === selectedUser.name).map(t => ({ ...t, isActive: true, timestamp: t.startTime }));
      const past = historyLogs.filter(l => l.sender === selectedUser.name || l.receiver === selectedUser.name)
          .filter(l => {
              const isDuplicate = live.some(t => t.fileName === l.fileName && t.fileSize === l.fileSize && Math.abs(new Date(t.startTime).getTime() - new Date(l.timestamp).getTime()) < 10000);
              return !isDuplicate;
          }).map(l => ({ ...l, isActive: false, id: l._id }));
      return [...past, ...live].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [selectedUser, historyLogs, transfers]);

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
      transferEngines.current.set(transferId, {
          type: 'send', active: false, file: selectedFile, offset: 0, highestAckedOffset: 0, receiverId: currentSocketId,
          receiverName: selectedUser.name, windowSize: 4, chunksInFlight: 0, lastAckTime: 0, lastActivity: Date.now()
      });
      setTransfers(prev => [...prev, {
          id: transferId, peerName: selectedUser.name, type: 'outgoing', fileName: selectedFile.name,
          fileSize: selectedFile.size, progress: 0, status: "Waiting...", startTime: Date.now()
      }]);
      socketRef.current.emit('request_transfer', {
          to: currentSocketId, transferId, senderName: authData.username, fileName: selectedFile.name, fileSize: selectedFile.size
      });
      setSelectedFile(null);
  };

  const handleIncomingDecision = (req, accepted) => {
      setIncomingReqs(prev => prev.filter(r => r.transferId !== req.transferId));
      if (accepted) {
          transferEngines.current.set(req.transferId, {
              type: 'receive', fileSize: req.fileSize, fileName: req.fileName, chunkMap: new Map(), receivedBytes: 0, senderId: req.from, lastActivity: Date.now()
          });
          setTransfers(prev => [...prev, {
              id: req.transferId, peerName: req.senderName, type: 'incoming', fileName: req.fileName,
              fileSize: req.fileSize, progress: 0, status: "Starting...", startTime: Date.now()
          }]);
      }
      socketRef.current.emit('response_transfer', { to: req.from, accepted, transferId: req.transferId });
  };

  const startUploadEngine = (id) => {
      const e = transferEngines.current.get(id);
      if(e) { e.active=true; e.lastActivity=Date.now(); updateTransferUI(id, {status:"Sending..."}); pumpUploadPipeline(id); }
  };

  const handleAck = (data) => {
      const engine = transferEngines.current.get(data.transferId);
      if (!engine || !engine.active) return;
      if (data.offset > engine.highestAckedOffset) engine.highestAckedOffset = data.offset;
      engine.chunksInFlight = Math.max(0, engine.chunksInFlight - 1);
      engine.lastActivity = Date.now();
      const timeDiff = Date.now() - engine.lastAckTime;
      if (timeDiff < 200) { 
          engine.windowSize = Math.min(engine.windowSize + 2, MAX_WINDOW_SIZE);
      } else if (timeDiff < 600) {
          engine.windowSize = Math.min(engine.windowSize + 1, MAX_WINDOW_SIZE);
      } else if (timeDiff > 1500) {
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
      socketRef.current.emit('window_ack', { to: data.from, offset: data.offset, transferId: data.transferId });
      const pct = Math.floor((engine.receivedBytes / data.total) * 100);
      if (pct % 5 === 0 || pct >= 100) {
           updateTransferUI(data.transferId, { progress: pct, status: `Downloading ${pct}%` });
      }
      if (engine.receivedBytes >= engine.fileSize) finalizeDownload(data.transferId);
  };

  const pumpUploadPipeline = (id) => { 
      const e = transferEngines.current.get(id); 
      if(!e || !e.active) return; 
      while(e.active && e.chunksInFlight < e.windowSize && e.offset < e.file.size){ 
          const blob = e.file.slice(e.offset, e.offset+CHUNK_SIZE); 
          const r = new FileReader();
          const currentOffset = e.offset;
          r.onload=(evt)=>{ 
             if(transferEngines.current.get(id)?.active) {
                socketRef.current.emit('file_chunk', { transferId: id, from: socketRef.current.id, to: e.receiverId, chunk: evt.target.result, offset: currentOffset, total: e.file.size }); 
                if(Math.random() > 0.7) {
                    const pct=Math.round((currentOffset/e.file.size)*100);
                    updateTransferUI(id, {progress:pct});
                }
             }
          }; 
          r.readAsArrayBuffer(blob);
          e.offset+=CHUNK_SIZE; e.chunksInFlight++; e.lastActivity=Date.now(); 
      } 
  };

  const finishSender = (id, e) => {
      if(e.active){
          const finalReceiverName = e.receiverName || onlineUsers[e.receiverId] || "Unknown";
          socketRef.current.emit('transfer_completed', { transferId: id, sender: authData.username, receiver: finalReceiverName, receiverId: e.receiverId, fileName: e.file.name, fileSize: e.file.size }); 
          e.active=false; 
          updateTransferUI(id, {status:"Sent ✅", progress:100});
          setTimeout(fetchHistory, 1500); 
      }
  };

  const finalizeDownload = (id) => { 
      const e = transferEngines.current.get(id); if(!e||e.finalized)return; e.finalized=true; 
      updateTransferUI(id, {status:"Verifying Integrity..."}); 
      setTimeout(()=>{ 
          const sortedChunks = Array.from(e.chunkMap.entries()).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
          const b = new Blob(sortedChunks); 
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
          if (now - engine.lastActivity > 3000 && engine.type === 'send') {
               engine.offset = engine.highestAckedOffset || 0;
               engine.windowSize = Math.max(MIN_WINDOW_SIZE, Math.floor(engine.windowSize / 2));
               engine.chunksInFlight = 0;
               updateTransferUI(transferId, { status: "Recovering..." });
               pumpUploadPipeline(transferId);
               engine.lastActivity = now;
          }
      });
  };

  return (
    <div style={{ maxWidth:'1400px', margin:'0 auto', fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', display:'grid', gridTemplateColumns:'320px 1fr', height:'75vh', background:'white', borderRadius:'12px', boxShadow:'0 2px 8px rgba(0,0,0,0.08)', overflow:'hidden', border:'1px solid #e2e8f0' }}>
        <div style={{ borderRight:'1px solid #e2e8f0', background:'#fff', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'20px', background:'#f7fafc', borderBottom:'1px solid #e2e8f0' }}>
                <h3 style={{ margin:0, color:'#1a202c', fontSize:'16px', fontWeight:'600' }}>Contacts</h3>
                <p style={{ margin:'4px 0 0 0', fontSize:'13px', color:'#718096' }}>{contactList.filter(c => c.isOnline).length} online</p>
            </div>
            <div style={{ flex:1, overflowY:'auto' }}>
                {contactList.map(contact => (
                    <div key={contact.name} onClick={() => setSelectedUser(contact)} style={{ padding:'16px 20px', cursor:'pointer', background:selectedUser?.name === contact.name ? '#eff6ff' : 'white', borderLeft:selectedUser?.name === contact.name ? '3px solid #1e40af' : '3px solid transparent', display:'flex', alignItems:'center', borderBottom:'1px solid #f7fafc', transition:'all 0.15s' }} onMouseOver={(e) => { if (selectedUser?.name !== contact.name) e.currentTarget.style.backgroundColor = '#f7fafc'; }} onMouseOut={(e) => { if (selectedUser?.name !== contact.name) e.currentTarget.style.backgroundColor = 'white'; }}>
                        <div style={{ position:'relative', width:'44px', height:'44px', borderRadius:'50%', background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', marginRight:'14px', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'600', fontSize:'16px', flexShrink:0 }}>
                            {contact.name.charAt(0).toUpperCase()}
                            {contact.isOnline && <div style={{ position:'absolute', bottom:'2px', right:'2px', width:'12px', height:'12px', background:'#10b981', borderRadius:'50%', border:'2px solid white' }}></div>}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:'600', color:'#2d3748', fontSize:'14px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{contact.name}</div>
                            <div style={{ fontSize:'12px', color:contact.isOnline ? '#10b981' : '#a0aec0', marginTop:'2px' }}>{contact.isOnline ? '● Online' : '○ Offline'}</div>
                        </div>
                    </div>
                ))}
                {contactList.length === 0 && <div style={{ padding:'40px 20px', textAlign:'center', color:'#a0aec0', fontSize:'14px' }}><div style={{ fontSize:'48px', marginBottom:'12px', opacity:0.5 }}>👥</div><div>No contacts yet</div></div>}
            </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', background:'#fafafa' }}>
            <div style={{ padding:'20px', background:'white', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center' }}>
                {selectedUser ? (<><div style={{ width:'40px', height:'40px', borderRadius:'50%', background:'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'600', marginRight:'14px', fontSize:'16px' }}>{selectedUser.name.charAt(0).toUpperCase()}</div><div><div style={{ fontWeight:'600', fontSize:'15px', color:'#1a202c' }}>{selectedUser.name}</div>{selectedUser.isOnline && <div style={{ fontSize:'12px', color:'#10b981', marginTop:'2px' }}>● Online</div>}</div></>) : <div style={{ color:'#718096', fontSize:'14px' }}>Select a contact to start sharing</div>}
            </div>
            <div style={{ flex:1, padding:'20px', overflowY:'auto' }}>
                {selectedUser ? chatMessages.map((msg, idx) => {
                    const isMe = (msg.type === 'outgoing') || (msg.sender === authData.username);
                    const showProgress = msg.isActive === true; 
                    return (<div key={idx} style={{ display:'flex', justifyContent:isMe ? 'flex-end' : 'flex-start', marginBottom:'16px' }}><div style={{ maxWidth:'65%', minWidth:'280px', background:isMe ? '#eff6ff' : 'white', padding:'14px 16px', borderRadius:'12px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', border:'1px solid #e2e8f0' }}><div style={{ display:'flex', alignItems:'center', marginBottom:'10px' }}><div style={{ fontSize:'28px', marginRight:'12px' }}>📄</div><div style={{ fontWeight:'600', wordBreak:'break-all', fontSize:'14px', color:'#2d3748' }}>{msg.fileName}</div></div>{showProgress ? (<div style={{ marginBottom:'8px' }}><div style={{ width:'100%', height:'8px', background:'#e2e8f0', borderRadius:'4px', overflow:'hidden' }}><div style={{ width:`${msg.progress}%`, height:'100%', background:isMe ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)' : 'linear-gradient(90deg, #1e40af 0%, #1e3a8a 100%)', transition:'width 0.3s ease' }}></div></div><div style={{ fontSize:'12px', marginTop:'6px', display:'flex', justifyContent:'space-between', fontWeight:'500', color:'#4a5568' }}><span>{msg.status}</span><span>{msg.progress}%</span></div></div>) : (<div style={{ fontSize:'12px', color:'#718096', display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'6px' }}><span>{(msg.fileSize / 1024 / 1024).toFixed(2)} MB</span><span style={{ display:'flex', alignItems:'center', gap:'4px' }}>{new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}{isMe && <span style={{ color:'#3b82f6' }}>✓✓</span>}</span></div>)}{(msg.downloadUrl) && <a href={msg.downloadUrl} download={msg.fileName} style={{ display:'block', textAlign:'center', marginTop:'10px', padding:'10px', background:'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)', color:'white', borderRadius:'8px', textDecoration:'none', fontWeight:'600', fontSize:'13px', transition:'transform 0.1s' }} onMouseOver={(e) => e.target.style.transform = 'translateY(-1px)'} onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}>⬇ Download File</a>}</div></div>);
                }) : (<div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#a0aec0', flexDirection:'column' }}><div style={{ fontSize:'64px', marginBottom:'16px', opacity:0.4 }}>📁</div><div style={{ fontSize:'15px', fontWeight:'500' }}>Select a contact to share files</div></div>)}
                <div ref={chatBottomRef} />
            </div>
            {selectedUser && <div style={{ padding:'16px 20px', background:'white', borderTop:'1px solid #e2e8f0', display:'flex', gap:'12px', alignItems:'center' }}><label style={{ cursor:'pointer', background:'#f7fafc', padding:'12px 18px', borderRadius:'8px', border:'1px solid #e2e8f0', display:'flex', alignItems:'center', color:'#4a5568', fontSize:'14px', fontWeight:'500', transition:'all 0.15s', flexShrink:0 }} onMouseOver={(e) => { e.currentTarget.style.background = '#edf2f7'; e.currentTarget.style.borderColor = '#cbd5e0'; }} onMouseOut={(e) => { e.currentTarget.style.background = '#f7fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>📎 <span style={{ marginLeft:'8px' }}>{selectedFile ? (selectedFile.name.length > 20 ? selectedFile.name.substring(0, 20) + '...' : selectedFile.name) : "Choose File"}</span><input type="file" onChange={(e) => setSelectedFile(e.target.files[0])} style={{ display:'none' }} /></label><button onClick={handleSendFile} disabled={!selectedFile || !selectedUser.isOnline} style={{ flex:1, padding:'12px', borderRadius:'8px', border:'none', background:(selectedFile && selectedUser.isOnline) ? 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)' : '#cbd5e0', color:'white', fontWeight:'600', cursor:(selectedFile && selectedUser.isOnline) ? 'pointer' : 'not-allowed', fontSize:'14px', transition:'transform 0.1s' }} onMouseOver={(e) => { if(selectedFile && selectedUser.isOnline) e.target.style.transform = 'translateY(-1px)'; }} onMouseOut={(e) => { e.target.style.transform = 'translateY(0)'; }}>Send ➤</button></div>}
        </div>
        <div style={{ position:'fixed', bottom:'20px', right:'20px', zIndex:9999 }}>{incomingReqs.map((req) => (<IncomingRequest key={req.transferId} req={req} onDecision={handleIncomingDecision} />))}</div>
    </div>
  );
}