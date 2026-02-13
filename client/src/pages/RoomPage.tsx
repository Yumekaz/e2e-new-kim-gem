import React, { useState, useEffect, useRef, FormEvent, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import socket from '../socket';
import { QRCodeCanvas } from 'qrcode.react';
import ConfirmModal from '../components/ConfirmModal';
import FileUpload from '../components/FileUpload';
import MessageAttachment from '../components/MessageAttachment';
import fileService from '../services/fileService';
import { Button, IconButton } from '../components/Button';
import { NoMessagesState } from '../components/EmptyState';
import type { 
  RoomPageProps, 
  DecryptedMessage, 
  SystemMessage, 
  Message, 
  Attachment,
  EncryptedMessage 
} from '../types';

// Extended attachment type with encryption
interface EncryptedAttachmentData extends Attachment {
  encrypted?: boolean;
  iv?: string | null;
  metadata?: string | null;
  decryptedUrl?: string;
}

// Message with possible attachment
interface MessageWithAttachment extends DecryptedMessage {
  attachment?: EncryptedAttachmentData;
}

// Message Bubble Component
function MessageBubble({ 
  message, 
  isOwn, 
  isSystem,
  onContextMenu 
}: { 
  message: MessageWithAttachment | SystemMessage; 
  isOwn: boolean;
  isSystem: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
}): JSX.Element {
  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <span className="text-xs text-slate-500 bg-slate-900/50 px-3 py-1 rounded-full">
          {(message as SystemMessage).text}
        </span>
      </div>
    );
  }

  const msg = message as MessageWithAttachment;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}
      onContextMenu={onContextMenu}
    >
      <div className={`max-w-[75%] group ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isOwn && (
          <span className="text-xs text-slate-500 mb-1 ml-1">{msg.senderUsername}</span>
        )}
        <div
          className={`
            relative px-4 py-2.5 rounded-2xl cursor-context-menu
            ${isOwn 
              ? 'bg-indigo-600 text-white rounded-br-md' 
              : 'bg-slate-800 text-slate-200 rounded-bl-md border border-slate-700/50'
            }
          `}
        >
          <p className="text-sm leading-relaxed">{msg.text}</p>
          
          {msg.attachment && (
            <div className="mt-2">
              <MessageAttachment attachment={msg.attachment} />
            </div>
          )}
          
          {isOwn && msg.decrypted && (
            <div className="flex items-center gap-1 mt-1 justify-end">
              <svg className="w-3 h-3 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Typing Indicator
function TypingIndicator({ users }: { users: string[] }): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="flex items-center gap-2 text-slate-500 text-sm mb-4"
    >
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>{users.join(', ')} {users.length === 1 ? 'is' : 'are'} typing...</span>
    </motion.div>
  );
}

// Delete Menu Component
function DeleteMenu({ 
  messageId,
  onDeleteForEveryone, 
  onDeleteForMe, 
  onCancel,
  position 
}: { 
  messageId: string;
  onDeleteForEveryone: () => void;
  onDeleteForMe: () => void;
  onCancel: () => void;
  position: { x: number; y: number };
}): JSX.Element {
  // Calculate adjusted position to keep menu on screen
  const menuWidth = 200;
  const menuHeight = 140;
  const padding = 10;
  
  const adjustedX = Math.min(position.x, window.innerWidth - menuWidth - padding);
  const adjustedY = Math.min(position.y, window.innerHeight - menuHeight - padding);
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{ 
        position: 'fixed',
        left: Math.max(padding, adjustedX),
        top: Math.max(padding, adjustedY),
        zIndex: 9999
      }}
      className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden min-w-[180px]"
    >
      <button
        onClick={onDeleteForEveryone}
        className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Delete for everyone
      </button>
      <button
        onClick={onDeleteForMe}
        className="w-full px-4 py-3 text-left text-sm text-amber-400 hover:bg-amber-500/10 flex items-center gap-2 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
        Delete for me
      </button>
      <button
        onClick={onCancel}
        className="w-full px-4 py-3 text-left text-sm text-slate-400 hover:bg-slate-800 flex items-center gap-2 transition-colors border-t border-slate-800"
      >
        Cancel
      </button>
    </motion.div>
  );
}

function RoomPage({
  roomId,
  roomCode,
  username,
  isOwner,
  encryption,
  onUpdateRoomKey,
  onLeave,
  roomType = 'legacy'
}: RoomPageProps): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [showMembers, setShowMembers] = useState<boolean>(false);
  const [showRoomInfo, setShowRoomInfo] = useState<boolean>(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState<boolean>(false);
  const [fingerprint, setFingerprint] = useState<string>('');
  const [serverUrl, setServerUrl] = useState<string>('');
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);
  const [isBlurred, setIsBlurred] = useState<boolean>(false);
  const [screenshotWarning, setScreenshotWarning] = useState<string | null>(null);
  const [deleteMenu, setDeleteMenu] = useState<{ messageId: string; position: { x: number; y: number } } | null>(null);
  const [deletedMessageIds, setDeletedMessageIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevMessagesLengthRef = useRef<number>(0);
  const userHasScrolledRef = useRef<boolean>(false);
  const screenshotTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Screenshot detection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        notifyScreenshot();
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        setTimeout(async () => {
          try {
            if (navigator.clipboard && navigator.clipboard.read) {
              const items = await navigator.clipboard.read();
              for (const item of items) {
                if (item.types.some(type => type.includes('image'))) {
                  notifyScreenshot();
                  break;
                }
              }
            }
          } catch (err) {}
        }, 100);
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            notifyScreenshot();
            break;
          }
        }
      }
    };

    const notifyScreenshot = () => {
      if (socket.connected && roomId) {
        socket.emit('screenshot-detected', { roomId });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('paste', handlePaste);
    };
  }, [roomId]);

  // Screenshot warning listener
  useEffect(() => {
    const handleScreenshotWarning = ({ username: detectedUser }: { username: string; timestamp: number }) => {
      const warning = `⚠️ ${detectedUser} took a screenshot`;
      setScreenshotWarning(warning);
      
      setMessages(prev => [...prev, {
        type: 'system',
        text: `⚠️ ${detectedUser} took a screenshot`,
        timestamp: Date.now()
      } as SystemMessage]);
      
      if (screenshotTimeoutRef.current) {
        clearTimeout(screenshotTimeoutRef.current);
      }
      screenshotTimeoutRef.current = setTimeout(() => {
        setScreenshotWarning(null);
      }, 5000);
    };
    
    socket.on('screenshot-warning', handleScreenshotWarning);
    return () => {
      socket.off('screenshot-warning', handleScreenshotWarning);
    };
  }, []);

  // Blur on unfocus
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsBlurred(document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Message deletion handlers
  const handleDeleteForEveryone = useCallback((messageId: string) => {
    socket.emit('delete-message-everyone', { roomId, messageId });
    setDeleteMenu(null);
  }, [roomId]);

  const handleDeleteForMe = useCallback((messageId: string) => {
    socket.emit('delete-message-me', { roomId, messageId });
    setDeletedMessageIds(prev => new Set(prev).add(messageId));
    setDeleteMenu(null);
  }, [roomId]);

  useEffect(() => {
    socket.on('message-deleted', ({ messageId, deletedBy, mode }: { messageId: string; deletedBy: string; mode: string }) => {
      if (mode === 'everyone') {
        setMessages(prev => prev.filter(msg => (msg as DecryptedMessage).id !== messageId));
        setMessages(prev => [...prev, {
          type: 'system',
          text: `🗑️ ${deletedBy} deleted a message`,
          timestamp: Date.now()
        } as SystemMessage]);
      } else if (mode === 'me' && deletedBy === username) {
        setDeletedMessageIds(prev => new Set(prev).add(messageId));
      }
    });

    return () => {
      socket.off('message-deleted');
    };
  }, [username]);

  // Handle message context menu
  const handleMessageContextMenu = (e: React.MouseEvent, messageId: string, senderUsername: string) => {
    e.preventDefault();
    if (senderUsername === username) {
      setDeleteMenu({ messageId, position: { x: e.clientX, y: e.clientY } });
    }
  };

  // Decrypt attachment
  const decryptAttachment = async (attachment: EncryptedAttachmentData): Promise<string | null> => {
    if (!attachment.encrypted || !attachment.iv || !attachment.metadata) {
      return attachment.url;
    }
    try {
      const encryptedBlob = await fileService.downloadEncryptedFile(attachment.url);
      const decrypted = await encryption.decryptFile(encryptedBlob, attachment.iv, attachment.metadata);
      return URL.createObjectURL(decrypted.blob);
    } catch (error) {
      console.error('Failed to decrypt attachment:', error);
      return null;
    }
  };

  useEffect(() => {
    encryption.getFingerprint().then(setFingerprint);
    fetch('/api/network-info')
      .then(res => res.json())
      .then(data => setServerUrl(data.url))
      .catch(() => setServerUrl(window.location.origin));

    socket.emit('join-room', { roomId });

    socket.on('room-data', async ({ members: roomMembers, memberKeys, encryptedMessages }) => {
      setMembers(roomMembers);
      await onUpdateRoomKey(memberKeys);
      
      const decrypted = await Promise.all(
        encryptedMessages.map(async (msg: EncryptedMessage) => {
          const text = await encryption.decrypt(msg.encryptedData, msg.iv);
          let decryptedAttachment: EncryptedAttachmentData | undefined;
          if ((msg as any).attachment) {
            const att = (msg as any).attachment as EncryptedAttachmentData;
            if (att.encrypted) {
              const decryptedUrl = await decryptAttachment(att);
              decryptedAttachment = { ...att, decryptedUrl: decryptedUrl || undefined };
            } else {
              decryptedAttachment = att;
            }
          }
          return {
            ...msg,
            text: text || '🔒 Could not decrypt',
            decrypted: !!text,
            attachment: decryptedAttachment,
          } as MessageWithAttachment;
        })
      );
      setMessages(decrypted);
    });

    socket.on('new-encrypted-message', async (msg: EncryptedMessage) => {
      const text = await encryption.decrypt(msg.encryptedData, msg.iv);
      let decryptedAttachment: EncryptedAttachmentData | undefined;
      if ((msg as any).attachment) {
        const att = (msg as any).attachment as EncryptedAttachmentData;
        if (att.encrypted) {
          const decryptedUrl = await decryptAttachment(att);
          decryptedAttachment = { ...att, decryptedUrl: decryptedUrl || undefined };
        } else {
          decryptedAttachment = att;
        }
      }
      setMessages(prev => [...prev, {
        ...msg,
        text: text || '🔒 Could not decrypt',
        decrypted: !!text,
        attachment: decryptedAttachment,
      } as MessageWithAttachment]);
    });

    socket.on('user-typing', ({ username: typingUser }: { username: string }) => {
      setTypingUsers(prev => new Set(prev).add(typingUser));
      setTimeout(() => {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(typingUser);
          return newSet;
        });
      }, 3000);
    });

    socket.on('member-joined', ({ username: joinedUser }: { username: string; publicKey: string }) => {
      setMessages(prev => [...prev, {
        type: 'system',
        text: `🔐 ${joinedUser} joined`,
        timestamp: Date.now()
      } as SystemMessage]);
    });

    socket.on('member-left', ({ username: leftUser }: { username: string }) => {
      setMessages(prev => [...prev, {
        type: 'system',
        text: `${leftUser} left`,
        timestamp: Date.now()
      } as SystemMessage]);
    });

    socket.on('members-update', async ({ members: updatedMembers, memberKeys }: { members: string[]; memberKeys: Record<string, string> }) => {
      setMembers(updatedMembers);
      await onUpdateRoomKey(memberKeys);
    });

    return () => {
      socket.off('room-data');
      socket.off('new-encrypted-message');
      socket.off('user-typing');
      socket.off('member-joined');
      socket.off('member-left');
      socket.off('members-update');
    };
  }, [roomId, encryption, onUpdateRoomKey]);

  useEffect(() => {
    const hasNewMessages = messages.length > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;
    if (hasNewMessages && !userHasScrolledRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!inputText.trim()) return;

    try {
      const { encryptedData, iv } = await encryption.encrypt(inputText.trim());
      socket.emit('send-encrypted-message', {
        roomId,
        encryptedData,
        iv,
        senderUsername: username
      });
      setInputText('');
    } catch (error) {
      console.error('Encryption failed:', error);
    }
  };

  const handleTyping = (): void => {
    socket.emit('typing', { roomId });
  };

  const handleFileUploaded = async (attachment: Attachment): Promise<void> => {
    try {
      const { encryptedData, iv } = await encryption.encrypt('Attachment');
      socket.emit('send-encrypted-message', {
        roomId,
        encryptedData,
        iv,
        senderUsername: username,
        attachmentId: attachment.id,
      });
    } catch (error) {
      console.error('Failed to send attachment message:', error);
    }
  };

  const isSystemMessage = (msg: Message): msg is SystemMessage => {
    return (msg as SystemMessage).type === 'system';
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      {/* Header */}
      <header className="h-14 sm:h-16 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl flex items-center px-3 sm:px-4 gap-2 sm:gap-4 z-10">
        <IconButton onClick={() => setShowLeaveConfirm(true)} className="!w-9 !h-9 sm:!w-10 sm:!h-10" data-testid="room-leave-open-button">
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </IconButton>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-white text-sm sm:text-base truncate">Room {roomCode}</h1>
            {roomType === 'authenticated' ? (
              <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30 flex-shrink-0">
                Verified
              </span>
            ) : (
              <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30 flex-shrink-0">
                Guest
              </span>
            )}
          </div>
          <p className="text-[10px] sm:text-xs text-slate-500">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1">
          {/* Info Button */}
          <IconButton onClick={() => setShowRoomInfo(true)} variant="ghost" title="Room Info" className="!w-9 !h-9 sm:!w-10 sm:!h-10" data-testid="room-info-open-button">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </IconButton>
          
          {/* Members Button */}
          <IconButton onClick={() => setShowMembers(true)} variant="ghost" title="Members" className="!w-9 !h-9 sm:!w-10 sm:!h-10" data-testid="room-members-open-button">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </IconButton>
        </div>
      </header>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-2"
        data-testid="room-message-list"
      >
        {messages.length === 0 ? (
          <NoMessagesState roomName={`Room ${roomCode}`} />
        ) : (
          <>
            <div className="flex justify-center mb-6">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                <svg className="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-xs text-indigo-400">End-to-end encrypted</span>
              </div>
            </div>
            
            {messages.map((msg, index) => {
              const msgId = (msg as DecryptedMessage).id;
              const isDeleted = deletedMessageIds.has(msgId);
              if (isDeleted && !isSystemMessage(msg)) return null;
              
              return (
                <MessageBubble
                  key={msgId || index}
                  message={msg as MessageWithAttachment}
                  isOwn={!isSystemMessage(msg) && (msg as DecryptedMessage).senderUsername === username}
                  isSystem={isSystemMessage(msg)}
                  onContextMenu={(e) => {
                    if (!isSystemMessage(msg) && (msg as DecryptedMessage).senderUsername === username) {
                      handleMessageContextMenu(e, msgId, (msg as DecryptedMessage).senderUsername);
                    }
                  }}
                />
              );
            })}
            
            <AnimatePresence>
              {typingUsers.size > 0 && (
                <TypingIndicator users={Array.from(typingUsers)} />
              )}
            </AnimatePresence>
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-2 sm:p-4 border-t border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
        <div className="flex items-center gap-2 max-w-4xl mx-auto">
          <div className="flex-shrink-0">
            <FileUpload
              roomId={roomId}
              onFileUploaded={handleFileUploaded}
              disabled={uploadingFile}
              encryptFile={async (file) => encryption.encryptFile(file)}
            />
          </div>
          
          <div className="flex-1 relative min-w-0">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleTyping}
              placeholder="Type a message..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              data-testid="room-message-input"
            />
          </div>
          
          <Button
            type="submit"
            disabled={!inputText.trim()}
            className="!px-3 sm:!px-4 !py-2 sm:!py-2.5 flex-shrink-0"
            data-testid="room-send-button"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </Button>
        </div>
      </form>

      {/* Delete Menu */}
      <AnimatePresence>
        {deleteMenu && (
          <>
            {/* Backdrop to close on click outside */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998]"
              onClick={() => setDeleteMenu(null)}
            />
            <DeleteMenu
              messageId={deleteMenu.messageId}
              position={deleteMenu.position}
              onDeleteForEveryone={() => handleDeleteForEveryone(deleteMenu.messageId)}
              onDeleteForMe={() => handleDeleteForMe(deleteMenu.messageId)}
              onCancel={() => setDeleteMenu(null)}
            />
          </>
        )}
      </AnimatePresence>

      {/* Members Sidebar */}
      <AnimatePresence>
        {showMembers && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              onClick={() => setShowMembers(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-80 bg-slate-900 border-l border-slate-800 z-50"
              data-testid="room-members-panel"
            >
              <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-800 h-14 sm:h-16">
                <h2 className="font-semibold text-white text-sm sm:text-base">Members ({members.length})</h2>
                <IconButton onClick={() => setShowMembers(false)} variant="ghost" className="!w-9 !h-9" data-testid="room-members-close-button">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </IconButton>
              </div>
              
              <div className="p-2">
                {members.map((member) => (
                  <div key={member} className="flex items-center gap-3 p-2 sm:p-3 rounded-xl hover:bg-slate-800/50 transition-colors">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm sm:text-base flex-shrink-0">
                      {member.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {member}
                        {member === username && <span className="ml-2 text-xs text-slate-500">(you)</span>}
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Room Info Modal */}
      <AnimatePresence>
        {showRoomInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowRoomInfo(false)}
            data-testid="room-info-modal"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
                <h3 className="text-lg font-semibold text-white">Room Information</h3>
                <IconButton onClick={() => setShowRoomInfo(false)} variant="ghost" data-testid="room-info-close-button">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </IconButton>
              </div>

              <div className="p-6 space-y-6">
                {/* Room Code */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Room Code</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-slate-800 px-3 py-2 rounded-lg text-indigo-400 font-mono text-lg tracking-wider">{roomCode}</code>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(roomCode);
                    }}
                    data-testid="room-code-copy-button"
                  >
                    Copy
                  </Button>
                  </div>
                </div>

                {/* Encryption Details */}
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Encryption Details</label>
                  
                  <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Algorithm</span>
                      <span className="text-sm text-white font-medium">AES-256-GCM</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Key Exchange</span>
                      <span className="text-sm text-white font-medium">ECDH P-256</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Your Fingerprint</span>
                      <code className="text-xs text-indigo-400 font-mono">{fingerprint}</code>
                    </div>
                  </div>
                </div>

                {/* QR Code */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Join via Mobile</label>
                  <div className="flex flex-col items-center gap-3">
                    <div className="bg-white p-2 rounded-lg">
                      <QRCodeCanvas
                        value={`${serverUrl || window.location.origin}/?room=${roomCode}`}
                        size={120}
                        level="H"
                      />
                    </div>
                    <p className="text-xs text-slate-500 text-center">
                      Scan this QR code to join the room on your mobile device
                    </p>
                  </div>
                </div>

                {/* Security Note */}
                <div className="flex items-start gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <p className="text-sm text-emerald-400">
                    Messages and files are encrypted end-to-end. The server cannot read them.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leave Confirmation Modal */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowLeaveConfirm(false)}
            data-testid="room-leave-modal"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isOwner ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
                    <svg className={`w-6 h-6 ${isOwner ? 'text-red-400' : 'text-amber-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{isOwner ? 'Close Room?' : 'Leave Room?'}</h3>
                  </div>
                </div>
                
                <p className="text-slate-400 mb-4">
                  {isOwner 
                    ? 'You are the room owner. Leaving will permanently delete all messages and the room.'
                    : 'Are you sure you want to leave this room? You can rejoin with the room code.'
                  }
                </p>

                {isOwner && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
                    <p className="text-sm text-red-400">This action cannot be undone. All data will be permanently deleted.</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button 
                    variant="secondary" 
                    fullWidth
                    onClick={() => setShowLeaveConfirm(false)}
                    data-testid="room-leave-cancel-button"
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="danger" 
                    fullWidth
                    onClick={() => {
                      setShowLeaveConfirm(false);
                      onLeave();
                    }}
                    data-testid="room-leave-confirm-button"
                  >
                    {isOwner ? 'Close Room' : 'Leave'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Blur Overlay */}
      <AnimatePresence>
        {isBlurred && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-[9999] flex items-center justify-center"
            onClick={() => setIsBlurred(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="text-center"
            >
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
                <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Screen Hidden</h2>
              <p className="text-slate-400">Click anywhere to reveal</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screenshot Warning */}
      <AnimatePresence>
        {screenshotWarning && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000]"
          >
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">{screenshotWarning}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screenshot Watermark */}
      <div className="fixed bottom-20 right-2 text-[10px] text-slate-700 text-right pointer-events-none select-none" style={{ transform: 'rotate(-5deg)', opacity: 0.5 }}>
        <div>{username}</div>
        <div>{new Date().toLocaleString()}</div>
      </div>
    </div>
  );
}

export default RoomPage;
