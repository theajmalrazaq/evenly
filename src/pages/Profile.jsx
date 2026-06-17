import React, { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../config/supabase'
import Navbar from '../components/Navbar'
import Toast from '../components/Toast'
import LoadingPulseOverlay from '../components/Loading'
import { User, CreditCard, PiggyBank, Edit2, LogOut, Check, Save } from 'lucide-react'
import { PAKISTANI_PLATFORMS, getPlatformIcon } from '../utils/platforms'

const AVAILABLE_AVATARS = [
  '💸', '💰', '💳', '🚀', '🌟', '🦄', '🐯', '🦊', '🦁', '🐼', '🐨', '🎯', '🥑', '🍔', '👾', '🚀'
]

export default function Profile() {
  const { user, profile, wallet, fetchProfile, signOut } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Edit details states
  const [fullName, setFullName] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState('')
  const [monthlyBudget, setMonthlyBudget] = useState('')

  // Wallet details states
  const [nayapay, setNayapay] = useState('')
  const [sadapay, setSadapay] = useState('')
  const [easypaisa, setEasypaisa] = useState('')
  const [jazzcash, setJazzcash] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [accountTitle, setAccountTitle] = useState('')
  const [iban, setIban] = useState('')
  const [bankName, setBankName] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState('')

  // Sync state with global auth context
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setSelectedAvatar(profile.avatar_url || AVAILABLE_AVATARS[0])
      setMonthlyBudget(profile.monthly_budget || '')
    }
    if (wallet) {
      setNayapay(wallet.nayapay_number || '')
      setSadapay(wallet.sadapay_number || '')
      setEasypaisa(wallet.easypaisa_number || '')
      setJazzcash(wallet.jazzcash_number || '')
      setBankAccount(wallet.bank_account_number || '')
      setAccountTitle(wallet.account_title || '')
      setIban(wallet.iban || '')
      setBankName(wallet.bank_name || '')
    }
  }, [profile, wallet])

  // Save changes handler
  const handleSave = async (e) => {
    e.preventDefault()
    if (!fullName.trim()) {
      setError('Full Name is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // 1. Update Profile (including budget)
      const { error: profError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          avatar_url: selectedAvatar,
          monthly_budget: monthlyBudget ? Number(monthlyBudget) : 0,
          updated_at: new Date()
        })
        .eq('id', user.id)

      if (profError) throw profError

      // 2. Update Wallet
      const { error: walletError } = await supabase
        .from('wallets')
        .update({
          nayapay_number: nayapay.trim() || null,
          sadapay_number: sadapay.trim() || null,
          easypaisa_number: easypaisa.trim() || null,
          jazzcash_number: jazzcash.trim() || null,
          bank_account_number: bankAccount.trim() || null,
          account_title: accountTitle.trim() || null,
          iban: iban.trim() || null,
          bank_name: bankName.trim() || null,
          updated_at: new Date()
        })
        .eq('user_id', user.id)

      if (walletError) throw walletError

      // 3. Refresh Profile state globally
      await fetchProfile(user.id)
      setSuccess('Profile and wallet details updated successfully!')
    } catch (err) {
      console.error('Save profile error:', err)
      setError(err.message || 'Failed to update profile details')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Toast show={!!error} message={error} type="error" onClose={() => setError(null)} duration={3500} />
      <Toast show={!!success} message={success} type="success" onClose={() => setSuccess(null)} duration={3500} />

      {loading && <LoadingPulseOverlay />}

      <div className="min-h-screen bg-black text-white px-4 py-8 pb-28 font-figtree">
        <div className="max-w-7xl mx-auto">
          
          {/* Title and Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-black text-white grad">Profile Settings</h1>
              <p className="text-xs text-neutral-400">View and update your personal and financial credentials</p>
            </div>
            <button
              onClick={() => signOut()}
              className="text-neutral-500 hover:text-red-400 p-2.5 bg-neutral-900 border border-neutral-800 rounded-full transition cursor-pointer"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* User Identity Preview Card */}
          <div className="relative overflow-hidden bg-neutral-900/30 border border-neutral-800/80 rounded-[2rem] p-6 mb-8 flex items-center gap-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl pointer-events-none"></div>
            <div className="w-16 h-16 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-4xl shadow-inner shadow-black/40 flex-shrink-0">
              {selectedAvatar}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">{profile?.full_name}</h2>
              <p className="text-xs text-accent">@{profile?.username}</p>
              <p className="text-[10px] text-neutral-500 mt-1">{user?.email}</p>
            </div>
          </div>

          {/* Edit Form */}
          <form onSubmit={handleSave}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              
              {/* Left Column: Avatar & Profile Info */}
              <div className="space-y-6">
                
                {/* Avatar selection */}
                <div className="bg-neutral-900/15 border border-neutral-800/60 rounded-3xl p-5 space-y-3">
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                    Update Avatar Emoji
                  </label>
                  <div className="grid grid-cols-8 gap-2 bg-black/40 p-3 rounded-2xl border border-neutral-800">
                    {AVAILABLE_AVATARS.map((avatar, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedAvatar(avatar)}
                        className={`text-2xl p-1 rounded-lg hover:bg-neutral-800 transition ${
                          selectedAvatar === avatar ? 'bg-accent/20 border border-accent/40 scale-110' : 'border border-transparent'
                        }`}
                      >
                        {avatar}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Core Settings */}
                <div className="bg-neutral-900/15 border border-neutral-800/60 rounded-3xl p-5 space-y-4">
                  <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-accent" /> Profile Information
                  </h3>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 ml-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your name"
                      className="w-full bg-black border border-neutral-850 focus:border-accent text-white px-4 py-3 rounded-xl text-sm outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 ml-1">
                      Monthly Spending Budget Limit (Rs.)
                    </label>
                    <input
                      type="number"
                      value={monthlyBudget}
                      onChange={(e) => setMonthlyBudget(e.target.value)}
                      placeholder="e.g. 25000"
                      min="0"
                      className="w-full bg-black border border-neutral-850 focus:border-accent text-white px-4 py-3 rounded-xl text-sm outline-none"
                    />
                    <p className="text-[9px] text-neutral-500 mt-1 ml-1">
                      Leave empty or 0 to disable warnings. Limits are compared in the Spending tab.
                    </p>
                  </div>
                </div>

              </div>

              {/* Right Column: Wallets & Save Button */}
              <div className="space-y-6">
                
                {/* Wallet Settings */}
                <div className="bg-neutral-900/15 border border-neutral-800/60 rounded-3xl p-5 space-y-4">
                  <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                    <CreditCard className="w-4 h-4 text-accent" /> Wallet / Payment Methods
                  </h3>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 ml-1">
                      Configure / Add Payment Platform
                    </label>
                    <select
                      value={selectedPlatform}
                      onChange={(e) => {
                        const platId = e.target.value
                        setSelectedPlatform(platId)
                        const plat = PAKISTANI_PLATFORMS.find(p => p.id === platId)
                        if (plat && plat.type === 'bank') {
                          setBankName(plat.name)
                        }
                      }}
                      className="w-full bg-black border border-neutral-850 focus:border-accent text-white px-4 py-3 rounded-xl text-sm outline-none cursor-pointer"
                    >
                      <option value="">-- Select Wallet or Bank --</option>
                      <optgroup label="Mobile Wallets & Digital Accounts">
                        {PAKISTANI_PLATFORMS.filter(p => p.type === 'wallet').map(p => (
                          <option key={p.id} value={p.id}>
                            {getPlatformIcon(p.id)} {p.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Commercial Banks">
                        {PAKISTANI_PLATFORMS.filter(p => p.type === 'bank').map(p => (
                          <option key={p.id} value={p.id}>
                            🏦 {p.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  {/* Contextual Input Fields */}
                  {selectedPlatform && (
                    <div className="bg-black/30 p-4 rounded-2xl border border-neutral-850 space-y-4 animate-fadeIn">
                      <h4 className="text-xs font-bold text-accent uppercase tracking-widest mb-1">
                        Configure {PAKISTANI_PLATFORMS.find(p => p.id === selectedPlatform)?.name}
                      </h4>

                      {selectedPlatform === 'easypaisa' && (
                        <div>
                          <label className="block text-[10px] font-bold text-neutral-400 mb-2">EasyPaisa Mobile Number</label>
                          <input
                            type="text"
                            value={easypaisa}
                            onChange={(e) => setEasypaisa(e.target.value)}
                            placeholder="03XXXXXXXXX"
                            className="w-full bg-black border border-neutral-850 focus:border-accent text-white px-4 py-3 rounded-xl text-sm outline-none"
                          />
                        </div>
                      )}

                      {selectedPlatform === 'jazzcash' && (
                        <div>
                          <label className="block text-[10px] font-bold text-neutral-400 mb-2">JazzCash Mobile Number</label>
                          <input
                            type="text"
                            value={jazzcash}
                            onChange={(e) => setJazzcash(e.target.value)}
                            placeholder="03XXXXXXXXX"
                            className="w-full bg-black border border-neutral-850 focus:border-accent text-white px-4 py-3 rounded-xl text-sm outline-none"
                          />
                        </div>
                      )}

                      {selectedPlatform === 'nayapay' && (
                        <div>
                          <label className="block text-[10px] font-bold text-neutral-400 mb-2">NayaPay Mobile Number</label>
                          <input
                            type="text"
                            value={nayapay}
                            onChange={(e) => setNayapay(e.target.value)}
                            placeholder="03XXXXXXXXX"
                            className="w-full bg-black border border-neutral-850 focus:border-accent text-white px-4 py-3 rounded-xl text-sm outline-none"
                          />
                        </div>
                      )}

                      {selectedPlatform === 'sadapay' && (
                        <div>
                          <label className="block text-[10px] font-bold text-neutral-400 mb-2">SadaPay Mobile Number</label>
                          <input
                            type="text"
                            value={sadapay}
                            onChange={(e) => setSadapay(e.target.value)}
                            placeholder="03XXXXXXXXX"
                            className="w-full bg-black border border-neutral-850 focus:border-accent text-white px-4 py-3 rounded-xl text-sm outline-none"
                          />
                        </div>
                      )}

                      {PAKISTANI_PLATFORMS.find(p => p.id === selectedPlatform)?.type === 'bank' && (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-[10px] font-bold text-neutral-400 mb-2">Bank Name</label>
                            <input
                              type="text"
                              value={bankName}
                              disabled
                              className="w-full bg-neutral-900 border border-neutral-850 text-neutral-400 px-4 py-3 rounded-xl text-sm outline-none opacity-80"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-neutral-400 mb-2">Account Title</label>
                            <input
                              type="text"
                              value={accountTitle}
                              onChange={(e) => setAccountTitle(e.target.value)}
                              placeholder="Title on account"
                              className="w-full bg-black border border-neutral-850 focus:border-accent text-white px-4 py-3 rounded-xl text-sm outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-neutral-400 mb-2">Bank Account Number</label>
                            <input
                              type="text"
                              value={bankAccount}
                              onChange={(e) => setBankAccount(e.target.value)}
                              placeholder="Account number"
                              className="w-full bg-black border border-neutral-850 focus:border-accent text-white px-4 py-3 rounded-xl text-sm outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-neutral-400 mb-2">IBAN</label>
                            <input
                              type="text"
                              value={iban}
                              onChange={(e) => setIban(e.target.value)}
                              placeholder="PKXXXXXXXXXXXXXXXXXXXXXX"
                              className="w-full bg-black border border-neutral-850 focus:border-accent text-white px-4 py-3 rounded-xl text-sm outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Configured Platforms Display */}
                  <div className="bg-black/20 p-4 rounded-2xl border border-neutral-850/80">
                    <h4 className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest mb-3">
                      Your configured accounts
                    </h4>
                    <div className="flex flex-col gap-2">
                      {!easypaisa && !jazzcash && !nayapay && !sadapay && !bankAccount && (
                        <p className="text-xs text-neutral-500 italic">No platforms configured yet.</p>
                      )}
                      {easypaisa && (
                        <div className="flex items-center justify-between bg-black/40 border border-neutral-850 px-3.5 py-2.5 rounded-xl text-xs font-semibold">
                          <span>🟢 EasyPaisa: {easypaisa}</span>
                          <button type="button" onClick={() => setEasypaisa('')} className="text-neutral-500 hover:text-red-400 font-bold text-sm cursor-pointer">×</button>
                        </div>
                      )}
                      {jazzcash && (
                        <div className="flex items-center justify-between bg-black/40 border border-neutral-850 px-3.5 py-2.5 rounded-xl text-xs font-semibold">
                          <span>🔴 JazzCash: {jazzcash}</span>
                          <button type="button" onClick={() => setJazzcash('')} className="text-neutral-500 hover:text-red-400 font-bold text-sm cursor-pointer">×</button>
                        </div>
                      )}
                      {nayapay && (
                        <div className="flex items-center justify-between bg-black/40 border border-neutral-850 px-3.5 py-2.5 rounded-xl text-xs font-semibold">
                          <span>🍊 NayaPay: {nayapay}</span>
                          <button type="button" onClick={() => setNayapay('')} className="text-neutral-500 hover:text-red-400 font-bold text-sm cursor-pointer">×</button>
                        </div>
                      )}
                      {sadapay && (
                        <div className="flex items-center justify-between bg-black/40 border border-neutral-850 px-3.5 py-2.5 rounded-xl text-xs font-semibold">
                          <span>🟢 SadaPay: {sadapay}</span>
                          <button type="button" onClick={() => setSadapay('')} className="text-neutral-500 hover:text-red-400 font-bold text-sm cursor-pointer">×</button>
                        </div>
                      )}
                      {bankAccount && (
                        <div className="flex items-center justify-between bg-black/40 border border-neutral-850 px-3.5 py-2.5 rounded-xl text-xs font-semibold">
                          <div className="flex flex-col gap-0.5">
                            <span>🏦 {bankName || 'Bank Account'}</span>
                            <span className="text-[10px] text-neutral-400">Title: {accountTitle} • No: {bankAccount}</span>
                          </div>
                          <button type="button" onClick={() => {
                            setBankAccount('')
                            setBankName('')
                            setAccountTitle('')
                            setIban('')
                          }} className="text-neutral-500 hover:text-red-400 font-bold text-sm cursor-pointer">×</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-accent to-[#7c6fd6] hover:opacity-95 text-white py-4 rounded-2xl font-bold text-sm transition shadow-md shadow-accent/10 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save Profile Details
                </button>

              </div>

            </div>
          </form>
        </div>
      </div>

      {/* Floating Bottom Nav */}
      <Navbar currentPage="profile" />
    </>
  )
}
