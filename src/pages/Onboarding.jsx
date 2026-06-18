import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../config/supabase'
import Toast from '../components/Toast'
import { User, CreditCard, PiggyBank, ArrowRight, ArrowLeft, Check } from 'lucide-react'
import { PAKISTANI_PLATFORMS, getPlatformIcon } from '../utils/platforms'

const AVAILABLE_AVATARS = [
  '💸', '💰', '💳', '🚀', '🌟', '🦄', '🐯', '🦊', '🦁', '🐼', '🐨', '🎯', '🥑', '🍔', '👾', '🚀'
]

export default function Onboarding() {
  const { user, fetchProfile } = useAuth()
  const navigate = useNavigate()
  
  const [step, setStep] = useState(1) // 1: Profile, 2: Wallets, 3: Budget
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Step 1: Profile Info
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState(AVAILABLE_AVATARS[0])
  const [usernameStatus, setUsernameStatus] = useState('')
  
  // Step 2: Wallet Info
  const [nayapay, setNayapay] = useState('')
  const [sadapay, setSadapay] = useState('')
  const [easypaisa, setEasypaisa] = useState('')
  const [jazzcash, setJazzcash] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [accountTitle, setAccountTitle] = useState('')
  const [iban, setIban] = useState('')
  const [bankName, setBankName] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState('')

  // Step 3: Budget Info
  const [monthlyBudget, setMonthlyBudget] = useState('')

  React.useEffect(() => {
    if (user?.user_metadata) {
      if ((user.user_metadata.full_name || user.user_metadata.name) && !fullName) {
        setFullName(user.user_metadata.full_name || user.user_metadata.name)
      }
      if (user.user_metadata.username && !username) {
        const u = user.user_metadata.username.toLowerCase().replace(/\s/g, '')
        setUsername(u)
        checkUsername(u)
      }
    }
  }, [user])

  const checkUsername = async (value) => {
    if (!value || value.length < 3) {
      setUsernameStatus('')
      return
    }
    
    const usernameRegex = /^[a-zA-Z0-9_]+$/
    if (!usernameRegex.test(value)) {
      setUsernameStatus('invalid')
      return
    }

    try {
      setUsernameStatus('checking')
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', value.toLowerCase())
        .maybeSingle()

      if (error) throw error

      if (data) {
        setUsernameStatus('taken')
      } else {
        setUsernameStatus('available')
      }
    } catch (err) {
      console.error(err)
      setUsernameStatus('')
    }
  }

  const handleUsernameChange = (e) => {
    const val = e.target.value.toLowerCase().replace(/\s/g, '')
    setUsername(val)
    checkUsername(val)
  }

  const validateStep1 = () => {
    if (!username || !fullName) {
      setError('Username and Full Name are required')
      return false
    }
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') {
      setError('Please choose a valid and available username')
      return false
    }
    if (username.length < 3) {
      setError('Username must be at least 3 characters long')
      return false
    }
    setError(null)
    return true
  }

  const handleNextStep = () => {
    if (step === 1) {
      if (validateStep1()) setStep(2)
    } else if (step === 2) {
      setStep(3)
    }
  }

  const handlePrevStep = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateStep1()) return

    setLoading(true)
    setError(null)

    try {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username.toLowerCase())
        .maybeSingle()

      if (existingUser) {
        setError('Username is already taken')
        setUsernameStatus('taken')
        setStep(1)
        setLoading(false)
        return
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: username.toLowerCase().trim(),
          full_name: fullName.trim(),
          avatar_url: selectedAvatar,
          onboarding_completed: true,
          monthly_budget: monthlyBudget ? Number(monthlyBudget) : 0,
          updated_at: new Date()
        })

      if (profileError) throw profileError

      const { error: walletError } = await supabase
        .from('wallets')
        .upsert({
          user_id: user.id,
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

      if (walletError) throw walletError

      await fetchProfile(user.id)
      navigate('/home')
    } catch (err) {
      console.error('Onboarding save error:', err)
      setError(err.message || 'Failed to save onboarding details')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Toast
        show={!!error}
        message={error}
        type="error"
        onClose={() => setError(null)}
        duration={4000}
      />
      
      <div className="min-h-screen bg-bg-app text-text-primary flex flex-col justify-center items-center px-4 py-10 transition-colors duration-300">
        <div className="w-full max-w-3xl bg-bg-card border border-border-primary rounded-[2.5rem] p-6 md:p-10 shadow-sm backdrop-blur-xl transition-all duration-300">
          
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-text-primary grad">Let's set up your profile</h1>
            <p className="text-xs text-text-secondary mt-2">Flow through these steps to configure your experience</p>
          </div>

          {/* Step Progress Indicator */}
          <div className="flex justify-between items-center max-w-md mx-auto mb-10 relative">
            <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-border-inner -translate-y-1/2 z-0"></div>
            
            {/* Step 1 */}
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${
                step >= 1 ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-bg-card border-border-primary text-text-secondary'
              }`}>
                <User className="w-4 h-4" />
              </div>
              <span className={`text-xs font-semibold ${step >= 1 ? 'text-accent' : 'text-text-secondary'}`}>Profile</span>
            </div>

            {/* Step 2 */}
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${
                step >= 2 ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-bg-card border-border-primary text-text-secondary'
              }`}>
                <CreditCard className="w-4 h-4" />
              </div>
              <span className={`text-xs font-semibold ${step >= 2 ? 'text-accent' : 'text-text-secondary'}`}>Wallets</span>
            </div>

            {/* Step 3 */}
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${
                step >= 3 ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-bg-card border-border-primary text-text-secondary'
              }`}>
                <PiggyBank className="w-4 h-4" />
              </div>
              <span className={`text-xs font-semibold ${step >= 3 ? 'text-accent' : 'text-text-secondary'}`}>Budget</span>
            </div>
          </div>

          {/* Form Views */}
          <div className="mt-4">
            {step === 1 && (
              /* ==================== STEP 1: IDENTITY ==================== */
              <div className="space-y-6 animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column: Avatar */}
                  <div className="flex flex-col items-center gap-4 bg-bg-card-inner p-6 rounded-3xl border border-border-primary">
                    <span className="text-xs font-semibold text-text-secondary">Select Avatar</span>
                    <div className="w-24 h-24 rounded-full bg-bg-card border border-border-primary flex items-center justify-center text-5xl shadow-inner shadow-black/10">
                      {selectedAvatar}
                    </div>
                    <div className="grid grid-cols-4 gap-2 w-full max-h-36 overflow-y-auto no-scrollbar p-1">
                      {AVAILABLE_AVATARS.map((avatar, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedAvatar(avatar)}
                          className={`text-2xl p-1.5 rounded-xl hover:bg-bg-card transition ${
                            selectedAvatar === avatar ? 'bg-accent/20 border border-accent/40 scale-110' : 'border border-transparent'
                          }`}
                        >
                          {avatar}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Inputs */}
                  <div className="flex flex-col justify-center space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-2 ml-1">
                        Username
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-[13px] text-text-secondary font-semibold">@</span>
                        <input
                          type="text"
                          value={username}
                          onChange={handleUsernameChange}
                          placeholder="john_doe"
                          className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary pl-8 pr-12 py-3 rounded-2xl text-[15px] outline-none transition-all duration-200"
                          required
                        />
                        <div className="absolute right-4 top-[14px]">
                          {usernameStatus === 'checking' && (
                            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                          )}
                          {usernameStatus === 'available' && (
                            <span className="text-green-500 text-xs font-bold">✓</span>
                          )}
                          {usernameStatus === 'taken' && (
                            <span className="text-red-500 text-xs font-semibold">Taken</span>
                          )}
                          {usernameStatus === 'invalid' && (
                            <span className="text-red-500 text-xs font-semibold">Invalid</span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-text-secondary mt-1 ml-1">
                        Lowercase letters, numbers, and underscores (min 3 chars).
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-2 ml-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary px-4 py-3 rounded-2xl text-[15px] outline-none transition-all duration-200"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-border-inner">
                  <button
                    onClick={handleNextStep}
                    className="bg-gradient-to-r from-accent to-[#7c6fd6] hover:opacity-95 text-white py-3.5 px-8 rounded-2xl font-bold text-[14px] transition-all flex items-center gap-2 active:scale-95 cursor-pointer shadow-lg shadow-accent/10"
                  >
                    Next Step <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              /* ==================== STEP 2: WALLETS ==================== */
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-2 ml-1">
                    Select Payment Platform to Configure / Add
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
                    className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary px-4 py-3 rounded-2xl text-[15px] outline-none cursor-pointer"
                  >
                    <option value="" className="bg-bg-input text-text-primary">-- Select Wallet or Bank --</option>
                    <optgroup label="Mobile Wallets & Digital Accounts" className="bg-bg-input text-text-primary">
                      {PAKISTANI_PLATFORMS.filter(p => p.type === 'wallet').map(p => (
                        <option key={p.id} value={p.id} className="bg-bg-input text-text-primary">
                          {getPlatformIcon(p.id)} {p.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Commercial Banks" className="bg-bg-input text-text-primary">
                      {PAKISTANI_PLATFORMS.filter(p => p.type === 'bank').map(p => (
                        <option key={p.id} value={p.id} className="bg-bg-input text-text-primary">
                          🏦 {p.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Contextual Input Fields based on selection */}
                {selectedPlatform && (
                  <div className="bg-bg-card-inner p-5 rounded-3xl border border-border-primary space-y-4 animate-fadeIn">
                    <h4 className="text-xs font-bold text-accent mb-1">
                      Configure {PAKISTANI_PLATFORMS.find(p => p.id === selectedPlatform)?.name} Details
                    </h4>

                    {selectedPlatform === 'easypaisa' && (
                      <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-2">EasyPaisa Mobile Number</label>
                        <input
                          type="text"
                          value={easypaisa}
                          onChange={(e) => setEasypaisa(e.target.value)}
                          placeholder="03XXXXXXXXX"
                          className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary px-4 py-3 rounded-2xl text-[15px] outline-none"
                        />
                      </div>
                    )}

                    {selectedPlatform === 'jazzcash' && (
                      <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-2">JazzCash Mobile Number</label>
                        <input
                          type="text"
                          value={jazzcash}
                          onChange={(e) => setJazzcash(e.target.value)}
                          placeholder="03XXXXXXXXX"
                          className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary px-4 py-3 rounded-2xl text-[15px] outline-none"
                        />
                      </div>
                    )}

                    {selectedPlatform === 'nayapay' && (
                      <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-2">NayaPay Mobile Number</label>
                        <input
                          type="text"
                          value={nayapay}
                          onChange={(e) => setNayapay(e.target.value)}
                          placeholder="03XXXXXXXXX"
                          className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary px-4 py-3 rounded-2xl text-[15px] outline-none"
                        />
                      </div>
                    )}

                    {selectedPlatform === 'sadapay' && (
                      <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-2">SadaPay Mobile Number</label>
                        <input
                          type="text"
                          value={sadapay}
                          onChange={(e) => setSadapay(e.target.value)}
                          placeholder="03XXXXXXXXX"
                          className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary px-4 py-3 rounded-2xl text-[15px] outline-none"
                        />
                      </div>
                    )}

                    {PAKISTANI_PLATFORMS.find(p => p.id === selectedPlatform)?.type === 'bank' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-text-secondary mb-2">Bank Name</label>
                          <input
                            type="text"
                            value={bankName}
                            disabled
                            className="w-full bg-bg-card border border-border-input text-text-secondary px-4 py-3 rounded-2xl text-[15px] outline-none opacity-80"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-text-secondary mb-2">Account Title</label>
                            <input
                              type="text"
                              value={accountTitle}
                              onChange={(e) => setAccountTitle(e.target.value)}
                              placeholder="e.g. John Doe"
                              className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary px-4 py-3 rounded-2xl text-[15px] outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-text-secondary mb-2">Bank Account Number</label>
                            <input
                              type="text"
                              value={bankAccount}
                              onChange={(e) => setBankAccount(e.target.value)}
                              placeholder="Account Number"
                              className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary px-4 py-3 rounded-2xl text-[15px] outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-text-secondary mb-2">IBAN</label>
                          <input
                            type="text"
                            value={iban}
                            onChange={(e) => setIban(e.target.value)}
                            placeholder="PKXXXXXXXXXXXXXXXXXXXXXX"
                            className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary px-4 py-3 rounded-2xl text-[15px] outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Configured Platforms display */}
                <div className="bg-bg-card-inner p-5 rounded-3xl border border-border-primary">
                  <h4 className="text-xs font-bold text-text-secondary mb-3">
                    Configured payment accounts
                  </h4>
                  <div className="flex flex-wrap gap-2.5">
                    {!easypaisa && !jazzcash && !nayapay && !sadapay && !bankAccount && (
                      <p className="text-xs text-text-secondary italic">No platforms configured yet. Select one above to configure.</p>
                    )}
                    {easypaisa && (
                      <div className="flex items-center gap-2 bg-bg-card border border-border-primary px-3.5 py-2 rounded-xl text-xs font-semibold">
                        <span>🟢 EasyPaisa: {easypaisa}</span>
                        <button type="button" onClick={() => setEasypaisa('')} className="text-text-secondary hover:text-red-400 font-bold ml-1 text-sm cursor-pointer">×</button>
                      </div>
                    )}
                    {jazzcash && (
                      <div className="flex items-center gap-2 bg-bg-card border border-border-primary px-3.5 py-2 rounded-xl text-xs font-semibold">
                        <span>🔴 JazzCash: {jazzcash}</span>
                        <button type="button" onClick={() => setJazzcash('')} className="text-text-secondary hover:text-red-400 font-bold ml-1 text-sm cursor-pointer">×</button>
                      </div>
                    )}
                    {nayapay && (
                      <div className="flex items-center gap-2 bg-bg-card border border-border-primary px-3.5 py-2 rounded-xl text-xs font-semibold">
                        <span>🍊 NayaPay: {nayapay}</span>
                        <button type="button" onClick={() => setNayapay('')} className="text-text-secondary hover:text-red-400 font-bold ml-1 text-sm cursor-pointer">×</button>
                      </div>
                    )}
                    {sadapay && (
                      <div className="flex items-center gap-2 bg-bg-card border border-border-primary px-3.5 py-2 rounded-xl text-xs font-semibold">
                        <span>🟢 SadaPay: {sadapay}</span>
                        <button type="button" onClick={() => setSadapay('')} className="text-text-secondary hover:text-red-400 font-bold ml-1 text-sm cursor-pointer">×</button>
                      </div>
                    )}
                    {bankAccount && (
                      <div className="flex items-center gap-2 bg-bg-card border border-border-primary px-3.5 py-2 rounded-xl text-xs font-semibold">
                        <span>🏦 {bankName || 'Bank'}: {bankAccount}</span>
                        <button type="button" onClick={() => {
                          setBankAccount('')
                          setBankName('')
                          setAccountTitle('')
                          setIban('')
                        }} className="text-text-secondary hover:text-red-400 font-bold ml-1 text-sm cursor-pointer">×</button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between pt-6 border-t border-border-inner">
                  <button
                    onClick={handlePrevStep}
                    className="bg-bg-card border border-border-primary text-text-secondary py-3.5 px-6 rounded-2xl font-bold text-[14px] hover:text-text-primary transition flex items-center gap-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    onClick={handleNextStep}
                    className="bg-gradient-to-r from-accent to-[#7c6fd6] hover:opacity-95 text-white py-3.5 px-8 rounded-2xl font-bold text-[14px] transition flex items-center gap-2 active:scale-95 cursor-pointer shadow-lg shadow-accent/10"
                  >
                    Next Step <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              /* ==================== STEP 3: BUDGET ==================== */
              <div className="space-y-6 animate-fadeIn">
                <div className="max-w-md mx-auto space-y-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mx-auto text-2xl">
                    🎯
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-text-primary leading-tight">Set a Monthly Budget Limit</h3>
                    <p className="text-xs text-text-secondary mt-2">
                      Monitor your spending. We'll warn you when you exceed 85% of this limit. You can leave it at 0 to skip.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-3">
                      Monthly Limit (Rs.)
                    </label>
                    <input
                      type="number"
                      value={monthlyBudget}
                      onChange={(e) => setMonthlyBudget(e.target.value)}
                      placeholder="e.g. 30000"
                      min="0"
                      className="w-full text-center bg-bg-input border border-border-input focus:border-accent text-text-primary px-4 py-4 rounded-2xl text-lg font-extrabold outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-6 border-t border-border-inner">
                  <button
                    onClick={handlePrevStep}
                    className="bg-bg-card border border-border-primary text-text-secondary py-3.5 px-6 rounded-2xl font-bold text-[14px] hover:text-text-primary transition flex items-center gap-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="bg-gradient-to-r from-accent to-[#7c6fd6] hover:opacity-95 text-white py-3.5 px-8 rounded-2xl font-bold text-[14px] transition flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer shadow-lg shadow-accent/10"
                  >
                    {loading ? 'Saving details...' : 'Finish Setup'} <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
