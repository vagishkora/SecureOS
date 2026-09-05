import React, { useState, useEffect } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { useStore } from 'zustand';
import { AppDefinition } from '../registry';
import { kernelStore } from '../../kernel';
import { useSettingsStore } from '../../kernel/settings';
import { getUser, changePassword, updateProfile } from '../../kernel/userdb';
import type { UserRecord } from '../../kernel/userdb';
import { Monitor, Cpu, User, Image as ImageIcon, Check, Shield, RefreshCw, Eye, EyeOff, Key, Save, Edit3 } from 'lucide-react';
import clsx from 'clsx';

const APP_ID = 'settings';

const WALLPAPERS = [
  { name: 'Default Grid', url: 'default' },
  { name: 'Cyber City', url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=1920&auto=format&fit=crop' },
  { name: 'Abstract Dark', url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1920&auto=format&fit=crop' },
  { name: 'Neon Wave', url: 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=1920&auto=format&fit=crop' },
];

const ACCOUNT_AVATARS = ['🧑‍💻', '🧑', '👨', '👩', '🧑‍🎤', '👨‍🎤', '👩‍🎤', '🧑‍🏫', '🤖', '👾', '🦊', '🐱', '🐻', '🦁', '🐼', '🦄'];

const SettingsApp = () => {
  const [activeTab, setActiveTab] = useState<'personalization' | 'system' | 'account' | 'privacy' | 'update' | 'apps' | 'network'>('personalization');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  
  const wallpaper = useSettingsStore((state) => state.wallpaper);
  const setWallpaper = useSettingsStore((state) => state.setWallpaper);
  
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  
  const idleTimeout = useSettingsStore((state) => state.idleTimeout);
  const setIdleTimeout = useSettingsStore((state) => state.setIdleTimeout);
  
  const notifsEnabled = useSettingsStore((state) => state.notificationsEnabled);
  const setNotifsEnabled = useSettingsStore((state) => state.setNotificationsEnabled);

  const [customUrl, setCustomUrl] = useState('');

  // ── Account Management ─────────────────────────────────────
  const currentUsername = useStore(kernelStore, (s) => s.currentUser);
  const [userRecord, setUserRecord] = useState<UserRecord | null>(null);
  const [editAvatar, setEditAvatar] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [pwForm, setPwForm] = useState({ old: '', new_: '', confirm: '' });
  const [pwShowOld, setPwShowOld] = useState(false);
  const [pwShowNew, setPwShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwStatus, setPwStatus] = useState<'' | 'success' | 'error'>('');
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    if (!currentUsername) { setUserRecord(null); return; }
    getUser(currentUsername).then((u) => {
      if (!u) return;
      setUserRecord(u);
      setEditAvatar(u.avatar);
      setEditDisplayName(u.displayName);
    });
  }, [currentUsername]);

  const handleSaveProfile = async () => {
    if (!currentUsername) return;
    setProfileSaving(true);
    try {
      await updateProfile(currentUsername, { displayName: editDisplayName, avatar: editAvatar });
      const updated = await getUser(currentUsername);
      if (updated) {
        setUserRecord(updated);
        setEditAvatar(updated.avatar);
        setEditDisplayName(updated.displayName);
      }
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 2500);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentUsername) return;
    setPwStatus(''); setPwError('');
    if (pwForm.new_.length < 4) {
      setPwStatus('error'); setPwError('New password must be at least 4 characters.'); return;
    }
    if (pwForm.new_ !== pwForm.confirm) {
      setPwStatus('error'); setPwError('New passwords do not match.'); return;
    }
    setPwSaving(true);
    try {
      const result = await changePassword(currentUsername, pwForm.old, pwForm.new_);
      if (result === 'success') {
        setPwStatus('success');
        setPwForm({ old: '', new_: '', confirm: '' });
        setTimeout(() => setPwStatus(''), 3000);
      } else if (result === 'wrong_password') {
        setPwStatus('error'); setPwError('Current password is incorrect.');
      } else {
        setPwStatus('error'); setPwError('Account not found. Please refresh.');
      }
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="h-full w-full dark:bg-slate-950 bg-slate-50 dark:text-slate-300 text-slate-800 flex font-sans">
      {/* Sidebar */}
      <div className="w-48 dark:bg-black bg-slate-200 border-r dark:border-slate-800 border-slate-300 flex flex-col pt-4">
        <button
          onClick={() => setActiveTab('personalization')}
          className={clsx(
            "text-left px-4 py-3 text-sm font-medium transition-colors",
            activeTab === 'personalization' ? "dark:bg-slate-900 bg-white dark:text-white text-black border-l-2 border-green-500" : "dark:text-slate-500 text-slate-500 dark:hover:text-slate-300 hover:text-slate-700"
          )}
        >
          Personalization
        </button>
        <button
          onClick={() => setActiveTab('apps')}
          className={clsx(
            "text-left px-4 py-3 text-sm font-medium transition-colors",
            activeTab === 'apps' ? "dark:bg-slate-900 bg-white dark:text-white text-black border-l-2 border-green-500" : "dark:text-slate-500 text-slate-500 dark:hover:text-slate-300 hover:text-slate-700"
          )}
        >
          Apps & Features
        </button>
        <button
          onClick={() => setActiveTab('network')}
          className={clsx(
            "text-left px-4 py-3 text-sm font-medium transition-colors",
            activeTab === 'network' ? "dark:bg-slate-900 bg-white dark:text-white text-black border-l-2 border-green-500" : "dark:text-slate-500 text-slate-500 dark:hover:text-slate-300 hover:text-slate-700"
          )}
        >
          Network & Internet
        </button>
        <button
          onClick={() => setActiveTab('privacy')}
          className={clsx(
            "flex items-center gap-3 px-4 py-3 text-sm transition-colors",
            activeTab === 'privacy' ? "bg-slate-900 text-green-400 border-l-2 border-green-500" : "hover:bg-slate-900/50 hover:text-white dark:text-slate-500 text-slate-500"
          )}
        >
          <Shield className="w-4 h-4" /> Privacy & Security
        </button>
        <button
          onClick={() => setActiveTab('update')}
          className={clsx(
            "flex items-center gap-3 px-4 py-3 text-sm transition-colors",
            activeTab === 'update' ? "bg-slate-900 text-green-400 border-l-2 border-green-500" : "hover:bg-slate-900/50 hover:text-white dark:text-slate-500 text-slate-500"
          )}
        >
          <RefreshCw className="w-4 h-4" /> Windows Update
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={clsx(
            "flex items-center gap-3 px-4 py-3 text-sm transition-colors",
            activeTab === 'system' ? "bg-slate-900 text-green-400 border-l-2 border-green-500" : "hover:bg-slate-900/50 hover:text-white"
          )}
        >
          <Cpu className="w-4 h-4" /> System Info
        </button>
        <button
          onClick={() => setActiveTab('account')}
          className={clsx(
            "flex items-center gap-3 px-4 py-3 text-sm transition-colors",
            activeTab === 'account' ? "bg-slate-900 text-green-400 border-l-2 border-green-500" : "hover:bg-slate-900/50 hover:text-white"
          )}
        >
          <User className="w-4 h-4" /> Account
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-8 overflow-auto">
        {activeTab === 'personalization' && (
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold dark:text-white text-black mb-6">Personalization</h2>
            
            {/* Theme Toggle */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold dark:text-slate-400 text-slate-500 mb-3">System Theme</h3>
              <div className="flex gap-4">
                <button
                  onClick={() => setTheme('light')}
                  className={clsx(
                    "px-4 py-2 rounded border transition-all",
                    theme === 'light' ? "border-green-500 bg-green-500/10 text-green-700 font-medium" : "dark:border-slate-800 border-slate-300 hover:border-green-500/50"
                  )}
                >
                  Light Mode
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={clsx(
                    "px-4 py-2 rounded border transition-all",
                    theme === 'dark' ? "border-green-500 bg-green-500/10 text-green-400 font-medium" : "dark:border-slate-800 border-slate-300 hover:border-green-500/50"
                  )}
                >
                  Dark Mode
                </button>
              </div>
            </div>

            <h3 className="text-sm font-semibold dark:text-slate-400 text-slate-500 mb-3">Desktop Background</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              {WALLPAPERS.map(wp => (
                <div 
                  key={wp.name}
                  onClick={() => setWallpaper(wp.url)}
                  className={clsx(
                    "cursor-pointer rounded-lg overflow-hidden border-2 transition-all relative aspect-video flex flex-col justify-end bg-black",
                    wallpaper === wp.url ? "border-green-500 scale-[1.02]" : "border-slate-800 hover:border-slate-600"
                  )}
                >
                  {wp.url !== 'default' && (
                    <img src={wp.url} alt={wp.name} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                  )}
                  {wp.url === 'default' && (
                    <div className="absolute inset-0 opacity-20" style={{
                      backgroundImage: `linear-gradient(to right, rgba(34,197,94,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(34,197,94,0.2) 1px, transparent 1px)`,
                      backgroundSize: '20px 20px'
                    }} />
                  )}
                  <div className="relative p-3 bg-gradient-to-t from-black/90 to-transparent">
                    <span className="font-semibold text-sm drop-shadow-md">{wp.name}</span>
                  </div>
                  {wallpaper === wp.url && (
                    <div className="absolute top-3 right-3 bg-green-500 rounded-full p-1 text-black">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mb-4">
              <form 
              onSubmit={(e) => { e.preventDefault(); if (customUrl) setWallpaper(customUrl); }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="Enter image URL..."
                className="flex-1 dark:bg-black bg-white border dark:border-slate-800 border-slate-300 rounded px-3 py-2 text-sm dark:text-white text-black focus:outline-none focus:border-green-500"
              />
              <button 
                type="submit"
                className="px-4 py-2 bg-green-900/50 hover:bg-green-800/80 text-green-400 border border-green-900 rounded text-sm transition-colors"
              >
                Apply
              </button>
            </form>
          </div>
          </div>
        )}

        {activeTab === 'apps' && (
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold dark:text-white text-black mb-6">Installed Apps</h2>
            <div className="flex flex-col gap-4">
              {Array.from(kernelStore.getState().appRegistry.values()).map(app => (
                <div key={app.appId} className="dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 p-4 rounded-lg flex items-center justify-between shadow-sm">
                  <div>
                    <div className="font-bold dark:text-white text-black">{app.name}</div>
                    <div className="text-xs dark:text-slate-500 text-slate-400 font-mono mt-1">{app.appId}</div>
                    {app.capabilities.length > 0 && (
                      <div className="text-xs text-yellow-500 mt-2">
                        Granted Capabilities: {app.capabilities.join(', ')}
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => kernelStore.getState().uninstallApp(app.appId)}
                    className="px-3 py-1.5 border border-red-500/50 text-red-500 rounded hover:bg-red-500/10 transition-colors text-sm font-medium"
                  >
                    Uninstall
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'network' && (
          <div className="max-w-xl">
            <h2 className="text-2xl font-bold dark:text-white text-black mb-6">Network & Internet</h2>
            <div className="dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 rounded-lg p-6 mb-8 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <div className="w-6 h-6 border-t-2 border-r-2 border-blue-500 rounded-tr-full" />
                </div>
                <div>
                  <div className="font-bold dark:text-white text-black text-lg">Nexus_Secure_Net</div>
                  <div className="text-sm text-green-500">Connected, secured</div>
                </div>
              </div>
              <div className="space-y-3 pt-4 border-t dark:border-slate-800 border-slate-200 text-sm font-mono dark:text-slate-300 text-slate-600">
                <div className="flex justify-between"><span>IPv4 address:</span> <span>192.168.1.104</span></div>
                <div className="flex justify-between"><span>DNS server:</span> <span>1.1.1.1</span></div>
                <div className="flex justify-between"><span>Link speed:</span> <span>1000/1000 (Mbps)</span></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="max-w-xl">
            <h2 className="text-2xl font-bold dark:text-white text-black mb-6">System & Security</h2>
            
            <div className="dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 rounded-lg p-6 space-y-4 font-mono text-sm mb-8">
              <div className="flex justify-between border-b dark:border-slate-800 border-slate-200 pb-2">
                <span className="dark:text-slate-500 text-slate-400">OS Edition</span>
                <span className="dark:text-white text-black">SecureOS Pro</span>
              </div>
              <div className="flex justify-between border-b dark:border-slate-800 border-slate-200 pb-2">
                <span className="dark:text-slate-500 text-slate-400">Kernel Version</span>
                <span className="dark:text-white text-black">v1.0.0-rc</span>
              </div>
              <div className="flex justify-between border-b dark:border-slate-800 border-slate-200 pb-2">
                <span className="dark:text-slate-500 text-slate-400">Architecture</span>
                <span className="dark:text-white text-black">Capability-Based Microkernel</span>
              </div>
            </div>

            {/* Real Hardware Specs */}
            <h3 className="text-sm font-semibold dark:text-slate-400 text-slate-500 mb-3">Hardware Specifications</h3>
            <div className="dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 rounded-lg p-6 space-y-4 font-mono text-sm mb-8">
              <div className="flex justify-between border-b dark:border-slate-800 border-slate-200 pb-2">
                <span className="dark:text-slate-500 text-slate-400">Logical Processors</span>
                <span className="dark:text-white text-black">{navigator.hardwareConcurrency || 'Unknown'} Cores</span>
              </div>
              <div className="flex justify-between border-b dark:border-slate-800 border-slate-200 pb-2">
                <span className="dark:text-slate-500 text-slate-400">System Memory (RAM)</span>
                <span className="dark:text-white text-black">
                  {/* @ts-ignore */}
                  {navigator.deviceMemory ? `${navigator.deviceMemory} GB (Allocated)` : 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between border-b dark:border-slate-800 border-slate-200 pb-2">
                <span className="dark:text-slate-500 text-slate-400">Host Environment</span>
                <span className="dark:text-white text-black max-w-[250px] text-right truncate" title={navigator.userAgent}>
                  {navigator.userAgent}
                </span>
              </div>
            </div>

            {/* Security Policies */}
            <h3 className="text-sm font-semibold dark:text-slate-400 text-slate-500 mb-3">Security Policies</h3>
            <div className="dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 rounded-lg p-6 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold dark:text-white text-black">Idle Lock Timeout</div>
                  <div className="text-xs dark:text-slate-500 text-slate-400">Lock the system after inactivity</div>
                </div>
                <select 
                  value={idleTimeout} 
                  onChange={(e) => setIdleTimeout(Number(e.target.value))}
                  className="dark:bg-black bg-slate-100 border dark:border-slate-800 border-slate-300 rounded p-1 text-sm dark:text-white text-black outline-none focus:border-green-500"
                >
                  <option value={1}>1 Minute</option>
                  <option value={5}>5 Minutes</option>
                  <option value={15}>15 Minutes</option>
                  <option value={0}>Never</option>
                </select>
              </div>
            </div>

            {/* Notifications */}
            <h3 className="text-sm font-semibold dark:text-slate-400 text-slate-500 mb-3">Notifications</h3>
            <div className="dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold dark:text-white text-black">Enable Toast Notifications</div>
                  <div className="text-xs dark:text-slate-500 text-slate-400">Show popups for system alerts</div>
                </div>
                <button 
                  onClick={() => setNotifsEnabled(!notifsEnabled)}
                  className={clsx(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    notifsEnabled ? "bg-green-500" : "bg-slate-400 dark:bg-slate-700"
                  )}
                >
                  <span className={clsx(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    notifsEnabled ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'account' && (
          <div className="max-w-xl space-y-5">
            <h2 className="text-2xl font-bold dark:text-white text-black mb-6">User Account</h2>

            {!userRecord ? (
              <div className="dark:text-slate-600 text-slate-400 font-mono text-sm">Loading account…</div>
            ) : (
              <>
                {/* Profile card */}
                <div className="dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 rounded-lg p-5 flex items-center gap-5">
                  <span className="text-5xl shrink-0">{userRecord.avatar}</span>
                  <div className="min-w-0">
                    <div className="text-xl font-bold dark:text-white text-black truncate">{userRecord.displayName}</div>
                    <div className="text-xs font-mono dark:text-slate-500 text-slate-500 mt-0.5">
                      @{userRecord.username} · <span className="capitalize">{userRecord.role}</span>
                    </div>
                    <div className="text-xs dark:text-slate-600 text-slate-400 mt-1">
                      Member since {new Date(userRecord.createdAt).toLocaleDateString()}
                      {userRecord.lastLoginAt
                        ? ` · Last login ${new Date(userRecord.lastLoginAt).toLocaleDateString()}`
                        : ''}
                    </div>
                  </div>
                </div>

                {/* Edit Profile */}
                <div className="dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 rounded-lg p-5">
                  <h3 className="font-semibold dark:text-white text-black mb-4 flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-green-500" /> Edit Profile
                  </h3>

                  <div className="mb-4">
                    <label className="text-xs dark:text-slate-500 text-slate-500 uppercase tracking-widest font-mono block mb-2">Avatar</label>
                    <div className="grid grid-cols-8 gap-2">
                      {ACCOUNT_AVATARS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => setEditAvatar(emoji)}
                          className={clsx(
                            'text-2xl rounded-lg p-1.5 border-2 transition-all',
                            editAvatar === emoji
                              ? 'border-green-500 bg-green-500/20 scale-110'
                              : 'dark:border-slate-800 border-slate-200 hover:border-green-400/50'
                          )}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-5">
                    <label className="text-xs dark:text-slate-500 text-slate-500 uppercase tracking-widest font-mono block mb-1.5">Display Name</label>
                    <input
                      type="text"
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      maxLength={40}
                      className="w-full dark:bg-black bg-slate-100 border dark:border-slate-800 border-slate-300 rounded px-3 py-2 text-sm dark:text-white text-black outline-none focus:border-green-500 transition-colors"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSaveProfile}
                      disabled={profileSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-green-900/40 hover:bg-green-800/70 disabled:opacity-50 text-green-400 border border-green-900 rounded text-sm transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      {profileSaving ? 'Saving…' : 'Save Profile'}
                    </button>
                    {profileSuccess && (
                      <span className="text-green-400 text-sm font-mono flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Saved!
                      </span>
                    )}
                  </div>
                </div>

                {/* Change Password */}
                <div className="dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 rounded-lg p-5">
                  <h3 className="font-semibold dark:text-white text-black mb-4 flex items-center gap-2">
                    <Key className="w-4 h-4 text-yellow-500" /> Change Password
                  </h3>

                  <div className="space-y-3 mb-4">
                    {/* Current password */}
                    <div>
                      <label className="text-xs dark:text-slate-500 text-slate-500 uppercase tracking-widest font-mono block mb-1.5">Current Password</label>
                      <div className="relative">
                        <input
                          type={pwShowOld ? 'text' : 'password'}
                          value={pwForm.old}
                          onChange={(e) => setPwForm((f) => ({ ...f, old: e.target.value }))}
                          className="w-full dark:bg-black bg-slate-100 border dark:border-slate-800 border-slate-300 rounded px-3 py-2 text-sm dark:text-white text-black outline-none focus:border-green-500 pr-10 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setPwShowOld((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 dark:text-slate-600 text-slate-400 hover:text-slate-300"
                        >
                          {pwShowOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* New password */}
                    <div>
                      <label className="text-xs dark:text-slate-500 text-slate-500 uppercase tracking-widest font-mono block mb-1.5">New Password</label>
                      <div className="relative">
                        <input
                          type={pwShowNew ? 'text' : 'password'}
                          value={pwForm.new_}
                          onChange={(e) => setPwForm((f) => ({ ...f, new_: e.target.value }))}
                          className="w-full dark:bg-black bg-slate-100 border dark:border-slate-800 border-slate-300 rounded px-3 py-2 text-sm dark:text-white text-black outline-none focus:border-green-500 pr-10 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setPwShowNew((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 dark:text-slate-600 text-slate-400 hover:text-slate-300"
                        >
                          {pwShowNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm new password */}
                    <div>
                      <label className="text-xs dark:text-slate-500 text-slate-500 uppercase tracking-widest font-mono block mb-1.5">Confirm New Password</label>
                      <input
                        type="password"
                        value={pwForm.confirm}
                        onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                        className="w-full dark:bg-black bg-slate-100 border dark:border-slate-800 border-slate-300 rounded px-3 py-2 text-sm dark:text-white text-black outline-none focus:border-green-500 transition-colors"
                      />
                    </div>
                  </div>

                  {pwStatus === 'error' && (
                    <p className="text-red-400 text-xs font-mono mb-3 bg-red-950/30 border border-red-900/50 p-2.5 rounded">
                      {pwError}
                    </p>
                  )}
                  {pwStatus === 'success' && (
                    <p className="text-green-400 text-xs font-mono mb-3 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" /> Password updated successfully.
                    </p>
                  )}

                  <button
                    onClick={handleChangePassword}
                    disabled={pwSaving || !pwForm.old || !pwForm.new_ || !pwForm.confirm}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-900/30 hover:bg-yellow-800/50 disabled:opacity-40 text-yellow-400 border border-yellow-900/50 rounded text-sm transition-colors"
                  >
                    <Key className="w-4 h-4" />
                    {pwSaving ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="max-w-xl">
            <h2 className="text-2xl font-bold dark:text-white text-black mb-6">Privacy & Security</h2>
            
            <div className="space-y-6">
              <div className="dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 rounded-lg p-6">
                <h3 className="font-bold dark:text-white text-black mb-2 flex items-center gap-2"><Shield className="w-4 h-4 text-green-500" /> Windows Security</h3>
                <p className="text-sm dark:text-slate-400 text-slate-500 mb-4">Your device is protected by SecureOS Defender. No action needed.</p>
                <div className="flex justify-between items-center py-2 border-b dark:border-slate-800 border-slate-100 text-sm">
                  <span className="dark:text-slate-300 text-slate-700">Virus & threat protection</span>
                  <span className="text-green-500 font-bold">Active</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b dark:border-slate-800 border-slate-100 text-sm">
                  <span className="dark:text-slate-300 text-slate-700">Firewall & network protection</span>
                  <span className="text-green-500 font-bold">Active</span>
                </div>
                <div className="flex justify-between items-center py-2 text-sm">
                  <span className="dark:text-slate-300 text-slate-700">App & browser control</span>
                  <span className="text-green-500 font-bold">Active</span>
                </div>
              </div>
              
              <div className="dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 rounded-lg p-6">
                <h3 className="font-bold dark:text-white text-black mb-2">Diagnostic Data</h3>
                <p className="text-sm dark:text-slate-400 text-slate-500 mb-4">Send optional diagnostic data to help improve SecureOS.</p>
                <div className="flex items-center gap-4">
                  <input type="radio" id="diag-req" name="diag" defaultChecked className="accent-green-500" />
                  <label htmlFor="diag-req" className="text-sm dark:text-slate-300 text-slate-700">Required diagnostic data only</label>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <input type="radio" id="diag-opt" name="diag" className="accent-green-500" disabled />
                  <label htmlFor="diag-opt" className="text-sm dark:text-slate-500 text-slate-400">Optional diagnostic data (Disabled by policy)</label>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'update' && (
          <div className="max-w-xl">
            <h2 className="text-2xl font-bold dark:text-white text-black mb-6">Windows Update</h2>
            <div className="dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 rounded-lg p-6 flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <RefreshCw className={clsx("w-12 h-12 text-blue-500", isUpdating && "animate-spin")} />
                <div>
                  <h3 className="text-xl font-bold dark:text-white text-black">
                    {isUpdating ? 'Downloading updates...' : 'You\'re up to date'}
                  </h3>
                  <p className="text-sm dark:text-slate-400 text-slate-500">
                    Last checked: Today, {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              
              {isUpdating ? (
                <div className="w-full bg-slate-800 rounded-full h-2.5 mb-4 overflow-hidden">
                  <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${updateProgress}%` }}></div>
                </div>
              ) : (
                <button 
                  onClick={() => {
                    setIsUpdating(true);
                    setUpdateProgress(0);
                    let progress = 0;
                    const interval = setInterval(() => {
                      progress += Math.random() * 15;
                      if (progress >= 100) {
                        progress = 100;
                        clearInterval(interval);
                        setTimeout(() => setIsUpdating(false), 500);
                      }
                      setUpdateProgress(progress);
                    }, 500);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded self-start transition-colors font-medium text-sm"
                >
                  Check for updates
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const roots = new Map<string, Root>();

export const Settings: AppDefinition = {
  manifest: {
    appId: 'settings',
    name: 'Settings',
    icon: 'Settings',
    capabilities: [],
  },
  mount: (container, windowId) => {
    const root = createRoot(container);
    roots.set(windowId, root);
    root.render(<SettingsApp />);
  },
  unmount: (container, windowId) => {
    const root = roots.get(windowId);
    if (root) {
      root.unmount();
      roots.delete(windowId);
    }
  }
};
