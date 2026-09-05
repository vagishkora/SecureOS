import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, User, Palette, Check, ChevronRight, ChevronLeft, Eye, EyeOff, Shield } from 'lucide-react';
import clsx from 'clsx';
import { createUser } from '../kernel/userdb';
import { kernelStore } from '../kernel';
import { useSettingsStore } from '../kernel/settings';

// ── Avatar Options ────────────────────────────────────────────

const AVATARS = ['🧑‍💻', '🧑', '👨', '👩', '🧑‍🎤', '👨‍🎤', '👩‍🎤', '🧑‍🏫', '🤖', '👾', '🦊', '🐱', '🐻', '🦁', '🐼', '🦄'];

// ── Wallpaper Options ─────────────────────────────────────────

const WALLPAPERS = [
  { name: 'Default Grid', url: 'default' },
  { name: 'Cyber City', url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=1920&auto=format&fit=crop' },
  { name: 'Abstract Dark', url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1920&auto=format&fit=crop' },
  { name: 'Neon Wave', url: 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=1920&auto=format&fit=crop' },
];

// ── Props ─────────────────────────────────────────────────────

interface SetupWizardProps {
  onComplete: () => void;
}

// ── Step Components ───────────────────────────────────────────

const StepWelcome: React.FC<{ onNext: () => void }> = ({ onNext }) => (
  <div className="flex flex-col items-center text-center">
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      className="mb-8"
    >
      <Terminal className="w-20 h-20 text-green-500 drop-shadow-[0_0_30px_rgba(34,197,94,0.6)]" />
    </motion.div>

    <h1 className="text-4xl font-mono font-bold text-green-400 tracking-wider mb-3">
      Welcome to SecureOS
    </h1>
    <p className="text-slate-400 text-lg mb-3 max-w-sm">
      A local, secure desktop OS simulator with real security primitives.
    </p>
    <p className="text-slate-600 text-sm mb-10 font-mono">
      Let&apos;s set up your account. It&apos;ll only take a moment.
    </p>

    <div className="flex gap-6 mb-12 text-sm">
      {[['🔐', 'PBKDF2 Auth'], ['📋', 'Audit Log'], ['🗂️', 'Virtual FS']].map(([icon, label]) => (
        <div key={label} className="flex flex-col items-center gap-1.5 text-slate-500">
          <span className="text-2xl">{icon}</span>
          <span className="font-mono text-xs">{label}</span>
        </div>
      ))}
    </div>

    <button
      onClick={onNext}
      className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors font-mono tracking-widest text-sm uppercase"
    >
      Get Started <ChevronRight className="w-4 h-4" />
    </button>
  </div>
);

// ── Step 1: Create Account ────────────────────────────────────

interface AccountData {
  username: string;
  displayName: string;
  avatar: string;
  password: string;
  confirm: string;
}

const StepAccount: React.FC<{
  data: AccountData;
  onChange: (d: AccountData) => void;
  onNext: () => void;
  onBack: () => void;
}> = ({ data, onChange, onNext, onBack }) => {
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  const set = (field: keyof AccountData, value: string) =>
    onChange({ ...data, [field]: value });

  const validate = () => {
    if (!/^[a-z0-9_]{2,20}$/.test(data.username.toLowerCase().trim())) {
      return 'Username must be 2–20 chars: lowercase letters, numbers, underscores.';
    }
    if (data.displayName.trim().length < 1) return 'Display name is required.';
    if (data.password.length < 4) return 'Password must be at least 4 characters.';
    if (data.password !== data.confirm) return 'Passwords do not match.';
    return '';
  };

  const handleNext = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    onNext();
  };

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center gap-3 mb-8">
        <User className="w-6 h-6 text-green-500" />
        <h2 className="text-xl font-mono font-bold text-white">Create Your Account</h2>
      </div>

      {/* Avatar picker */}
      <div className="mb-6">
        <label className="text-xs text-slate-500 font-mono uppercase tracking-widest block mb-3">Choose Avatar</label>
        <div className="grid grid-cols-8 gap-2">
          {AVATARS.map(emoji => (
            <button
              key={emoji}
              onClick={() => set('avatar', emoji)}
              className={clsx(
                'text-2xl rounded-lg p-1.5 transition-all border-2',
                data.avatar === emoji
                  ? 'border-green-500 bg-green-500/20 scale-110'
                  : 'border-slate-800 hover:border-slate-600'
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Username */}
      <div className="mb-4">
        <label className="text-xs text-slate-500 font-mono uppercase tracking-widest block mb-1.5">Username</label>
        <input
          type="text"
          value={data.username}
          onChange={e => set('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          placeholder="e.g. vagish"
          maxLength={20}
          className="w-full bg-black border border-slate-800 focus:border-green-500 text-white px-4 py-2.5 rounded-lg outline-none font-mono text-sm transition-colors placeholder:text-slate-700"
        />
      </div>

      {/* Display Name */}
      <div className="mb-4">
        <label className="text-xs text-slate-500 font-mono uppercase tracking-widest block mb-1.5">Display Name</label>
        <input
          type="text"
          value={data.displayName}
          onChange={e => set('displayName', e.target.value)}
          placeholder="e.g. Vagish"
          maxLength={40}
          className="w-full bg-black border border-slate-800 focus:border-green-500 text-white px-4 py-2.5 rounded-lg outline-none font-mono text-sm transition-colors placeholder:text-slate-700"
        />
      </div>

      {/* Password */}
      <div className="mb-4">
        <label className="text-xs text-slate-500 font-mono uppercase tracking-widest block mb-1.5">Password</label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            value={data.password}
            onChange={e => set('password', e.target.value)}
            placeholder="Min. 4 characters"
            className="w-full bg-black border border-slate-800 focus:border-green-500 text-white px-4 py-2.5 rounded-lg outline-none font-mono text-sm transition-colors placeholder:text-slate-700 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
          >
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Confirm */}
      <div className="mb-6">
        <label className="text-xs text-slate-500 font-mono uppercase tracking-widest block mb-1.5">Confirm Password</label>
        <input
          type="password"
          value={data.confirm}
          onChange={e => set('confirm', e.target.value)}
          placeholder="Re-enter password"
          className="w-full bg-black border border-slate-800 focus:border-green-500 text-white px-4 py-2.5 rounded-lg outline-none font-mono text-sm transition-colors placeholder:text-slate-700"
        />
      </div>

      {error && (
        <div className="mb-4 text-red-400 text-xs font-mono bg-red-950/30 border border-red-900/50 p-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors text-sm font-mono">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={handleNext} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors font-mono text-sm">
          Continue <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ── Step 2: Personalization ───────────────────────────────────

const StepPersonalize: React.FC<{
  onNext: () => void;
  onBack: () => void;
}> = ({ onNext, onBack }) => {
  const wallpaper = useSettingsStore(s => s.wallpaper);
  const setWallpaper = useSettingsStore(s => s.setWallpaper);
  const theme = useSettingsStore(s => s.theme);
  const setTheme = useSettingsStore(s => s.setTheme);

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center gap-3 mb-8">
        <Palette className="w-6 h-6 text-purple-400" />
        <h2 className="text-xl font-mono font-bold text-white">Make It Yours</h2>
      </div>

      {/* Theme */}
      <div className="mb-6">
        <label className="text-xs text-slate-500 font-mono uppercase tracking-widest block mb-3">System Theme</label>
        <div className="flex gap-3">
          {(['dark', 'light'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={clsx(
                'flex-1 py-2.5 rounded-lg border-2 text-sm font-mono capitalize transition-all',
                theme === t
                  ? 'border-green-500 bg-green-500/10 text-green-400'
                  : 'border-slate-800 text-slate-500 hover:border-slate-600'
              )}
            >
              {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
            </button>
          ))}
        </div>
      </div>

      {/* Wallpaper */}
      <div className="mb-8">
        <label className="text-xs text-slate-500 font-mono uppercase tracking-widest block mb-3">Wallpaper</label>
        <div className="grid grid-cols-2 gap-3">
          {WALLPAPERS.map(wp => (
            <button
              key={wp.name}
              onClick={() => setWallpaper(wp.url)}
              className={clsx(
                'relative aspect-video rounded-lg overflow-hidden border-2 transition-all bg-black',
                wallpaper === wp.url ? 'border-green-500 scale-[1.03]' : 'border-slate-800 hover:border-slate-600'
              )}
            >
              {wp.url !== 'default' ? (
                <img src={wp.url} alt={wp.name} className="w-full h-full object-cover opacity-80" />
              ) : (
                <div className="absolute inset-0 opacity-20" style={{
                  backgroundImage: 'linear-gradient(to right, rgba(34,197,94,0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(34,197,94,0.3) 1px, transparent 1px)',
                  backgroundSize: '10px 10px',
                }} />
              )}
              <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                <span className="text-xs font-mono text-white">{wp.name}</span>
              </div>
              {wallpaper === wp.url && (
                <div className="absolute top-1.5 right-1.5 bg-green-500 rounded-full p-0.5 text-black">
                  <Check className="w-3 h-3" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors text-sm font-mono">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={onNext} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors font-mono text-sm">
          Continue <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ── Step 3: All Done ──────────────────────────────────────────

const StepDone: React.FC<{
  account: AccountData;
  onLaunch: () => void;
  isCreating: boolean;
  error: string;
}> = ({ account, onLaunch, isCreating, error }) => (
  <div className="flex flex-col items-center text-center max-w-sm">
    <motion.div
      initial={{ scale: 0, rotate: -90 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      className="mb-6 w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center"
    >
      <Check className="w-10 h-10 text-green-400" />
    </motion.div>

    <h2 className="text-3xl font-mono font-bold text-green-400 mb-3">SecureOS is Ready!</h2>
    <p className="text-slate-400 mb-8">Your secure environment has been configured.</p>

    <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8 text-left space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{account.avatar}</span>
        <div>
          <div className="font-bold text-white">{account.displayName || account.username}</div>
          <div className="text-xs font-mono text-slate-500">@{account.username} · Administrator</div>
        </div>
      </div>
      <div className="border-t border-slate-800 pt-3 space-y-1.5 font-mono text-xs">
        <div className="flex justify-between">
          <span className="text-slate-600">Auth</span>
          <span className="text-green-400">PBKDF2-SHA256 + Random Salt</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Audit Log</span>
          <span className="text-green-400">Hash-Chained (SHA-256)</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Lockout</span>
          <span className="text-green-400">5 attempts → 15 min</span>
        </div>
      </div>
    </div>

    {error && (
      <div className="mb-4 text-red-400 text-xs font-mono bg-red-950/30 border border-red-900/50 p-3 rounded-lg w-full text-left">
        {error}
      </div>
    )}

    <button
      onClick={onLaunch}
      disabled={isCreating}
      className="flex items-center justify-center gap-2 w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-black font-bold rounded-lg transition-colors font-mono uppercase tracking-widest text-sm"
    >
      {isCreating ? (
        <>
          <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          Setting up...
        </>
      ) : (
        <><Shield className="w-4 h-4" /> Launch SecureOS</>
      )}
    </button>
  </div>
);

// ── Main Wizard ───────────────────────────────────────────────

const STEPS = ['Welcome', 'Account', 'Personalize', 'Launch'];

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [account, setAccount] = useState<AccountData>({
    username: '',
    displayName: '',
    avatar: '🧑‍💻',
    password: '',
    confirm: '',
  });

  const handleLaunch = async () => {
    setIsCreating(true);
    setCreateError('');
    try {
      // 1. Create the account
      await createUser(account.username, account.displayName, account.avatar, account.password);
      // 2. Auto-login
      const ok = await kernelStore.getState().login(account.username, account.password);
      if (!ok) throw new Error('Auto-login failed after account creation.');
      // 3. Hand off to Desktop
      onComplete();
    } catch (e: any) {
      setCreateError(e.message ?? 'Something went wrong. Please try again.');
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-auto p-6 z-[99999]">
      {/* Subtle background grid */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'linear-gradient(to right, rgba(34,197,94,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(34,197,94,0.5) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-900/10 via-black to-black pointer-events-none" />

      <div className="relative w-full max-w-lg">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={clsx(
                'flex items-center justify-center w-7 h-7 rounded-full text-xs font-mono font-bold transition-all',
                i < step ? 'bg-green-600 text-black' : i === step ? 'bg-green-500 text-black' : 'bg-slate-900 border border-slate-700 text-slate-600'
              )}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={clsx('h-px flex-1 max-w-8 transition-colors', i < step ? 'bg-green-600' : 'bg-slate-800')} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
            className="flex justify-center"
          >
            {step === 0 && <StepWelcome onNext={() => setStep(1)} />}
            {step === 1 && (
              <StepAccount
                data={account}
                onChange={setAccount}
                onNext={() => setStep(2)}
                onBack={() => setStep(0)}
              />
            )}
            {step === 2 && (
              <StepPersonalize
                onNext={() => setStep(3)}
                onBack={() => setStep(1)}
              />
            )}
            {step === 3 && (
              <StepDone
                account={account}
                onLaunch={handleLaunch}
                isCreating={isCreating}
                error={createError}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
