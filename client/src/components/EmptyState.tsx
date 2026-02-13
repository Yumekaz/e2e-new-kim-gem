import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 min-h-[400px]">
      <div className="w-20 h-20 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-6">
        <div className="text-slate-400">
          {icon}
        </div>
      </div>
      
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 max-w-sm mb-8 leading-relaxed">{description}</p>
      
      <div className="flex flex-col sm:flex-row gap-3">
        {action && (
          <Button onClick={action.onClick}>
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button variant="secondary" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}

interface EmptyRoomStateProps {
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}

export function EmptyRoomState({ onCreateRoom, onJoinRoom }: EmptyRoomStateProps): JSX.Element {
  return (
    <EmptyState
      icon={
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      }
      title="No active conversations"
      description="Start a new secure conversation or join an existing one with a room code."
      action={{ label: 'Create Room', onClick: onCreateRoom }}
      secondaryAction={{ label: 'Join Room', onClick: onJoinRoom }}
    />
  );
}

interface NoMessagesStateProps {
  roomName: string;
}

export function NoMessagesState({ roomName }: NoMessagesStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 py-16">
      <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      
      <h3 className="text-lg font-medium text-white mb-1">Welcome to {roomName}</h3>
      <p className="text-slate-400 text-sm max-w-xs">
        This is the beginning of your encrypted conversation. Messages are end-to-end encrypted.
      </p>
    </div>
  );
}
