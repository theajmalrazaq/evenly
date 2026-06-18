import React, { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../config/supabase'
import Navbar from '../components/Navbar'
import Toast from '../components/Toast'
import LoadingPulseOverlay from '../components/Loading'
import { Plus, Users, Layers, ArrowLeft, ArrowUpRight, ArrowDownLeft, DollarSign, Check, ChevronRight, FileText, Calendar, Wallet } from 'lucide-react'

export default function Groups() {
  const { user } = useAuth()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Groups and Friends data
  const [groups, setGroups] = useState([])
  const [friends, setFriends] = useState([])
  
  // Selected Group details
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [groupMembers, setGroupMembers] = useState([])
  const [groupExpenses, setGroupExpenses] = useState([])
  const [groupSplits, setGroupSplits] = useState([])

  // Create Group Form
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [selectedFriends, setSelectedFriends] = useState([]) // Array of friend IDs
  const [creatingGroup, setCreatingGroup] = useState(false)

  // Add Expense Form
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false)
  const [expenseTitle, setExpenseTitle] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expensePayerId, setExpensePayerId] = useState('')
  const [submittingExpense, setSubmittingExpense] = useState(false)

  // Fetch all groups and friends lists
  const fetchInitialData = async () => {
    try {
      setLoading(true)
      setError(null)

      // 1. Fetch groups user belongs to
      const { data: memberships, error: mError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)

      if (mError) throw mError
      const groupIds = memberships.map(m => m.group_id)

      if (groupIds.length > 0) {
        const { data: groupsList, error: gError } = await supabase
          .from('groups')
          .select('*')
          .in('id', groupIds)
          .order('created_at', { ascending: false })

        if (gError) throw gError
        setGroups(groupsList || [])
      } else {
        setGroups([])
      }

      // 2. Fetch friends to create groups with
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

    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to fetch initial data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInitialData()
  }, [])

  // Fetch details of a single selected group
  const fetchGroupDetails = async (groupId) => {
    try {
      setLoading(true)
      setError(null)
      
      // 1. Fetch group metadata
      const { data: group, error: gError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .maybeSingle()

      if (gError) throw gError
      if (!group) throw new Error('Group not found')
      setSelectedGroup(group)

      // 2. Fetch group members profiles
      const { data: members, error: mError } = await supabase
        .from('group_members')
        .select('user_id, profiles(*)')
        .eq('group_id', groupId)

      if (mError) throw mError
      
      const memberProfiles = members.map(m => m.profiles)
      setGroupMembers(memberProfiles)

      setExpensePayerId(user.id)

      // 3. Fetch group expenses
      const { data: expenses, error: eError } = await supabase
        .from('group_expenses')
        .select(`
          *,
          payer:payer_id(id, username, full_name, avatar_url)
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })

      if (eError) throw eError
      setGroupExpenses(expenses || [])

      // 4. Fetch splits for all these expenses
      const expIds = expenses.map(e => e.id)
      if (expIds.length > 0) {
        const { data: splits, error: sError } = await supabase
          .from('group_expense_splits')
          .select('*')
          .in('expense_id', expIds)

        if (sError) throw sError
        setGroupSplits(splits || [])
      } else {
        setGroupSplits([])
      }

    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to fetch group details')
      setSelectedGroupId(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedGroupId) {
      fetchGroupDetails(selectedGroupId)
    }
  }, [selectedGroupId])

  // Handle Create Group Submit
  const handleCreateGroup = async (e) => {
    e.preventDefault()
    if (!groupName.trim()) {
      setError('Group name is required')
      return
    }

    setCreatingGroup(true)
    setError(null)

    try {
      const { data: group, error: gError } = await supabase
        .from('groups')
        .insert({
          name: groupName.trim(),
          created_by: user.id
        })
        .select()
        .single()

      if (gError) throw gError

      const memberInserts = [user.id, ...selectedFriends].map(uId => ({
        group_id: group.id,
        user_id: uId
      }))

      const { error: mError } = await supabase
        .from('group_members')
        .insert(memberInserts)

      if (mError) throw mError

      setSuccess('Group created successfully!')
      setIsCreateOpen(false)
      setGroupName('')
      setSelectedFriends([])
      
      await fetchInitialData()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to create group')
    } finally {
      setCreatingGroup(false)
    }
  }

  // Handle Add Expense
  const handleAddExpense = async (e) => {
    e.preventDefault()
    if (!expenseTitle.trim() || !expenseAmount || !expensePayerId) {
      setError('All fields are required')
      return
    }

    setSubmittingExpense(true)
    setError(null)

    try {
      const amount = Number(expenseAmount)
      const numMembers = groupMembers.length
      const share = amount / numMembers

      // 1. Insert expense
      const { data: exp, error: eError } = await supabase
        .from('group_expenses')
        .insert({
          group_id: selectedGroupId,
          payer_id: expensePayerId,
          amount: amount,
          title: expenseTitle.trim(),
          is_settlement: false
        })
        .select()
        .single()

      if (eError) throw eError

      // 2. Insert splits for all members
      const splitInserts = groupMembers.map(m => ({
        expense_id: exp.id,
        user_id: m.id,
        share: Number(share.toFixed(2)),
        status: m.id === expensePayerId ? 'settled' : 'pending'
      }))

      const { error: sError } = await supabase
        .from('group_expense_splits')
        .insert(splitInserts)

      if (sError) throw sError

      setSuccess('Expense added and split equally!')
      setIsAddExpenseOpen(false)
      setExpenseTitle('')
      setExpenseAmount('')
      
      await fetchGroupDetails(selectedGroupId)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to add expense')
    } finally {
      setSubmittingExpense(false)
    }
  }

  // Handle Group Settlement (direct payout to settle balance)
  const handleRecordSettlement = async (fromUserId, toUserId, amountToPay, fromName, toName) => {
    if (!window.confirm(`Record a payment of Rs. ${amountToPay} from ${fromName} to ${toName}?`)) return

    try {
      setLoading(true)
      setError(null)

      const { data: exp, error: eError } = await supabase
        .from('group_expenses')
        .insert({
          group_id: selectedGroupId,
          payer_id: fromUserId,
          amount: amountToPay,
          title: `Settled: ${fromName} paid ${toName}`,
          is_settlement: true
        })
        .select()
        .single()

      if (eError) throw eError

      const { error: sError } = await supabase
        .from('group_expense_splits')
        .insert({
          expense_id: exp.id,
          user_id: toUserId,
          share: amountToPay,
          status: 'settled'
        })

      if (sError) throw sError

      setSuccess('Settlement payment recorded!')
      await fetchGroupDetails(selectedGroupId)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to record settlement')
    } finally {
      setLoading(false)
    }
  }

  // Toggle friend selection for new group
  const toggleFriendSelect = (fId) => {
    if (selectedFriends.includes(fId)) {
      setSelectedFriends(prev => prev.filter(id => id !== fId))
    } else {
      setSelectedFriends(prev => [...prev, fId])
    }
  }

  // --- CALCULATION OF GROUP BALANCES & SETTLEMENT SUGGESTIONS ---
  const calculateBalances = () => {
    if (!selectedGroupId || groupMembers.length === 0) return { memberBalances: {}, settlements: [] }

    const memberBalances = {}
    
    groupMembers.forEach(m => {
      memberBalances[m.id] = {
        profile: m,
        paid: 0,
        share: 0,
        net: 0
      }
    })

    groupExpenses.forEach(exp => {
      if (memberBalances[exp.payer_id]) {
        memberBalances[exp.payer_id].paid += Number(exp.amount)
      }
    })

    groupSplits.forEach(split => {
      if (memberBalances[split.user_id]) {
        memberBalances[split.user_id].share += Number(split.share)
      }
    })

    Object.keys(memberBalances).forEach(id => {
      const mb = memberBalances[id]
      mb.net = Number((mb.paid - mb.share).toFixed(2))
    })

    const debtors = []
    const creditors = []

    Object.keys(memberBalances).forEach(id => {
      const mb = memberBalances[id]
      if (mb.net < -0.1) {
        debtors.push({ id, name: mb.profile.full_name, net: mb.net })
      } else if (mb.net > 0.1) {
        creditors.push({ id, name: mb.profile.full_name, net: mb.net })
      }
    })

    debtors.sort((a, b) => a.net - b.net)
    creditors.sort((a, b) => b.net - a.net)

    const settlements = []
    let dIdx = 0
    let cIdx = 0

    const dNets = debtors.map(d => ({ ...d }))
    const cNets = creditors.map(c => ({ ...c }))

    while (dIdx < dNets.length && cIdx < cNets.length) {
      const debtor = dNets[dIdx]
      const creditor = cNets[cIdx]

      const oweAmount = Math.abs(debtor.net)
      const creditAmount = creditor.net

      const settleVal = Number(Math.min(oweAmount, creditAmount).toFixed(2))

      settlements.push({
        fromId: debtor.id,
        fromName: debtor.name,
        toId: creditor.id,
        toName: creditor.name,
        amount: settleVal
      })

      debtor.net += settleVal
      creditor.net -= settleVal

      if (Math.abs(debtor.net) < 0.1) dIdx++
      if (creditor.net < 0.1) cIdx++
    }

    return { memberBalances, settlements }
  }

  const { memberBalances, settlements } = calculateBalances()

  return (
    <>
      <Toast show={!!error} message={error} type="error" onClose={() => setError(null)} duration={3500} />
      <Toast show={!!success} message={success} type="success" onClose={() => setSuccess(null)} duration={3500} />

      {loading && <LoadingPulseOverlay />}

      <div className="min-h-screen bg-bg-app text-text-primary px-4 py-6 pb-28 font-figtree transition-colors duration-300">
        <div className="max-w-md mx-auto space-y-6">
          
          {/* Left Panel: Group List */}
          <div className={`bg-bg-card border border-border-primary rounded-3xl p-5 shadow-sm ${
            selectedGroupId !== null ? 'hidden' : 'block'
          }`}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-xl font-black text-text-primary grad">Groups</h1>
                  <p className="text-[10px] text-text-secondary">Manage shared bills and splits</p>
                </div>
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="bg-accent/15 border border-accent/25 text-accent p-2 rounded-full hover:bg-accent/20 transition cursor-pointer"
                >
                  <Plus className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {groups.length === 0 ? (
                  <div className="bg-bg-card border border-dashed border-border-primary rounded-2xl p-6 text-center">
                    <Layers className="w-6 h-6 text-text-secondary/60 mb-2 mx-auto" />
                    <p className="text-xs font-semibold text-text-secondary">No groups yet</p>
                    <button
                      onClick={() => setIsCreateOpen(true)}
                      className="mt-2 text-xs font-bold text-accent hover:underline bg-transparent border-0 cursor-pointer"
                    >
                      Create a group
                    </button>
                  </div>
                ) : (
                  groups.map(g => (
                    <div
                      key={g.id}
                      onClick={() => setSelectedGroupId(g.id)}
                      className={`flex items-center justify-between p-4 rounded-xl cursor-pointer border transition ${
                        selectedGroupId === g.id
                          ? 'bg-accent/10 border-accent/40'
                          : 'bg-bg-card-inner border-border-primary hover:border-accent/40'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center text-accent flex-shrink-0">
                          <Users className="w-4 h-4" />
                        </div>
                        <p className="text-xs font-bold truncate text-text-primary leading-tight">{g.name}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-text-secondary flex-shrink-0" />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Panel: Group Details */}
            <div className={selectedGroupId === null ? 'hidden' : 'block'}>
              {selectedGroupId === null ? (
                <div className="bg-bg-card border border-dashed border-border-primary rounded-3xl p-16 text-center flex flex-col items-center justify-center min-h-[300px]">
                  <Layers className="w-12 h-12 text-text-secondary/60 mb-3" />
                  <h3 className="text-sm font-bold text-text-secondary">No Group Selected</h3>
                  <p className="text-xs text-text-secondary/80 mt-2 max-w-[240px]">
                    Select a group from the list on the left to view split balances, settlements, and expenses.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Back Header */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setSelectedGroupId(null)
                        setSelectedGroup(null)
                      }}
                      className="p-2 bg-bg-card border border-border-primary rounded-full text-text-secondary hover:text-text-primary transition cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h2 className="text-xl font-bold text-text-primary leading-tight">{selectedGroup?.name}</h2>
                      <p className="text-xs text-text-secondary font-medium">Split group ({groupMembers.length} members)</p>
                    </div>
                  </div>

                  {/* Quick Summary Balance in Group */}
                  {memberBalances[user.id] && (
                    <div className="bg-bg-card border border-border-primary rounded-[1.8rem] p-5 shadow-sm">
                      <p className="text-xs font-semibold text-text-secondary mb-1">Your Group Status</p>
                      {memberBalances[user.id].net === 0 ? (
                        <h1 className="text-2xl font-black text-text-secondary">All Settled Up</h1>
                      ) : memberBalances[user.id].net > 0 ? (
                        <div>
                          <h1 className="text-2xl font-black text-green-400">Owed Rs. {memberBalances[user.id].net}</h1>
                          <p className="text-xs text-text-secondary mt-0.5">Other group members owe you this total amount</p>
                        </div>
                      ) : (
                        <div>
                          <h1 className="text-2xl font-black text-red-400">You Owe Rs. {Math.abs(memberBalances[user.id].net)}</h1>
                          <p className="text-xs text-text-secondary mt-0.5 font-medium">Pay back to settle group balances</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Suggested Settlements Section */}
                  {settlements.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-text-primary mb-3 ml-1">Suggested Settlements</h3>
                      <div className="flex flex-col gap-3">
                        {settlements.map((s, idx) => {
                          const isUserDebtor = s.fromId === user.id
                          const isUserCreditor = s.toId === user.id

                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-4 bg-bg-card-inner border border-border-primary rounded-2xl"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-xs">
                                  💡
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-text-primary">
                                    {s.fromName} owes {s.toName}
                                  </p>
                                  <p className="text-xs text-accent font-semibold">Rs. {s.amount}</p>
                                </div>
                              </div>

                              {(isUserDebtor || isUserCreditor) && (
                                <button
                                  onClick={() => handleRecordSettlement(s.fromId, s.toId, s.amount, s.fromName, s.toName)}
                                  className="bg-accent/10 border border-accent/20 text-accent px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-accent/20 transition cursor-pointer"
                                >
                                  Mark Paid
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Add Expense Action Button */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsAddExpenseOpen(true)}
                      className="flex-1 bg-gradient-to-r from-accent to-[#7c6fd6] hover:opacity-95 text-white py-3.5 rounded-2xl font-bold text-sm transition shadow-md shadow-accent/10 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Add Expense
                    </button>
                  </div>

                  {/* Expenses History */}
                  <div>
                    <h3 className="text-sm font-bold text-text-primary mb-4 ml-1">Expenses History</h3>
                    <div className="flex flex-col gap-3">
                      {groupExpenses.length === 0 ? (
                        <div className="bg-bg-card border border-dashed border-border-primary rounded-2xl p-6 text-center">
                          <p className="text-xs text-text-secondary">No expenses split in this group yet</p>
                        </div>
                      ) : (
                        groupExpenses.map(exp => (
                          <div
                            key={exp.id}
                            className="flex items-center justify-between p-4 bg-bg-card-inner border border-border-primary rounded-2xl"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-bg-card border border-border-primary flex items-center justify-center text-base shadow-sm">
                                {exp.is_settlement ? '🤝' : '💸'}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-text-primary leading-tight">{exp.title}</p>
                                <p className="text-xs text-text-secondary mt-0.5">
                                  {exp.is_settlement ? '' : `Paid by ${exp.payer?.full_name}`}
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              <p className="text-xs font-extrabold text-text-primary">Rs. {exp.amount}</p>
                              <p className="text-xs text-text-secondary flex items-center gap-1 justify-end mt-0.5 font-semibold">
                                <Calendar className="w-2.5 h-2.5" />
                                {new Date(exp.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

        </div>
      </div>

      {/* ========================================================
         CREATE GROUP MODAL
         ======================================================== */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-bg-card border border-border-primary rounded-[2rem] p-6 shadow-2xl">
            <h2 className="text-xl font-black text-text-primary grad mb-1">Create Split Group</h2>
            <p className="text-xs text-text-secondary mb-5">Create a group and add friends to split expenses equally.</p>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2 ml-1">
                  Group Name
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Flatmates, Trips, Dinner Out"
                  className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary px-4 py-3 rounded-xl text-sm outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2 ml-1">
                  Select Friends ({selectedFriends.length} selected)
                </label>
                
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1 no-scrollbar">
                  {friends.length === 0 ? (
                    <p className="text-xs text-red-400 italic">You must have friends to split expenses. Add friends in the Friends tab!</p>
                  ) : (
                    friends.map(f => {
                      const isSelected = selectedFriends.includes(f.id)
                      return (
                        <div
                          key={f.id}
                          onClick={() => toggleFriendSelect(f.id)}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                            isSelected
                              ? 'bg-accent/10 border-accent text-text-primary'
                              : 'bg-bg-card-inner border-border-primary text-text-secondary'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{f.avatar_url || '👤'}</span>
                            <div>
                              <p className="text-xs font-bold">{f.full_name}</p>
                              <p className="text-xs opacity-70">@{f.username}</p>
                            </div>
                          </div>

                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected ? 'bg-accent border-accent text-white' : 'border-neutral-600'
                          }`}>
                            {isSelected && <Check className="w-2.5 h-2.5" />}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="flex-1 bg-bg-card-inner border border-border-primary text-text-secondary py-3 rounded-xl text-xs font-bold hover:text-text-primary transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingGroup || friends.length === 0}
                  className="flex-1 bg-gradient-to-r from-accent to-[#7c6fd6] text-white py-3 rounded-xl text-xs font-bold hover:opacity-95 active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
                >
                  {creatingGroup ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
         ADD EXPENSE MODAL
         ======================================================== */}
      {isAddExpenseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-bg-card border border-border-primary rounded-[2rem] p-6 shadow-2xl">
            <h2 className="text-xl font-black text-text-primary grad mb-1">Add Group Expense</h2>
            <p className="text-xs text-text-secondary mb-5">
              Enter expense details. The amount will be split equally among all members.
            </p>

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2 ml-1">
                  Expense Title
                </label>
                <input
                  type="text"
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  placeholder="Dinner, snacks, taxi ride..."
                  className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary px-4 py-3 rounded-xl text-sm outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-2 ml-1">
                    Amount (Rs.)
                  </label>
                  <input
                    type="number"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="1200"
                    min="1"
                    className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary px-4 py-3 rounded-xl text-sm outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-2 ml-1">
                    Paid By
                  </label>
                  <select
                    value={expensePayerId}
                    onChange={(e) => setExpensePayerId(e.target.value)}
                    className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary px-3 py-3 rounded-xl text-sm outline-none cursor-pointer"
                    required
                  >
                    {groupMembers.map(m => (
                      <option key={m.id} value={m.id} className="bg-bg-input text-text-primary">
                        {m.id === user.id ? 'You' : m.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="flex-1 bg-bg-card-inner border border-border-primary text-text-secondary py-3 rounded-xl text-xs font-bold hover:text-text-primary transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingExpense}
                  className="flex-1 bg-gradient-to-r from-accent to-[#7c6fd6] text-white py-3 rounded-xl text-xs font-bold hover:opacity-95 active:scale-[0.98] transition cursor-pointer"
                >
                  {submittingExpense ? 'Adding...' : 'Add & Split'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Navbar currentPage="groups" />
    </>
  )
}
