import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card, FeatureCard } from '../components/Card';
import { EmptyRoomState } from '../components/EmptyState';
import type { HomePageProps } from '../types';

interface Room {
  id: string;
  code: string;
  name: string;
  lastMessage?: string;
  timestamp?: number;
  unread?: number;
}

// Mock rooms for demo - in real app, these would come from props or API
const mockRooms: Room[] = [];

function HomePage({ username, onCreateRoom, onJoinRoom, joinDenied, onJoinDeniedAck }: HomePageProps): JSX.Element {
  const [roomCode, setRoomCode] = useState<string>('');
  const [showJoinForm, setShowJoinForm] = useState<boolean>(false);
  const [isWaiting, setIsWaiting] = useState<boolean>(false);
  const [waitingRoomCode, setWaitingRoomCode] = useState<string>('');

  // Handle join denied - reset waiting state
  useEffect(() => {
    if (joinDenied && isWaiting) {
      setIsWaiting(false);
      setWaitingRoomCode('');
      onJoinDeniedAck?.();
    }
  }, [joinDenied, isWaiting, onJoinDeniedAck]);

  const handleJoin = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (roomCode.trim().length === 6) {
      setWaitingRoomCode(roomCode.trim());
      setIsWaiting(true);
      onJoinRoom(roomCode.trim());
    }
  };

  const handleRoomCodeChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
  };

  const cancelWaiting = () => {
    setIsWaiting(false);
    setWaitingRoomCode('');
    setRoomCode('');
  };

  // Waiting Screen
  if (isWaiting) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          {/* Animated Lock Icon */}
          <div className="relative mb-8">
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute inset-0 bg-indigo-500/20 rounded-full blur-3xl"
            />
            <div className="relative w-24 h-24 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/25">
              <motion.svg 
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="w-12 h-12 text-white" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </motion.svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            Join Request Sent
          </h1>
          <p className="text-slate-400 mb-6">
            Waiting for approval to join room <span className="text-indigo-400 font-mono">{waitingRoomCode}</span>
          </p>

          {/* Loading Dots */}
          <div className="flex justify-center gap-2 mb-8">
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0 }}
              className="w-3 h-3 bg-indigo-500 rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
              className="w-3 h-3 bg-indigo-500 rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
              className="w-3 h-3 bg-indigo-500 rounded-full"
            />
          </div>

          {/* Info Card */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-slate-400 text-left">
                The room owner needs to approve your request. You'll be automatically connected once approved.
              </p>
            </div>
          </div>

          <Button variant="secondary" onClick={cancelWaiting} data-testid="join-cancel-waiting-button">
            Cancel Request
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Logo size="sm" />
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-emerald-400">Encrypted</span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                  {username.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:block text-sm font-medium text-slate-300">{username}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Welcome Section */}
        <div className="mb-6 sm:mb-8">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl sm:text-3xl font-bold text-white mb-2"
          >
            Welcome back, {username}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-slate-400 text-sm sm:text-base"
          >
            Start a new secure conversation or join an existing one.
          </motion.p>
        </div>

        {/* Action Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid sm:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-12"
        >
          <FeatureCard
            icon={<svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
            title="Create New Room"
            description="Start a private encrypted conversation and invite others with a secure room code."
            onClick={onCreateRoom}
            color="indigo"
            data-testid="create-room-button"
          />
          
          <FeatureCard
            icon={<svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>}
            title="Join Room"
            description="Enter a 6-digit room code to join an existing encrypted conversation."
            onClick={() => setShowJoinForm(true)}
            color="green"
            data-testid="open-join-room-modal-button"
          />
        </motion.div>

        {/* Join Room Modal */}
        <AnimatePresence>
          {showJoinForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              data-testid="join-room-modal"
              onClick={() => setShowJoinForm(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 w-full max-w-sm"
              >
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h3 className="text-lg sm:text-xl font-semibold text-white">Join Room</h3>
                  <button 
                    onClick={() => setShowJoinForm(false)}
                    className="text-slate-400 hover:text-white transition-colors p-1"
                    data-testid="join-room-modal-close-button"
                  >
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                
                <form onSubmit={handleJoin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Room Code
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={roomCode}
                        onChange={handleRoomCodeChange}
                        maxLength={6}
                        placeholder="XXXXXX"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 sm:py-4 text-center text-xl sm:text-2xl font-mono tracking-[0.3em] text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all uppercase"
                        autoFocus
                        data-testid="join-room-code-input"
                      />
                      <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                        {roomCode.length}/6
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    type="submit"
                    fullWidth
                    size="lg"
                    disabled={roomCode.length !== 6}
                    data-testid="join-room-submit-button"
                  >
                    Request to Join
                  </Button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Security Info */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4"
        >
          <Card className="p-3 sm:p-4 flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">End-to-End Encrypted</div>
              <div className="text-xs text-slate-400">AES-256 encryption</div>
            </div>
          </Card>
          
          <Card className="p-3 sm:p-4 flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">Zero Knowledge</div>
              <div className="text-xs text-slate-400">We can't read your messages</div>
            </div>
          </Card>
          
          <Card className="p-3 sm:p-4 flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">Instant Delivery</div>
              <div className="text-xs text-slate-400">Real-time messaging</div>
            </div>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}

export default HomePage;
