import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../config/supabase'
import Navbar from '../components/Navbar'
import Toast from '../components/Toast'
import LoadingPulseOverlay from '../components/Loading'
import { Plus, Search, UserPlus, Users, Layers, ArrowUpRight, ArrowDownLeft, Calendar, FileText, Trash2, Wallet, Settings, Landmark, RefreshCw, Send, ArrowRightLeft, Menu } from 'lucide-react'

export default function Home() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Balance stats
  const [owedToMe, setOwedToMe] = useState(0)
  const [iOwe, setIOwe] = useState(0)

  // Transactions & Friends
  const [recentTransactions, setRecentTransactions] = useState([])
  const [friends, setFriends] = useState([])

  // Modal States
  const [isAddTxOpen, setIsAddTxOpen] = useState(false)
  const [txFriendId, setTxFriendId] = useState('')
  const [txType, setTxType] = useState('lent') // lent, borrowed, paid, received
  const [txAmount, setTxAmount] = useState('')
  const [txDesc, setTxDesc] = useState('')
  const [txDate, setTxDate] = useState(new Date().toISOString().substring(0, 10))
  const [submittingTx, setSubmittingTx] = useState(false)

  // Payment Details Modal States
  const [isPayModalOpen, setIsPayModalOpen] = useState(false)
  const [payFriend, setPayFriend] = useState(null)
  const [payWallet, setPayWallet] = useState(null)
  const [settlingDirect, setSettlingDirect] = useState(false)

  // Search filter
  const [searchFilter, setSearchFilter] = useState('')

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      // 1. Fetch Friends
      const { data: friendships, error: fError } = await supabase
        .from('friendships')
        .select(`
          id,
          user1:user_id_1(id, username, full_name, avatar_url),
          user2:user_id_2(id, username, full_name, avatar_url)
        `)
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)

      if (fError) throw fError

      const friendsList = friendships.map(f => {
        return f.user1.id === user.id ? f.user2 : f.user1
      })
      setFriends(friendsList)

      // 2. Fetch Direct Transactions
      const { data: txs, error: txError } = await supabase
        .from('transactions')
        .select(`
          *,
          creator:user_id(id, username, full_name, avatar_url),
          friend:friend_id(id, username, full_name, avatar_url)
        `)
        .order('date', { ascending: false })

      if (txError) throw txError
      setRecentTransactions(txs || [])

      // 3. Compute Direct Balances
      const pendingTxs = txs.filter(t => t.status === 'pending')
      let directOwed = 0
      let directOwes = 0

      const friendBalances = {}
      friendsList.forEach(f => {
        friendBalances[f.id] = 0
      })

      pendingTxs.forEach(t => {
        const friendId = t.user_id === user.id ? t.friend_id : t.user_id
        if (friendBalances[friendId] === undefined) {
          friendBalances[friendId] = 0
        }

        if (t.user_id === user.id) {
          if (t.type === 'lent' || t.type === 'paid') {
            friendBalances[friendId] += Number(t.amount)
          } else {
            friendBalances[friendId] -= Number(t.amount)
          }
        } else {
          if (t.type === 'borrowed' || t.type === 'received') {
            friendBalances[friendId] += Number(t.amount)
          } else {
            friendBalances[friendId] -= Number(t.amount)
          }
        }
      })

      Object.keys(friendBalances).forEach(fId => {
        const bal = friendBalances[fId]
        if (bal > 0) {
          directOwed += bal
        } else if (bal < 0) {
          directOwes += Math.abs(bal)
        }
      })

      // 4. Fetch Group Expenses and Splits
      const { data: memberships, error: mError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)

      if (mError) throw mError
      const groupIds = memberships.map(m => m.group_id)

      let groupOwed = 0
      let groupOwes = 0

      if (groupIds.length > 0) {
        const { data: expenses, error: expError } = await supabase
          .from('group_expenses')
          .select('id, amount, payer_id, group_id')
          .in('group_id', groupIds)

        if (expError) throw expError

        const { data: splits, error: splitError } = await supabase
          .from('group_expense_splits')
          .select('id, share, status, expense:expense_id(group_id, payer_id)')
          .eq('user_id', user.id)
          .eq('status', 'pending')

        if (splitError) throw splitError

        const expenseIdsPaidByU = expenses.filter(e => e.payer_id === user.id).map(e => e.id)
        if (expenseIdsPaidByU.length > 0) {
          const { data: owedSplits, error: osError } = await supabase
            .from('group_expense_splits')
            .select('share')
            .in('expense_id', expenseIdsPaidByU)
            .neq('user_id', user.id)
            .eq('status', 'pending')
          
          if (!osError && owedSplits) {
            groupOwed = owedSplits.reduce((sum, s) => sum + Number(s.share), 0)
          }
        }

        groupOwes = splits.reduce((sum, s) => sum + Number(s.share), 0)
      }

      setOwedToMe(directOwed + groupOwed)
      setIOwe(directOwes + groupOwes)

    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  // Handle Add Transaction Submit
  const handleAddTx = async (e) => {
    e.preventDefault()
    if (!txFriendId || !txAmount || !txDesc) {
      setError('Please fill all transaction fields')
      return
    }

    setSubmittingTx(true)
    setError(null)

    try {
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          friend_id: txFriendId,
          type: txType,
          amount: Number(txAmount),
          description: txDesc.trim(),
          date: new Date(txDate).toISOString(),
          status: 'pending'
        })

      if (txError) throw txError

      setSuccess('Transaction added successfully!')
      setIsAddTxOpen(false)
      setTxAmount('')
      setTxDesc('')
      setTxType('lent')
      
      await fetchDashboardData()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to add transaction')
    } finally {
      setSubmittingTx(false)
    }
  }

  // Open Payment/Settlement Modal for a friend
  const openPaymentModal = async (friend) => {
    try {
      setLoading(true)
      setError(null)
      
      const { data: walletDetails, error: wError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', friend.id)
        .maybeSingle()

      if (wError) throw wError

      setPayFriend(friend)
      setPayWallet(walletDetails || {})
      setIsPayModalOpen(true)
    } catch (err) {
      console.error(err)
      setError('Failed to fetch friend\'s payment methods')
    } finally {
      setLoading(false)
    }
  }

  // Handle actual settlement save
  const handleSettleDirect = async () => {
    if (!payFriend) return
    
    try {
      setSettlingDirect(true)
      setError(null)

      const { error: sError } = await supabase
        .from('transactions')
        .update({ status: 'settled' })
        .eq('status', 'pending')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${payFriend.id}),and(user_id.eq.${payFriend.id},friend_id.eq.${user.id})`)

      if (sError) throw sError

      setSuccess(`Balances with ${payFriend.full_name} marked as settled!`)
      setIsPayModalOpen(false)
      setPayFriend(null)
      setPayWallet(null)
      await fetchDashboardData()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to settle balance')
    } finally {
      setSettlingDirect(false)
    }
  }

  // Delete Transaction
  const handleDeleteTx = async (txId) => {
    if (!window.confirm('Delete this transaction?')) return

    try {
      setLoading(true)
      const { error: dError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', txId)
        .eq('user_id', user.id)

      if (dError) throw dError

      setSuccess('Transaction deleted!')
      await fetchDashboardData()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to delete transaction')
    } finally {
      setLoading(false)
    }
  }

  const netBalance = owedToMe - iOwe

  const filteredTransactions = recentTransactions.filter(tx => {
    const friendName = tx.user_id === user.id ? tx.friend?.full_name : tx.creator?.full_name
    return (
      tx.description?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      friendName?.toLowerCase().includes(searchFilter.toLowerCase())
    )
  })

  return (
    <>
      <Toast show={!!error} message={error} type="error" onClose={() => setError(null)} duration={3500} />
      <Toast show={!!success} message={success} type="success" onClose={() => setSuccess(null)} duration={3500} />

      {loading && <LoadingPulseOverlay />}

      <div className="min-h-screen bg-bg-app text-text-primary px-4 pt-6 pb-28 font-figtree transition-colors duration-300">
        <div className="max-w-md mx-auto space-y-6">
          
          {/* Header (Inspired by mockup) */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/profile')}
              className="w-10 h-10 rounded-full bg-accent/25 flex items-center justify-center text-xl shadow-inner border border-accent/30 hover:scale-105 active:scale-95 transition"
            >
              {profile?.avatar_url || '👤'}
            </button>
            <h1 className="text-lg font-extrabold text-text-primary text-center">Explore</h1>
            <button
              onClick={() => signOut()}
              className="w-10 h-10 rounded-full bg-bg-card border border-border-primary text-text-secondary hover:text-red-400 flex items-center justify-center hover:scale-105 active:scale-95 transition cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>

          {/* Premium Search bar (Mockup styled) */}
          <div className="relative w-full">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search transactions, friends..."
              className="w-full bg-bg-card border border-border-primary/80 focus:border-accent text-text-primary pl-10 pr-4 py-3 rounded-2xl text-sm outline-none shadow-sm transition"
            />
            <Search className="absolute left-3.5 top-3.5 text-text-secondary w-3.5 h-3.5" />
          </div>

          {/* Net Balance Premium Card */}
          <div className="relative overflow-hidden bg-bg-card border border-border-primary rounded-[2rem] p-5 shadow-sm">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <p className="text-xs font-semibold text-text-secondary mb-1 text-center">Total Balance</p>
            <h1 className="text-3xl font-black text-center grad mb-5">
              Rs. {netBalance.toLocaleString()}
            </h1>

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border-inner">
              <div className="flex items-center gap-2 bg-bg-card-inner/60 p-2.5 rounded-2xl border border-border-inner">
                <div className="w-8 h-8 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 shrink-0">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-text-secondary">Owed to me</p>
                  <p className="text-xs font-black text-green-400 truncate">Rs. {owedToMe.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-bg-card-inner/60 p-2.5 rounded-2xl border border-border-inner">
                <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 shrink-0">
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-text-secondary">I owe</p>
                  <p className="text-xs font-black text-red-400 truncate">Rs. {iOwe.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* "Favorit" Grid (Inspired by the Left Mockup) */}
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-text-primary ml-1">Favorit</h3>
            <div className="grid grid-cols-3 gap-3">
              
              <button
                onClick={() => setIsAddTxOpen(true)}
                className="flex flex-col items-center justify-center p-4 bg-bg-card border border-border-primary hover:border-accent/30 rounded-2xl gap-2 active:scale-95 transition cursor-pointer"
              >
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shadow-sm border border-indigo-500/20">
                  <Send className="w-4 h-4" />
                </div>
                <span className="text-xs text-text-primary font-bold tracking-tight text-center">Add Direct</span>
              </button>

              <button
                onClick={() => navigate('/friends')}
                className="flex flex-col items-center justify-center p-4 bg-bg-card border border-border-primary hover:border-accent/30 rounded-2xl gap-2 active:scale-95 transition cursor-pointer"
              >
                <div className="w-10 h-10 rounded-2xl bg-[#7c6fd6]/15 flex items-center justify-center text-accent shadow-sm border border-accent/20">
                  <UserPlus className="w-4 h-4" />
                </div>
                <span className="text-xs text-text-primary font-bold tracking-tight text-center">Add Friend</span>
              </button>

              <button
                onClick={() => navigate('/groups')}
                className="flex flex-col items-center justify-center p-4 bg-bg-card border border-border-primary hover:border-accent/30 rounded-2xl gap-2 active:scale-95 transition cursor-pointer"
              >
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 shadow-sm border border-purple-500/20">
                  <Layers className="w-4 h-4" />
                </div>
                <span className="text-xs text-text-primary font-bold tracking-tight text-center">Split Group</span>
              </button>

            </div>
          </div>

          {/* "Payment" / Trackers Section (Inspired by Left Mockup) */}
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-text-primary ml-1">Payment & Track</h3>
            <div className="grid grid-cols-2 gap-3">
              
              <button
                onClick={() => navigate('/spending')}
                className="flex items-center gap-3 p-3 bg-bg-card border border-border-primary rounded-2xl hover:border-accent/30 transition text-left cursor-pointer active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 border border-orange-500/25">
                  <RefreshCw className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-text-primary">Track Spent</h4>
                  <p className="text-xs text-text-secondary mt-0.5">Personal Expenses</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/profile')}
                className="flex items-center gap-3 p-3 bg-bg-card border border-border-primary rounded-2xl hover:border-accent/30 transition text-left cursor-pointer active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/25">
                  <Wallet className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-text-primary">Wallets</h4>
                  <p className="text-xs text-text-secondary mt-0.5">Manage accounts</p>
                </div>
              </button>

            </div>
          </div>

          {/* Recent Transactions list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between ml-1">
              <h3 className="text-sm font-extrabold text-text-primary">Recent Transactions</h3>
              {filteredTransactions.length > 0 && (
                <button
                  onClick={() => setSearchFilter('')}
                  className="text-xs font-bold text-accent hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {filteredTransactions.length === 0 ? (
                <div className="bg-bg-card border border-dashed border-border-primary rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                  <FileText className="w-8 h-8 text-text-secondary/60 mb-2" />
                  <p className="text-xs font-medium text-text-secondary">No transactions found</p>
                </div>
              ) : (
                filteredTransactions.slice(0, 5).map(tx => {
                  const isCreator = tx.user_id === user.id
                  const otherParty = isCreator ? tx.friend : tx.creator
                  
                  let displayType = ''
                  let amountColor = ''
                  let prefix = ''

                  if (isCreator) {
                    if (tx.type === 'lent') {
                      displayType = 'Lent'
                      amountColor = 'text-green-400'
                      prefix = '+'
                    } else if (tx.type === 'borrowed') {
                      displayType = 'Borrowed'
                      amountColor = 'text-red-400'
                      prefix = '-'
                    } else if (tx.type === 'paid') {
                      displayType = 'Paid'
                      amountColor = 'text-green-400'
                      prefix = '+'
                    } else if (tx.type === 'received') {
                      displayType = 'Received'
                      amountColor = 'text-red-400'
                      prefix = '-'
                    }
                  } else {
                    if (tx.type === 'lent') {
                      displayType = 'Borrowed'
                      amountColor = 'text-red-400'
                      prefix = '-'
                    } else if (tx.type === 'borrowed') {
                      displayType = 'Lent'
                      amountColor = 'text-green-400'
                      prefix = '+'
                    } else if (tx.type === 'paid') {
                      displayType = 'Received'
                      amountColor = 'text-red-400'
                      prefix = '-'
                    } else if (tx.type === 'received') {
                      displayType = 'Paid'
                      amountColor = 'text-green-400'
                      prefix = '+'
                    }
                  }

                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3.5 bg-bg-card border border-border-primary rounded-2xl shadow-sm hover:border-accent/30 transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-bg-card-inner flex items-center justify-center text-lg shadow-sm border border-border-primary/50">
                          {otherParty?.avatar_url || '👤'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-[12px] font-bold text-text-primary leading-tight">
                              {otherParty?.full_name}
                            </p>
                            <span className={`text-xs font-bold capitalize px-1.5 py-0.5 rounded-full ${tx.status === 'settled' ? 'bg-bg-card-inner text-text-secondary' : 'bg-accent/15 text-accent'}`}>
                              {tx.status}
                            </span>
                          </div>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {displayType} • {tx.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`text-[12px] font-extrabold ${amountColor}`}>
                            {prefix}Rs. {Number(tx.amount).toLocaleString()}
                          </p>
                          <p className="text-xs text-text-secondary flex items-center gap-1 justify-end mt-0.5 font-semibold">
                            <Calendar className="w-2.5 h-2.5" />
                            {new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </p>
                        </div>

                        {isCreator && (
                          <button
                            onClick={() => handleDeleteTx(tx.id)}
                            className="p-1 text-text-secondary/60 hover:text-red-400 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Quick settlement balance drawer (Direct balances list) */}
          {friends.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-extrabold text-text-primary ml-1">Direct Balances</h3>
              <div className="grid grid-cols-1 gap-2.5">
                {friends.slice(0, 3).map(f => {
                  const fTxs = recentTransactions.filter(t => t.status === 'pending' && (t.user_id === f.id || t.friend_id === f.id))
                  let fBal = 0
                  fTxs.forEach(t => {
                    if (t.user_id === user.id) {
                      fBal += (t.type === 'lent' || t.type === 'paid') ? Number(t.amount) : -Number(t.amount)
                    } else {
                      fBal += (t.type === 'borrowed' || t.type === 'received') ? Number(t.amount) : -Number(t.amount)
                    }
                  })

                  return (
                    <div
                      key={f.id}
                      className="flex items-center justify-between p-3 bg-bg-card-inner border border-border-primary rounded-2xl"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <span className="text-2xl shrink-0">{f.avatar_url || '👤'}</span>
                        <div className="overflow-hidden">
                          <p className="text-[11px] font-bold truncate text-text-primary">{f.full_name}</p>
                          <p className="text-xs text-text-secondary truncate">@{f.username}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          {fBal === 0 ? (
                            <span className="text-xs font-bold text-text-secondary">Settled</span>
                          ) : fBal > 0 ? (
                            <div className="text-xs text-green-400 font-bold">
                              Owes: Rs. {fBal}
                            </div>
                          ) : (
                            <div className="text-xs text-red-400 font-bold">
                              Owe: Rs. {Math.abs(fBal)}
                            </div>
                          )}
                        </div>

                        {fBal !== 0 && (
                          <button
                            onClick={() => openPaymentModal(f)}
                            className="bg-accent/15 text-accent px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-accent/25 transition cursor-pointer"
                          >
                            Settle
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Add Direct Transaction Modal */}
      {isAddTxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-bg-card border border-border-primary rounded-[2rem] p-6 shadow-2xl">
            <h2 className="text-xl font-black text-text-primary grad mb-1">Add Direct Transaction</h2>
            <p className="text-xs text-text-secondary mb-5">Record a direct transaction with a friend.</p>

            <form onSubmit={handleAddTx} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2">
                  Select Friend
                </label>
                <select
                  value={txFriendId}
                  onChange={(e) => setTxFriendId(e.target.value)}
                  className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary px-3 py-3 rounded-xl text-sm outline-none cursor-pointer"
                  required
                >
                  <option value="" disabled>Choose a friend</option>
                  {friends.map(f => (
                    <option key={f.id} value={f.id} className="bg-bg-input text-text-primary">
                      {f.full_name} (@{f.username})
                    </option>
                  ))}
                </select>
                {friends.length === 0 && (
                  <p className="text-xs text-red-400 mt-1 ml-1">You must add friends first to make transactions!</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-2">
                    Transaction Type
                  </label>
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value)}
                    className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary px-3 py-3 rounded-xl text-sm outline-none cursor-pointer"
                  >
                    <option value="lent" className="bg-bg-input text-text-primary">Lent (I lent money)</option>
                    <option value="borrowed" className="bg-bg-input text-text-primary">Borrowed (I borrowed money)</option>
                    <option value="paid" className="bg-bg-input text-text-primary">Paid (I paid friend)</option>
                    <option value="received" className="bg-bg-input text-text-primary">Received (Friend paid me)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-2">
                    Amount (Rs.)
                  </label>
                  <input
                    type="number"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="500"
                    min="1"
                    className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary px-4 py-3 rounded-xl text-sm outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  placeholder="Dinner, cab fare, snacks, etc."
                  className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary px-4 py-3 rounded-xl text-sm outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary px-4 py-3 rounded-xl text-sm outline-none"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTxOpen(false)}
                  className="flex-1 bg-bg-card-inner border border-border-primary text-text-secondary py-3 rounded-xl text-xs font-bold hover:text-text-primary transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTx || friends.length === 0}
                  className="flex-1 bg-gradient-to-r from-accent to-[#7c6fd6] text-white py-3 rounded-xl text-xs font-bold hover:opacity-95 active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
                >
                  {submittingTx ? 'Submitting...' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Details / Settle Modal */}
      {isPayModalOpen && payFriend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-bg-card border border-border-primary rounded-[2rem] p-6 shadow-2xl">
            <h2 className="text-xl font-black text-text-primary grad mb-1">Payment Details</h2>
            <p className="text-xs text-text-secondary mb-5">
              Send payments directly to {payFriend.full_name} using their saved methods below, then mark the balance as settled.
            </p>

            <div className="space-y-4 mb-6 bg-bg-card-inner p-4 rounded-2xl border border-border-primary">
              <div className="flex items-center gap-3 pb-3 border-b border-border-primary">
                <span className="text-3xl">{payFriend.avatar_url || '👤'}</span>
                <div>
                  <p className="text-xs font-bold text-text-primary">{payFriend.full_name}</p>
                  <p className="text-xs text-accent font-semibold">@{payFriend.username}</p>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                {(!payWallet || (!payWallet.easypaisa_number && !payWallet.jazzcash_number && !payWallet.nayapay_number && !payWallet.sadapay_number && !payWallet.bank_account_number)) ? (
                  <p className="text-xs text-text-secondary italic py-2 text-center">
                    No payment methods configured by this user.
                  </p>
                ) : (
                  <>
                    {payWallet.easypaisa_number && (
                      <div className="flex justify-between items-center bg-bg-card p-2.5 rounded-xl border border-border-inner">
                        <div>
                          <p className="text-xs font-semibold text-text-secondary">EasyPaisa</p>
                          <p className="text-xs font-semibold text-text-primary">{payWallet.easypaisa_number}</p>
                        </div>
                        <span className="text-lg">🟢</span>
                      </div>
                    )}

                    {payWallet.jazzcash_number && (
                      <div className="flex justify-between items-center bg-bg-card p-2.5 rounded-xl border border-border-inner">
                        <div>
                          <p className="text-xs font-semibold text-text-secondary">JazzCash</p>
                          <p className="text-xs font-semibold text-text-primary">{payWallet.jazzcash_number}</p>
                        </div>
                        <span className="text-lg">🔴</span>
                      </div>
                    )}

                    {payWallet.nayapay_number && (
                      <div className="flex justify-between items-center bg-bg-card p-2.5 rounded-xl border border-border-inner">
                        <div>
                          <p className="text-xs font-semibold text-text-secondary">NayaPay</p>
                          <p className="text-xs font-semibold text-text-primary">{payWallet.nayapay_number}</p>
                        </div>
                        <span className="text-lg">🍊</span>
                      </div>
                    )}

                    {payWallet.sadapay_number && (
                      <div className="flex justify-between items-center bg-bg-card p-2.5 rounded-xl border border-border-inner">
                        <div>
                          <p className="text-xs font-semibold text-text-secondary">SadaPay</p>
                          <p className="text-xs font-semibold text-text-primary">{payWallet.sadapay_number}</p>
                        </div>
                        <span className="text-lg">🟢</span>
                      </div>
                    )}

                    {payWallet.bank_account_number && (
                      <div className="border-t border-border-inner pt-2 mt-2">
                        <p className="text-xs font-bold text-text-secondary mb-2">Bank Transfer Details</p>
                        <div className="bg-bg-card p-3 rounded-xl border border-border-inner space-y-1.5">
                          {payWallet.bank_name && (
                            <div>
                              <span className="text-xs text-text-secondary font-semibold">Bank Name:</span>{' '}
                              <span className="text-xs text-text-primary font-semibold">{payWallet.bank_name}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-xs text-text-secondary font-semibold">Account Title:</span>{' '}
                            <span className="text-xs text-text-primary font-semibold">{payWallet.account_title || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-xs text-text-secondary font-semibold">Account Number:</span>{' '}
                            <span className="text-xs text-text-primary font-semibold">{payWallet.bank_account_number}</span>
                          </div>
                          {payWallet.iban && (
                            <div>
                              <span className="text-xs text-text-secondary font-semibold">IBAN:</span>{' '}
                              <span className="text-xs text-text-primary font-semibold">{payWallet.iban}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsPayModalOpen(false)
                  setPayFriend(null)
                  setPayWallet(null)
                }}
                className="flex-1 bg-bg-card-inner border border-border-primary text-text-secondary py-3 rounded-xl text-xs font-bold hover:text-text-primary transition cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={handleSettleDirect}
                disabled={settlingDirect}
                className="flex-1 bg-gradient-to-r from-accent to-[#7c6fd6] text-white py-3 rounded-xl text-xs font-bold hover:opacity-95 active:scale-[0.98] transition cursor-pointer"
              >
                {settlingDirect ? 'Settling...' : 'Mark as Settled'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Nav */}
      <Navbar currentPage="home" />
    </>
  )
}
