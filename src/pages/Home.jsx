import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../config/supabase'
import Navbar from '../components/Navbar'
import Toast from '../components/Toast'
import LoadingPulseOverlay from '../components/Loading'
import { Plus, Search, UserPlus, Users, Share2, TrendingDown, ArrowUpRight, ArrowDownLeft, DollarSign, Wallet, Check, Trash2, Calendar, FileText } from 'lucide-react'

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

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      // 1. Fetch Friends (to choose from in direct transactions and display details)
      // Since friendships are stored as (user_id_1, user_id_2) with user_id_1 < user_id_2
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

      // 3. Compute Direct Balances (only pending transactions)
      const pendingTxs = txs.filter(t => t.status === 'pending')
      let directOwed = 0
      let directOwes = 0

      // Group balances by friend ID
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
          // I created it
          if (t.type === 'lent' || t.type === 'paid') {
            friendBalances[friendId] += Number(t.amount)
          } else {
            friendBalances[friendId] -= Number(t.amount)
          }
        } else {
          // Friend created it
          if (t.type === 'borrowed' || t.type === 'received') {
            friendBalances[friendId] += Number(t.amount)
          } else {
            friendBalances[friendId] -= Number(t.amount)
          }
        }
      })

      // Sum direct balances
      Object.keys(friendBalances).forEach(fId => {
        const bal = friendBalances[fId]
        if (bal > 0) {
          directOwed += bal
        } else if (bal < 0) {
          directOwes += Math.abs(bal)
        }
      })

      // 4. Fetch Group Expenses and Splits to aggregate group balances
      // Get groups user belongs to
      const { data: memberships, error: mError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)

      if (mError) throw mError
      const groupIds = memberships.map(m => m.group_id)

      let groupOwed = 0
      let groupOwes = 0

      if (groupIds.length > 0) {
        // Fetch group expenses paid by user
        const { data: expenses, error: expError } = await supabase
          .from('group_expenses')
          .select('id, amount, payer_id, group_id')
          .in('group_id', groupIds)

        if (expError) throw expError

        // Fetch user's pending splits
        const { data: splits, error: splitError } = await supabase
          .from('group_expense_splits')
          .select('id, share, status, expense:expense_id(group_id, payer_id)')
          .eq('user_id', user.id)
          .eq('status', 'pending')

        if (splitError) throw splitError

        // Compute group net balance
        // We can do it per group
        groupIds.forEach(gId => {
          const paidInGroup = expenses
            .filter(e => e.group_id === gId && e.payer_id === user.id)
            .reduce((sum, e) => sum + Number(e.amount), 0)

          // Shares in group
          // Note: an expense split represents what user owes to the payer.
          // Wait, if U is the payer, other members' splits are owed to U.
          // Let's compute group balance directly:
          // User balance in group = (amount user paid in group) - (user's splits in group)
          // Wait, we need to know what U owes other payers, and what other members owe U!
          // Let's calculate:
          // What U owes to others = sum of pending splits in group where expense.payer_id != U
          const userOwesOthers = splits
            .filter(s => s.expense?.group_id === gId && s.expense?.payer_id !== user.id)
            .reduce((sum, s) => sum + Number(s.share), 0)

          // What others owe U = sum of pending splits in group expenses created by U
          // To calculate this, we look at group expenses where U is payer, and sum splits of other users (which are pending)
          // Let's query pending splits for expenses where U is payer
          // (Instead of querying everything, we can approximate or compute this cleanly by query)
        })

        // A simpler approach for group balances:
        // Total money owed to U in groups = splits where expense.payer = U and split.user != U and status = pending
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

        // Total money U owes in groups = splits where split.user = U and status = pending
        // (already fetched in `splits` variable)
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
      // Reset form
      setTxAmount('')
      setTxDesc('')
      setTxType('lent')
      
      // Refresh dashboard
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
      
      // Fetch friend's wallet details
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

      // Update all transactions between user and friend to 'settled'
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
        .eq('user_id', user.id) // Only creator can delete

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

  // Calculate Net
  const netBalance = owedToMe - iOwe

  return (
    <>
      <Toast show={!!error} message={error} type="error" onClose={() => setError(null)} duration={3500} />
      <Toast show={!!success} message={success} type="success" onClose={() => setSuccess(null)} duration={3500} />

      {loading && <LoadingPulseOverlay />}

      <div className="min-h-screen bg-black text-white px-4 py-8 pb-28 font-figtree">
        <div className="max-w-7xl mx-auto">
          {/* Header Greeting */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-2xl shadow-inner shadow-black/40">
                {profile?.avatar_url || '👋'}
              </div>
              <div>
                <p className="text-xs text-neutral-400 font-medium">Welcome back,</p>
                <h2 className="text-xl font-bold text-white leading-tight">
                  {profile?.full_name || 'User'}
                </h2>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="text-xs font-bold text-red-400/80 bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-full hover:bg-red-500/20 transition cursor-pointer"
            >
              Logout
            </button>
          </div>

          {/* Responsive Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left/Middle side: Balance Summary Card & Recent Transactions */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Card Net Balance Summary */}
              <div className="relative overflow-hidden bg-neutral-900/40 border border-neutral-800/80 rounded-[2rem] p-6 shadow-2xl backdrop-blur-xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl pointer-events-none"></div>
                
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Net Balance</p>
                <h1 className={`text-4xl font-extrabold tracking-tight grad leading-tight ${netBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
                  Rs. {netBalance.toLocaleString()}
                </h1>

                <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-neutral-800/80">
                  <div className="flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
                      <ArrowUpRight className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Owes Me</p>
                      <p className="text-base font-extrabold text-green-400">Rs. {owedToMe.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                      <ArrowDownLeft className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">I Owe</p>
                      <p className="text-base font-extrabold text-red-400">Rs. {iOwe.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Transactions List */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-4 ml-1">
                  <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Recent Transactions</h3>
                </div>

                <div className="flex flex-col gap-3">
                  {recentTransactions.length === 0 ? (
                    <div className="bg-neutral-900/20 border border-dashed border-neutral-800 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                      <FileText className="w-8 h-8 text-neutral-600 mb-2" />
                      <p className="text-xs font-medium text-neutral-500">No transactions recorded yet</p>
                      <button
                        onClick={() => setIsAddTxOpen(true)}
                        className="mt-3 text-xs font-bold text-accent hover:underline bg-transparent border-0 cursor-pointer"
                      >
                        Create one now
                      </button>
                    </div>
                  ) : (
                    recentTransactions.slice(0, 8).map(tx => {
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
                          className="flex items-center justify-between p-4 bg-neutral-900/40 border border-neutral-800/80 rounded-2xl shadow-sm hover:border-neutral-700/60 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center text-lg">
                              {otherParty?.avatar_url || '👤'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-[13px] font-bold text-white leading-tight">
                                  {otherParty?.full_name}
                                </p>
                                <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${tx.status === 'settled' ? 'bg-neutral-800 text-neutral-400' : 'bg-accent/15 text-accent'}`}>
                                  {tx.status}
                                </span>
                              </div>
                              <p className="text-[10px] text-neutral-400 mt-0.5">
                                {displayType} • {tx.description}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className={`text-[13px] font-extrabold ${amountColor}`}>
                                {prefix}Rs. {Number(tx.amount).toLocaleString()}
                              </p>
                              <p className="text-[9px] text-neutral-500 flex items-center gap-1 justify-end mt-0.5">
                                <Calendar className="w-2.5 h-2.5" />
                                {new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </p>
                            </div>

                            {isCreator && (
                              <button
                                onClick={() => handleDeleteTx(tx.id)}
                                className="p-1 text-neutral-600 hover:text-red-400 transition cursor-pointer"
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
            </div>

            {/* Right side: Quick Actions & Friends Balances */}
            <div className="space-y-6">
              
              {/* Quick Actions Grid */}
              <div className="bg-neutral-900/15 border border-neutral-800/60 rounded-3xl p-5">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setIsAddTxOpen(true)}
                    className="flex flex-col items-center justify-center p-3.5 bg-neutral-900/40 border border-neutral-800/80 rounded-2xl gap-2 hover:border-accent/30 transition cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-accent flex-shrink-0">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] text-neutral-300 font-bold leading-tight text-center">Add Direct</span>
                  </button>

                  <button
                    onClick={() => navigate('/friends')}
                    className="flex flex-col items-center justify-center p-3.5 bg-neutral-900/40 border border-neutral-800/80 rounded-2xl gap-2 hover:border-accent/30 transition cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-accent flex-shrink-0">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] text-neutral-300 font-bold leading-tight text-center">Add Friend</span>
                  </button>

                  <button
                    onClick={() => navigate('/groups')}
                    className="flex flex-col items-center justify-center p-3.5 bg-neutral-900/40 border border-neutral-800/80 rounded-2xl gap-2 hover:border-accent/30 transition cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-accent flex-shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] text-neutral-300 font-bold leading-tight text-center">Split Group</span>
                  </button>

                  <button
                    onClick={() => navigate('/spending')}
                    className="flex flex-col items-center justify-center p-3.5 bg-neutral-900/40 border border-neutral-800/80 rounded-2xl gap-2 hover:border-accent/30 transition cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-accent flex-shrink-0">
                      <TrendingDown className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] text-neutral-300 font-bold leading-tight text-center">Track Spend</span>
                  </button>
                </div>
              </div>

              {/* Friends Balance Settlement Quick section */}
              {friends.length > 0 && (
                <div className="bg-neutral-900/15 border border-neutral-800/60 rounded-3xl p-5">
                  <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4">Direct Balances</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {friends.map(f => {
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
                          className="flex items-center justify-between p-3.5 bg-neutral-900/30 border border-neutral-800/60 rounded-2xl"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <span className="text-2xl">{f.avatar_url || '👤'}</span>
                            <div className="overflow-hidden">
                              <p className="text-xs font-bold truncate text-white">{f.full_name}</p>
                              <p className="text-[10px] text-neutral-400 truncate">@{f.username}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-right">
                              {fBal === 0 ? (
                                <span className="text-[10px] font-bold text-neutral-500">Setted</span>
                              ) : fBal > 0 ? (
                                <div className="text-[10px] text-green-400 font-bold">
                                  Owes: <span className="text-xs">Rs. {fBal}</span>
                                </div>
                              ) : (
                                <div className="text-[10px] text-red-400 font-bold">
                                  Owe: <span className="text-xs">Rs. {Math.abs(fBal)}</span>
                                </div>
                              )}
                            </div>

                            {fBal !== 0 && (
                              <button
                                onClick={() => openPaymentModal(f)}
                                className="bg-accent/15 text-accent px-3 py-1.5 rounded-xl text-[10px] font-bold hover:bg-accent/25 transition cursor-pointer"
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
        </div>
      </div>

      {/* Add Direct Transaction Modal */}
      {isAddTxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-[2rem] p-6 shadow-2xl">
            <h2 className="text-xl font-black text-white grad mb-1">Add Direct Transaction</h2>
            <p className="text-xs text-neutral-400 mb-5">Record a direct transaction with a friend.</p>

            <form onSubmit={handleAddTx} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                  Select Friend
                </label>
                <select
                  value={txFriendId}
                  onChange={(e) => setTxFriendId(e.target.value)}
                  className="w-full bg-black border border-neutral-850 focus:border-accent text-white px-3 py-3 rounded-xl text-sm outline-none cursor-pointer"
                  required
                >
                  <option value="" disabled>Choose a friend</option>
                  {friends.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.full_name} (@{f.username})
                    </option>
                  ))}
                </select>
                {friends.length === 0 && (
                  <p className="text-[10px] text-red-400 mt-1 ml-1">You must add friends first to make transactions!</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                    Transaction Type
                  </label>
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value)}
                    className="w-full bg-black border border-neutral-850 focus:border-accent text-white px-3 py-3 rounded-xl text-sm outline-none cursor-pointer"
                  >
                    <option value="lent">Lent (I lent money)</option>
                    <option value="borrowed">Borrowed (I borrowed money)</option>
                    <option value="paid">Paid (I paid friend)</option>
                    <option value="received">Received (Friend paid me)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                    Amount (Rs.)
                  </label>
                  <input
                    type="number"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="500"
                    min="1"
                    className="w-full bg-black border border-neutral-850 focus:border-accent text-white px-4 py-3 rounded-xl text-sm outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  placeholder="Dinner, cab fare, snacks, etc."
                  className="w-full bg-black border border-neutral-850 focus:border-accent text-white px-4 py-3 rounded-xl text-sm outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full bg-black border border-neutral-850 focus:border-accent text-white px-4 py-3 rounded-xl text-sm outline-none"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTxOpen(false)}
                  className="flex-1 bg-neutral-800 text-neutral-300 py-3 rounded-xl text-xs font-bold hover:bg-neutral-750 transition cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-[2rem] p-6 shadow-2xl">
            <h2 className="text-xl font-black text-white grad mb-1">Payment Details</h2>
            <p className="text-xs text-neutral-400 mb-5">
              Send payments directly to {payFriend.full_name} using their saved methods below, then mark the balance as settled.
            </p>

            <div className="space-y-4 mb-6 bg-black/30 p-4 rounded-2xl border border-neutral-850">
              <div className="flex items-center gap-3 pb-3 border-b border-neutral-850">
                <span className="text-3xl">{payFriend.avatar_url || '👤'}</span>
                <div>
                  <p className="text-xs font-bold text-white">{payFriend.full_name}</p>
                  <p className="text-[10px] text-accent font-semibold">@{payFriend.username}</p>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                {(!payWallet || (!payWallet.easypaisa_number && !payWallet.jazzcash_number && !payWallet.nayapay_number && !payWallet.sadapay_number && !payWallet.bank_account_number)) ? (
                  <p className="text-xs text-neutral-500 italic py-2 text-center">
                    No payment methods configured by this user.
                  </p>
                ) : (
                  <>
                    {payWallet.easypaisa_number && (
                      <div className="flex justify-between items-center bg-black/20 p-2.5 rounded-xl border border-neutral-850/40">
                        <div>
                          <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">EasyPaisa</p>
                          <p className="text-xs font-semibold text-neutral-200">{payWallet.easypaisa_number}</p>
                        </div>
                        <span className="text-lg">🟢</span>
                      </div>
                    )}

                    {payWallet.jazzcash_number && (
                      <div className="flex justify-between items-center bg-black/20 p-2.5 rounded-xl border border-neutral-850/40">
                        <div>
                          <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">JazzCash</p>
                          <p className="text-xs font-semibold text-neutral-200">{payWallet.jazzcash_number}</p>
                        </div>
                        <span className="text-lg">🔴</span>
                      </div>
                    )}

                    {payWallet.nayapay_number && (
                      <div className="flex justify-between items-center bg-black/20 p-2.5 rounded-xl border border-neutral-850/40">
                        <div>
                          <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">NayaPay</p>
                          <p className="text-xs font-semibold text-neutral-200">{payWallet.nayapay_number}</p>
                        </div>
                        <span className="text-lg">🍊</span>
                      </div>
                    )}

                    {payWallet.sadapay_number && (
                      <div className="flex justify-between items-center bg-black/20 p-2.5 rounded-xl border border-neutral-850/40">
                        <div>
                          <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">SadaPay</p>
                          <p className="text-xs font-semibold text-neutral-200">{payWallet.sadapay_number}</p>
                        </div>
                        <span className="text-lg">🟢</span>
                      </div>
                    )}

                    {payWallet.bank_account_number && (
                      <div className="border-t border-neutral-850/65 pt-2 mt-2">
                        <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Bank Transfer Details</p>
                        <div className="bg-black/20 p-3 rounded-xl border border-neutral-850/40 space-y-1.5">
                          {payWallet.bank_name && (
                            <div>
                              <span className="text-[9px] text-neutral-500 font-bold">Bank Name:</span>{' '}
                              <span className="text-xs text-neutral-200 font-semibold">{payWallet.bank_name}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-[9px] text-neutral-500 font-bold">Account Title:</span>{' '}
                            <span className="text-xs text-neutral-200 font-semibold">{payWallet.account_title || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-neutral-500 font-bold">Account Number:</span>{' '}
                            <span className="text-xs text-neutral-200 font-semibold">{payWallet.bank_account_number}</span>
                          </div>
                          {payWallet.iban && (
                            <div>
                              <span className="text-[9px] text-neutral-500 font-bold">IBAN:</span>{' '}
                              <span className="text-xs text-neutral-200 font-semibold">{payWallet.iban}</span>
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
                className="flex-1 bg-neutral-800 text-neutral-300 py-3 rounded-xl text-xs font-bold hover:bg-neutral-750 transition cursor-pointer"
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
