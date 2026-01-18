import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = `http://${window.location.hostname}:5000`;

const socket = io(SOCKET_URL, {
    reconnection: true,
    reconnectionAttempts: 10,
    transports: ['websocket'] // Force high-speed transport
});

// 🚀 TURBO SETTINGS
const CHUNK_SIZE = 3 * 1024 * 1024; // 3MB (Best balance for Speed vs. RAM)
const MAX_WINDOW_SIZE = 32;         // Allows ~100MB in-flight on 5GHz/Ethernet

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [myID, setMyID] = useState('');
  const [users, setUsers] = useState({});
  const [myName, setMyName] = useState(localStorage.getItem('userName') || `User-${Math.floor(Math.random() * 1000)}`);

  const [file, setFile] = useState(null);
  const fileRef = useRef(null); 
  
  // Sender State
  const senderRef = useRef({ 
      active: false, offset: 0, receiverId: null, totalSize: 0, 
      windowSize: 1, chunksInFlight: 0, lastAckTime: 0
  });

  const [request, setRequest] = useState(null);
  const [downloadLink, setDownloadLink] = useState(null);
  const [status, setStatus] = useState(""); 
  const [progress, setProgress] = useState(0);

  // 🛡️ Integrity Bucket
  const incomingFile = useRef({ 
      fileName: null, 
      fileSize: 0, 
      chunkMap: new Map(), // Stores actual data blocks
      receivedBytes: 0 
  });

  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (f) { setFile(f); fileRef.current = f; }
  };

  useEffect(() => {
    if (!localStorage.getItem('userName')) {
      const input = prompt("Enter Display Name:", myName);
      if (input) { setMyName(input); localStorage.setItem('userName', input); }
    }

    socket.on('connect', () => { 
        setIsConnected(true); 
        setMyID(socket.id); 
        socket.emit('join', localStorage.getItem('userName') || myName); 
    });
    
    socket.on('disconnect', () => { setIsConnected(false); setUsers({}); });
    socket.on('users_update', (u) => setUsers(u));
    socket.on('incoming_request', (d) => setRequest(d));
    socket.on('user_offline', () => { alert("User Offline"); setStatus(""); });

    socket.on('request_response', (data) => {
      if (data.accepted) {
        setStatus("🚀 Initializing High-Speed Transfer...");
        setTimeout(() => startAdaptiveSend(data.from), 50);
      } else {
        alert("Rejected.");
      }
    });

    socket.on('ack_received', (data) => {
        if (!senderRef.current.active) return;
        
        const now = Date.now();
        const timeDiff = now - senderRef.current.lastAckTime;
        
        // 🚀 Speed Scaling: Ramp up window size aggressively on fast networks
        if (timeDiff < 250) {
             senderRef.current.windowSize = Math.min(senderRef.current.windowSize + 2, MAX_WINDOW_SIZE); 
        } else if (timeDiff > 600) {
             senderRef.current.windowSize = Math.max(senderRef.current.windowSize - 1, 1);
        }

        senderRef.current.lastAckTime = now;
        senderRef.current.chunksInFlight--;
        pumpPipeline(); 
    });

    socket.on('receive_chunk', (data) => {
        if (!incomingFile.current.fileName) return;

        // 1. Store Chunk (Idempotent: Overwriting is fine)
        incomingFile.current.chunkMap.set(data.offset, data.chunk);
        
        // 2. ACK IMMEDIATELY (Keep the pipe full)
        socket.emit('window_ack', { to: data.from, offset: data.offset });

        // 3. 🛡️ CALCULATE REAL PROGRESS (Summing actual bytes in memory)
        // We do NOT use a counter anymore. We count what we actually have.
        // This prevents the "Size Mismatch" error.
        let totalReceived = 0;
        for (const chunk of incomingFile.current.chunkMap.values()) {
            totalReceived += chunk.byteLength;
        }
        
        const pct = Math.floor((totalReceived / data.total) * 100);
        
        // Update UI (Throttle to save CPU)
        if (pct % 5 === 0 || pct >= 100) { 
             setProgress(pct);
             setStatus(`Downloading ${pct}%...`);
        }
        
        // 4. CHECK COMPLETION
        if (totalReceived >= incomingFile.current.fileSize) {
            finalizeFile();
        }
    });

    // Fallback: If Sender says "Done" but we are missing bytes, we do NOT finish.
    socket.on('transfer_completed', () => {
        let totalReceived = 0;
        for (const chunk of incomingFile.current.chunkMap.values()) {
            totalReceived += chunk.byteLength;
        }
        
        if (totalReceived >= incomingFile.current.fileSize) {
             finalizeFile();
        } else {
             setStatus(`Sender finished, but verifying data... (${Math.floor((totalReceived/incomingFile.current.fileSize)*100)}%)`);
        }
    });

    return () => { 
        socket.off('connect'); socket.off('ack_received'); 
        socket.off('receive_chunk'); socket.off('transfer_completed'); 
    };
  }, []);

  const finalizeFile = () => {
      if (downloadLink) return; // Already finished
      
      setStatus("🧩 Reassembling...");
      setTimeout(() => {
          // Sort chunks by offset to ensure file integrity
          const sortedChunks = Array.from(incomingFile.current.chunkMap.entries())
                                    .sort((a, b) => a[0] - b[0])
                                    .map(entry => entry[1]);

          const blob = new Blob(sortedChunks);
          
          if (blob.size !== incomingFile.current.fileSize) {
              // This should theoretically be unreachable now
              setStatus(`Verification Error: Missing ${incomingFile.current.fileSize - blob.size} bytes.`);
              return;
          }

          const url = URL.createObjectURL(blob);
          setDownloadLink({ url, name: incomingFile.current.fileName });
          setStatus("Transfer Verified ✅");
          setProgress(100);
          
          // Cleanup RAM
          incomingFile.current.chunkMap.clear(); 
      }, 50);
  };

  const sendRequest = (id) => {
    if (!fileRef.current) return alert("Select file first");
    setDownloadLink(null);
    incomingFile.current = { fileName: null, fileSize: 0, chunkMap: new Map(), receivedBytes: 0 };
    socket.emit('request_transfer', { to: id, senderName: myName, fileName: fileRef.current.name, fileSize: fileRef.current.size });
    setStatus("Waiting...");
  };

  const startAdaptiveSend = (receiverId) => {
    const f = fileRef.current;
    if (!f) return;
    
    senderRef.current = {
        active: true, offset: 0, receiverId: receiverId, totalSize: f.size,
        windowSize: 2, chunksInFlight: 0, lastAckTime: Date.now()
    };
    pumpPipeline();
  };

  const pumpPipeline = () => {
      const { totalSize, windowSize } = senderRef.current;
      while (
          senderRef.current.active && 
          senderRef.current.chunksInFlight < windowSize && 
          senderRef.current.offset < totalSize
      ) {
          const { offset, receiverId } = senderRef.current;
          const f = fileRef.current;
          const isLastChunk = (offset + CHUNK_SIZE >= totalSize);
          const chunkBlob = f.slice(offset, offset + CHUNK_SIZE);
          readAndSend(chunkBlob, offset, receiverId, totalSize, isLastChunk);
          senderRef.current.offset += CHUNK_SIZE;
          senderRef.current.chunksInFlight++;
      }
  };

  const readAndSend = (blob, offset, receiverId, totalSize, isLastChunk) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          if (!senderRef.current.active) return;
          
          socket.emit('file_chunk', {
              from: socket.id, to: receiverId, chunk: e.target.result, offset: offset, total: totalSize
          });

          if (isLastChunk) {
              socket.emit('transfer_completed', {
                  sender: myName, receiver: users[receiverId], receiverId: receiverId,
                  fileName: fileRef.current.name, fileSize: fileRef.current.size
              });
              senderRef.current.active = false; 
          }

          const pct = Math.round((offset / totalSize) * 100);
          if (pct % 5 === 0) {
            const speedIndicator = senderRef.current.windowSize > 5 ? "⚡ Turbo" : "🟢 Stable";
            setProgress(pct);
            setStatus(`Sending ${pct}% (${speedIndicator})`);
          }
      };
      reader.readAsArrayBuffer(blob);
  };

  const handleResponse = (accepted) => {
    socket.emit('response_transfer', { to: request.from, accepted });
    if (accepted) {
      setStatus("Waiting for data..."); setProgress(0); setDownloadLink(null);
      incomingFile.current = { fileName: request.fileName, fileSize: request.fileSize, chunkMap: new Map(), receivedBytes: 0 };
    }
    setRequest(null);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ padding: '10px', background: isConnected ? '#d4edda' : '#f8d7da', marginBottom: '20px', textAlign:'center', borderRadius:'5px' }}>
        <strong>{isConnected ? "CONNECTED" : "DISCONNECTED"}</strong><br/>
        <small>{window.location.hostname}</small>
      </div>

      <h2 style={{textAlign:'center'}}>LAN Share (Turbo & Verified)</h2>
      <p style={{textAlign:'center'}}>I am: <strong>{myName}</strong></p>

      <div style={{background:'#f8f9fa', padding:'20px', borderRadius:'10px', textAlign:'center', marginBottom:'20px'}}>
        <h3>Step 1: Choose File</h3>
        <input type="file" onChange={handleFileSelect} />
        {file && <p style={{color:'blue'}}>{file.name} ({(file.size/1024/1024).toFixed(1)} MB)</p>}
      </div>

      <div style={{textAlign:'center'}}>
        <h3>Step 2: Send</h3>
        {Object.entries(users).map(([id, name]) => id !== myID && (
           <button key={id} onClick={() => sendRequest(id)} style={{margin:'5px', padding:'10px', background:'#007bff', color:'white', border:'none', borderRadius:'5px'}}>
             Send to {name}
           </button>
        ))}
      </div>

      {status && (
        <div style={{marginTop:'30px', padding:'20px', border:'2px solid orange', borderRadius:'10px', textAlign:'center'}}>
          <h3>{status}</h3>
          <div style={{background:'#eee', height:'20px', borderRadius:'10px', width:'100%'}}>
             <div style={{background:'orange', width:`${progress}%`, height:'100%', borderRadius:'10px', transition:'width 0.1s'}}></div>
          </div>
        </div>
      )}

      {downloadLink && (
        <div style={{marginTop:'20px', padding:'20px', background:'#d4edda', textAlign:'center', borderRadius:'10px'}}>
          <h3>Download Ready</h3>
          <a href={downloadLink.url} download={downloadLink.name} style={{background:'green', color:'white', padding:'15px 30px', textDecoration:'none', borderRadius:'5px', fontWeight:'bold', fontSize:'18px'}}>
             ⬇️ Save Verified File
          </a>
        </div>
      )}

      {request && (
        <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center'}}>
           <div style={{background:'white', padding:'30px', borderRadius:'10px', textAlign:'center'}}>
              <h3>Incoming File</h3>
              <p>{request.fileName}</p>
              <button onClick={() => handleResponse(true)} style={{background:'green', color:'white', padding:'10px', marginRight:'10px'}}>Accept</button>
              <button onClick={() => handleResponse(false)} style={{background:'red', color:'white', padding:'10px'}}>Reject</button>
           </div>
        </div>
      )}
    </div>
  );
}

export default App;