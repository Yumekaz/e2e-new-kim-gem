import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import socket, { reconnectWithAuth } from './socket';
import { RoomEncryption } from './crypto/encryption';
import authService from './services/authService';

// Pages
import AuthPage from './pages/AuthPage';
import UsernamePage from './pages/UsernamePage';
import HomePage from './pages/HomePage';
import RoomPage from './pages/RoomPage';

// Components
import JoinRequestModal from './components/JoinRequestModal';
import Toast from './components/Toast';
import { Logo } from './components/Logo';
import { Button } from './components/Button';

import './styles/app.css';

// Types
import type { AuthUser, JoinRequest, ToastProps } from './types';

type PageType = 'auth' | 'username' | 'home' | 'room';
type EncryptionStatus = 'initializing' | 'ready' | 'error';

interface RoomState {
  roomId: string;
  roomCode: string;
  isOwner: boolean;
  memberKeys: Record<string, string>;
  roomType?: 'legacy' | 'authenticated';
}

function App(): JSX.Element {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(authService.isAuthenticated());
  const [useNewAuth, setUseNewAuth] = useState<boolean>(true);

  // App state
  const [currentPage, setCurrentPage] = useState<PageType>('auth');
  const [username, setUsername] = useState<string>('');
  const [currentRoom, setCurrentRoom] = useState<RoomState | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [toast, setToast] = useState<{ message: string; type: ToastProps['type'] } | null>(null);
  const [encryptionStatus, setEncryptionStatus] = useState<EncryptionStatus>('initializing');
  const [joinDenied, setJoinDenied] = useState<boolean>(false);

  // Refs
  const encryptionRef = useRef<RoomEncryption | null>(null);
  const pendingRoomCodeRef = useRef<string | null>(null);

  // Check for room code in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      pendingRoomCodeRef.current = roomParam;
      if (!authService.isAuthenticated()) {
        setUseNewAuth(false);
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Initialize encryption
  useEffect(() => {
    const initEncryption = async (): Promise<void> => {
      try {
        if (!window.crypto || !window.crypto.subtle) {
          throw new Error('Web Crypto API not available');
        }
        encryptionRef.current = new RoomEncryption();
        await encryptionRef.current.initialize();
        setEncryptionStatus('ready');
      } catch (err) {
        console.error('Encryption init failed:', err);
        setEncryptionStatus('error');
      }
    };
    initEncryption();
  }, []);

  // Check existing auth on mount
  useEffect(() => {
    if (authService.isAuthenticated()) {
      const user = authService.getUser();
      if (user) {
        setUsername(user.username);
        setIsAuthenticated(true);
        setCurrentPage('home');
        reconnectWithAuth();

        const registerOnConnect = () => {
          if (encryptionRef.current && encryptionRef.current.publicKeyExported) {
            socket.emit('register', {
              username: user.username,
              publicKey: encryptionRef.current.publicKeyExported
            });
          }
          socket.off('connect', registerOnConnect);
        };

        const tryRegister = () => {
          if (socket.connected && encryptionRef.current?.publicKeyExported) {
            socket.emit('register', {
              username: user.username,
              publicKey: encryptionRef.current.publicKeyExported
            });
          } else if (!socket.connected) {
            socket.on('connect', registerOnConnect);
          }
        };

        setTimeout(tryRegister, 500);
      }
    } else if (useNewAuth) {
      setCurrentPage('auth');
    } else {
      setCurrentPage('username');
    }
  }, [useNewAuth]);

  // Handle socket connection/reconnection
  useEffect(() => {
    const handleConnect = () => {
      const user = authService.getUser();
      const currentUsername = user?.username || username;

      if (currentUsername && encryptionRef.current?.publicKeyExported) {
        socket.emit('register', {
          username: currentUsername,
          publicKey: encryptionRef.current.publicKeyExported
        });
      }
    };

    socket.on('connect', handleConnect);

    if (socket.connected && username && encryptionRef.current?.publicKeyExported) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
    };
  }, [username, encryptionStatus]);

  // Socket event listeners
  useEffect(() => {
    socket.on('registered', ({ username: acceptedUsername }: { username: string }) => {
      setUsername(acceptedUsername);
      setCurrentPage('home');
      showToast('Secure session started', 'success');

      if (pendingRoomCodeRef.current) {
        handleJoinRoom(pendingRoomCodeRef.current);
        pendingRoomCodeRef.current = null;
      }
    });

    socket.on('username-taken', () => {
      showToast('Username taken. Try another!', 'error');
    });

    socket.on('room-created', async ({ roomId, roomCode, roomType }: { roomId: string; roomCode: string; roomType?: 'legacy' | 'authenticated' }) => {
      if (encryptionRef.current) {
        await encryptionRef.current.setRoomKey(roomCode, [encryptionRef.current.publicKeyExported!]);

        setCurrentRoom({
          roomId,
          roomCode,
          isOwner: true,
          memberKeys: { [username]: encryptionRef.current.publicKeyExported! },
          roomType: roomType || 'legacy'
        });
        setCurrentPage('room');
        showToast(`Room ${roomCode} created`, 'success');
      }
    });

    socket.on('join-request', ({ requestId, username: requesterName, publicKey, roomId }: JoinRequest & { roomId: string }) => {
      setJoinRequests(prev => [...prev, { requestId, username: requesterName, publicKey, roomId }]);
      showToast(`${requesterName} wants to join`, 'info');
    });

    socket.on('join-approved', async ({ roomId, roomCode, roomType, memberKeys }: { roomId: string; roomCode: string; roomType?: 'legacy' | 'authenticated'; memberKeys: Record<string, string> }) => {
      if (encryptionRef.current) {
        await encryptionRef.current.setRoomKey(roomCode, Object.values(memberKeys));

        setCurrentRoom({ roomId, roomCode, isOwner: false, memberKeys, roomType: roomType || 'legacy' });
        setCurrentPage('room');
        showToast('Joined secure room', 'success');
      }
    });

    socket.on('join-denied', () => {
      showToast('Join request denied', 'error');
      setJoinDenied(true);
    });

    socket.on('error', ({ message }: { message: string }) => {
      showToast(message, 'error');
    });

    socket.on('room-closed', () => {
      setCurrentRoom(null);
      setCurrentPage('home');
      showToast('Room was closed by owner', 'error');
    });

    return () => {
      socket.off('registered');
      socket.off('username-taken');
      socket.off('room-created');
      socket.off('join-request');
      socket.off('join-approved');
      socket.off('join-denied');
      socket.off('error');
      socket.off('room-closed');
    };
  }, [username]);

  // Auth handlers
  const handleAuth = async (user: AuthUser): Promise<void> => {
    setUsername(user.username);
    setIsAuthenticated(true);
    reconnectWithAuth();

    const registerAfterConnect = () => {
      if (encryptionStatus === 'ready' && encryptionRef.current && encryptionRef.current.publicKeyExported) {
        socket.emit('register', {
          username: user.username,
          publicKey: encryptionRef.current.publicKeyExported
        });
      }
      socket.off('connect', registerAfterConnect);
    };

    if (socket.connected) {
      registerAfterConnect();
    } else {
      socket.on('connect', registerAfterConnect);
    }
  };

  const handleLogout = async (): Promise<void> => {
    await authService.logout();
    setIsAuthenticated(false);
    setUsername('');
    setCurrentPage('auth');
    setCurrentRoom(null);
    showToast('Logged out successfully', 'success');
  };

  // Legacy username registration
  const handleRegister = async (name: string): Promise<void> => {
    if (encryptionStatus !== 'ready' || !encryptionRef.current || !encryptionRef.current.publicKeyExported) {
      showToast('Encryption initializing...', 'info');
      return;
    }

    socket.emit('register', {
      username: name,
      publicKey: encryptionRef.current.publicKeyExported
    });
  };

  // Room handlers
  const handleCreateRoom = (): void => {
    socket.emit('create-room');
  };

  const handleJoinRoom = (roomCode: string): void => {
    setJoinDenied(false); // Reset denied state for new request
    socket.emit('request-join', { roomCode: roomCode.toUpperCase() });
    showToast('Join request sent...', 'info');
  };

  const handleApproveJoin = async ({ requestId }: { requestId: string }): Promise<void> => {
    socket.emit('approve-join', { requestId });
    setJoinRequests(prev => prev.filter(req => req.requestId !== requestId));
  };

  const handleDenyJoin = (requestId: string): void => {
    socket.emit('deny-join', { requestId });
    setJoinRequests(prev => prev.filter(req => req.requestId !== requestId));
  };

  const handleUpdateRoomKey = async (memberKeys: Record<string, string>): Promise<void> => {
    if (currentRoom && encryptionRef.current) {
      await encryptionRef.current.setRoomKey(currentRoom.roomCode, Object.values(memberKeys));
      setCurrentRoom(prev => prev ? { ...prev, memberKeys } : null);
    }
  };

  const handleLeaveRoom = (): void => {
    if (currentRoom) {
      socket.emit('leave-room', { roomId: currentRoom.roomId });
    }
    setCurrentRoom(null);
    setCurrentPage('home');
  };

  const showToast = (message: string, type: ToastProps['type']): void => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const toggleAuthMode = (): void => {
    setUseNewAuth(!useNewAuth);
    setCurrentPage(useNewAuth ? 'username' : 'auth');
  };

  // Encryption Error Screen
  if (encryptionStatus === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Security Feature Restricted</h1>
          <p className="text-slate-400 mb-6">
            This app uses Web Crypto API for end-to-end encryption. Modern browsers block this API on insecure connections.
          </p>
          <div className="bg-slate-900 rounded-xl p-4 text-left mb-6">
            <h3 className="text-sm font-semibold text-indigo-400 mb-3">How to fix (Chrome/Edge/Brave):</h3>
            <ol className="text-sm text-slate-400 space-y-2 list-decimal list-inside">
              <li>Open: <code className="bg-slate-800 px-2 py-0.5 rounded text-slate-300">chrome://flags/#unsafely-treat-insecure-origin-as-secure</code></li>
              <li>Enable the flag</li>
              <li>Add: <code className="text-indigo-400">{window.location.origin}</code></li>
              <li>Relaunch browser</li>
            </ol>
          </div>
          <Button onClick={() => window.location.reload()} fullWidth>
            Reload App
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Encryption Status Indicator - Hidden on room page */}
      {currentPage !== 'room' && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur border border-slate-800" data-testid="encryption-indicator">
          <span className={`w-2 h-2 rounded-full ${encryptionStatus === 'ready' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
          <span className="text-xs font-medium text-slate-400">
            {encryptionStatus === 'ready' ? 'Encrypted' : 'Initializing...'}
          </span>
          {isAuthenticated && (
            <button 
              onClick={handleLogout}
              className="ml-2 p-1 hover:bg-slate-800 rounded-lg transition-colors"
              title="Logout"
              data-testid="logout-button"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {currentPage === 'auth' && useNewAuth && (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AuthPage onAuth={handleAuth} encryptionReady={encryptionStatus === 'ready'} />
          </motion.div>
        )}

        {currentPage === 'username' && !useNewAuth && (
          <motion.div
            key="username"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <UsernamePage onRegister={handleRegister} encryptionReady={encryptionStatus === 'ready'} />
          </motion.div>
        )}

        {currentPage === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <HomePage
              username={username}
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
              joinDenied={joinDenied}
              onJoinDeniedAck={() => setJoinDenied(false)}
            />
          </motion.div>
        )}

        {currentPage === 'room' && currentRoom && encryptionRef.current && (
          <motion.div
            key="room"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-screen"
          >
            <RoomPage
              roomId={currentRoom.roomId}
              roomCode={currentRoom.roomCode}
              username={username}
              isOwner={currentRoom.isOwner}
              encryption={encryptionRef.current}
              onUpdateRoomKey={handleUpdateRoomKey}
              onLeave={handleLeaveRoom}
              roomType={currentRoom.roomType}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Join Request Modal */}
      {joinRequests.length > 0 && (
        <JoinRequestModal
          requests={joinRequests}
          onApprove={handleApproveJoin}
          onDeny={handleDenyJoin}
        />
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 20, x: 20 }}
            className="fixed bottom-4 right-4 z-[9999]"
          >
            <Toast message={toast.message} type={toast.type} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dev toggle for auth mode */}
      {(currentPage === 'auth' || currentPage === 'username') && (
        <button
          onClick={toggleAuthMode}
          className="fixed bottom-4 right-4 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-400 bg-slate-900/50 hover:bg-slate-800/50 rounded-lg border border-slate-800 transition-colors"
        >
          {useNewAuth ? 'Use Legacy Mode' : 'Use Auth Mode'}
        </button>
      )}
    </div>
  );
}

export default App;
