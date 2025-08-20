import React, { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'

const API_BASE = import.meta.env.VITE_API_BASE;

export default function App() {
  const [view, setView] = useState('home')
  const [roomId, setRoomId] = useState('')
  const [username, setUsername] = useState('')
  const [link, setLink] = useState('')

  const goHome = () => setView('home')

  return (
    <div className="container">
      <header>
        <h2>🧪 Ephemeral Chat</h2>
        <span className="badge">Ephemeral • Private</span>
      </header>

      {view === 'home' && (
        <div className="card">
          <h3>Create or Join a Room</h3>
          <p className="muted">
            When the last person leaves a room, its messages are permanently deleted.
          </p>
          <div className="row">
            <button
              className="btn"
              onClick={async () => {
                try {
                  const res = await fetch(`${API_BASE}/api/rooms`, { method: 'POST' });
                  if (!res.ok) throw new Error('Failed to create room');
                  const data = await res.json();
                  setRoomId(data.roomId);
                  setLink(`${window.location.origin}/chat/${data.roomId}`);
                  setView('chat');
                } catch (error) {
                  console.error(error);
                  alert('Could not create a room. Please try again.');
                }
              }}
            >
              Create Room
            </button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (roomId) setView('chat');
              }}
            >
              <input
                placeholder="Enter Room ID to join"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
              />
            </form>
          </div>
          {link && (
            <p className="muted">
              Share link: <a href={link}>{link}</a>
            </p>
          )}
          <div style={{ marginTop: 16 }}>
            <input
              placeholder="Pick a username (optional)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
        </div>
      )}

      {view === 'chat' && (
        <ChatRoom roomId={roomId} username={username} onExit={goHome} />
      )}
    </div>
  )
}

function ChatRoom({ roomId, username, onExit }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  // --- CORRECTED SOCKET CREATION ---
  // The socket connection should be created only ONCE when the component mounts.
  // It should not depend on roomId. The empty dependency array [] ensures this.
  const socket = useMemo(() => io(API_BASE, { transports: ['websocket'] }), []);

  useEffect(() => {
    // Screenshot deterrents (not foolproof)
    const onKey = (e) => {
      if (e.code === 'PrintScreen') {
        e.preventDefault();
        alert('Screenshots are discouraged on this page.');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!socket) return; // Guard against socket not being ready

    socket.emit('join-room', { roomId, username });

    socket.on('chat-history', (history) => {
      setMessages(history);
    });
    socket.on('chat-message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });
    socket.on('system', (msg) => {
      setMessages((prev) => [
        ...prev,
        {
          _id: Math.random().toString(36).slice(2),
          text: msg.text,
          sender: 'system',
          createdAt: new Date(msg.ts),
          system: true,
        },
      ]);
    });

    // Cleanup function: This will run when the component unmounts
    return () => {
      socket.emit('leave-room');
      socket.off('chat-history'); // It's good practice to remove specific listeners
      socket.off('chat-message');
      socket.off('system');
    };
  }, [roomId, username, socket]);

  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    socket.emit('chat-message', { roomId, text });
    setText('');
  };

  return (
    <div className="card secure-chat-container">
      <div className="secure-overlay" />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <div>
          <div className="muted">Room</div>
          <strong>{roomId}</strong>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn"
            onClick={() => {
              navigator.clipboard.writeText(window.location.origin + '/chat/' + roomId);
            }}
          >
            Copy Link
          </button>
          <button className="btn" onClick={onExit}>
            Exit
          </button>
        </div>
      </div>

      <div className="messages" id="messages">
        {messages.map((m) => (
          <div
            // CORRECTED KEY: Rely on the unique _id from the database.
            key={m._id}
            className={`msg ${m.sender === username ? 'me' : ''} ${
              m.system ? 'system' : ''
            }`}
          >
            {!m.system && (
              <div className="muted" style={{ fontSize: '12px' }}>
                {m.sender}
              </div>
            )}
            <div>{m.text}</div>
          </div>
        ))}
      </div>

      <form onSubmit={send} style={{ marginTop: 12 }}>
        <div className="row">
          <input
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn" type="submit">
            Send
          </button>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          🔒 Ephemeral: When everyone leaves, this room and all messages are deleted from the
          server.
        </p>
      </form>
    </div>
  );
}