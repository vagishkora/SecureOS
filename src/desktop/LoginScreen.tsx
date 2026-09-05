import React, { useState, useEffect } from 'react';
import { useStore } from 'zustand';
import { kernelStore } from '../kernel';
import { listUsers, getLockoutRemainingMinutes } from '../kernel/userdb';
import type { UserRecord } from '../kernel/userdb';
import { ShieldAlert, Terminal, Lock, ChevronRight } from 'lucide-react';
import { playErrorSound } from '../kernel/audio';

export const LoginScreen: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockoutMins, setLockoutMins] = useState(0);

  const failedAttempts = useStore(kernelStore, (state) => state.failedAttempts);
  const isLockedOut = failedAttempts >= 5;

  // Load users on mount
  useEffect(() => {
    listUsers().then((us) => {
      setUsers(us);
      if (us.length === 1) setSelectedUser(us[0] ?? null);
    });
  }, []);

  // Refresh lockout countdown
  useEffect(() => {
    if (!selectedUser || !isLockedOut) { setLockoutMins(0); return; }
    const refresh = () =>
      getLockoutRemainingMinutes(selectedUser.username).then(setLockoutMins);
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [selectedUser, isLockedOut]);

  useEffect(() => {
    if (failedAttempts > 0) playErrorSound();
  }, [failedAttempts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isLockedOut || !selectedUser) return;
    setLoading(true);
    await kernelStore.getState().login(selectedUser.username, password);
    setLoading(false);
    setPassword('');
  };

  const handleSelectUser = (user: UserRecord) => {
    setSelectedUser(user);
    setPassword('');
    // reset kernel failed attempts display when switching user
    kernelStore.setState({ failedAttempts: 0 });
  };

  // ── User Picker (multi-user) ─────────────────────────────────
  if (!selectedUser && users.length > 1) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black z-[99999]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-900/20 via-black to-black opacity-80 pointer-events-none" />
        <div className="relative flex flex-col items-center">
          <Terminal className="w-12 h-12 text-green-500 mb-6 drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]" />
          <h1 className="text-2xl font-mono text-green-500 tracking-[0.2em] uppercase mb-8">SecureOS</h1>
          <p className="text-slate-600 font-mono text-xs mb-6 uppercase tracking-widest">Select account</p>
          <div className="flex flex-wrap justify-center gap-4 max-w-md">
            {users.map((u) => (
              <button
                key={u.username}
                onClick={() => handleSelectUser(u)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-800 hover:border-green-700 bg-slate-950 hover:bg-green-950/20 transition-all group w-28"
              >
                <span className="text-4xl group-hover:scale-110 transition-transform">{u.avatar}</span>
                <div className="text-sm font-semibold text-white">{u.displayName}</div>
                <div className="text-xs text-slate-600 font-mono">{u.role}</div>
              </button>
            ))}
          </div>
          <div className="mt-12 text-[10px] text-green-900/50 font-mono tracking-widest text-center">
            ALL ACCESS ATTEMPTS ARE AUDITED
          </div>
        </div>
      </div>
    );
  }

  // ── Password Screen ──────────────────────────────────────────
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black selection:bg-green-500/30 z-[99999]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-900/20 via-black to-black opacity-80 pointer-events-none" />

      <div className="relative w-full max-w-sm p-8 flex flex-col items-center">
        {/* Avatar / Icon */}
        <div className="mb-6 relative flex items-center justify-center">
          {selectedUser ? (
            <span className="text-6xl drop-shadow-[0_0_20px_rgba(34,197,94,0.4)]">
              {selectedUser.avatar}
            </span>
          ) : (
            <Terminal className="w-16 h-16 text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]" />
          )}
          {isLockedOut && (
            <ShieldAlert className="w-8 h-8 text-red-500 absolute -bottom-2 -right-2 animate-pulse" />
          )}
        </div>

        {/* Name */}
        <h1 className="text-xl font-mono text-white font-bold mb-1 text-center">
          {selectedUser ? selectedUser.displayName : 'SecureOS'}
        </h1>
        {selectedUser && (
          <p className="text-xs text-slate-600 font-mono mb-6 tracking-widest uppercase">
            @{selectedUser.username} · {selectedUser.role}
          </p>
        )}

        {isLockedOut ? (
          <div className="text-red-500 font-mono text-center mb-6 mt-2 border border-red-500/30 bg-red-500/10 p-4 rounded-lg w-full">
            <div className="font-bold mb-1">ACCOUNT LOCKED</div>
            <div className="text-xs">Too many failed attempts.</div>
            {lockoutMins > 0 && (
              <div className="text-xs mt-2 text-red-400">Try again in ~{lockoutMins} minute{lockoutMins > 1 ? 's' : ''}.</div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full">
            <div className="relative mb-3">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-700" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                placeholder="ENTER PASSWORD"
                className="w-full bg-black border border-green-900 focus:border-green-500 text-green-400 placeholder:text-green-900/50 px-10 py-3 rounded outline-none font-mono tracking-widest text-sm transition-colors"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={!password || loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-green-900/40 hover:bg-green-800/60 disabled:opacity-40 border border-green-900 text-green-400 font-mono text-sm rounded transition-colors uppercase tracking-widest"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-green-600/30 border-t-green-400 rounded-full animate-spin" />
              ) : (
                <><ChevronRight className="w-4 h-4" /> Sign In</>
              )}
            </button>

            {failedAttempts > 0 && (
              <div className="mt-3 text-red-400 font-mono text-xs text-center animate-pulse">
                ACCESS DENIED. {5 - failedAttempts} ATTEMPT{5 - failedAttempts !== 1 ? 'S' : ''} REMAINING.
              </div>
            )}
          </form>
        )}

        {/* Switch user link (only when multiple users exist) */}
        {users.length > 1 && (
          <button
            onClick={() => { setSelectedUser(null); setPassword(''); kernelStore.setState({ failedAttempts: 0 }); }}
            className="mt-6 text-slate-700 hover:text-slate-400 font-mono text-xs transition-colors uppercase tracking-widest"
          >
            ← Switch User
          </button>
        )}

        <div className="mt-8 text-[10px] text-green-900/50 font-mono text-center tracking-widest">
          AUTHORIZED PERSONNEL ONLY
          <br />
          ALL ACCESS ATTEMPTS ARE AUDITED
        </div>
      </div>
    </div>
  );
};
