import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { JoinRequestModalProps, JoinRequest } from '../types';

function JoinRequestModal({ requests, onApprove, onDeny }: JoinRequestModalProps): JSX.Element | null {
  if (requests.length === 0) return null;

  const handleApprove = (request: JoinRequest): void => {
    onApprove({ requestId: request.requestId });
  };

  const handleDeny = (request: JoinRequest): void => {
    onDeny(request.requestId);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-full sm:max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-[100] overflow-hidden"
      data-testid="join-request-modal"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-800">
        <h3 className="font-semibold text-white text-sm">Join Requests ({requests.length})</h3>
      </div>

      {/* Request List */}
      <div className="max-h-[300px] overflow-y-auto">
        {requests.map((request) => (
          <div 
            key={request.requestId} 
            className="flex items-center justify-between px-4 py-3 border-b border-slate-800/50 last:border-b-0 hover:bg-slate-800/30"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                {request.username.charAt(0).toUpperCase()}
              </div>
              
              {/* User Info */}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white text-sm truncate">{request.username}</p>
                <p className="text-xs text-slate-500 font-mono truncate" title={request.publicKey}>
                  🔑 {request.publicKey.substring(0, 20)}...
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
              <button
                onClick={() => handleApprove(request)}
                className="w-8 h-8 flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg transition-colors"
                title="Approve"
                data-testid={`approve-join-${request.requestId}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button
                onClick={() => handleDeny(request)}
                className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-red-500 hover:text-white text-slate-400 rounded-lg transition-colors"
                title="Deny"
                data-testid={`deny-join-${request.requestId}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default JoinRequestModal;
