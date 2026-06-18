import React, { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../config/supabase'
import Navbar from '../components/Navbar'
import Toast from '../components/Toast'
import LoadingPulseOverlay from '../components/Loading'
import { Search, UserPlus, UserCheck, UserMinus, Clock, Users, Check, X, ArrowLeft, Landmark, Wallet, Send } from 'lucide-react'

export default function Friends() {
  const { user } = useAuth()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Friends data
  const [friends, setFriends] = useState([])
  const [incomingRequests, setIncomingRequests] = useState([])
  const [outgoingRequests, setOutgoingRequests] = useState([])

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  // Settlement Modal States (Inspired by Transfer mockup)
  const [isPayModalOpen, setIsPayModalOpen] = useState(false)
  const [payFriend, setPayFriend] = useState(null)
  const [payWallet, setPayWallet] = useState(null)
  const [settlingDirect, setSettlingDirect] = useState(false)
  const [transferType, setTransferType] = useState('wallet') // bank or wallet

  // Fetch Friends lists and requests
  const fetchFriendsData = async () => {
    try {
      setLoading(true)
      setError(null)

      // 1. Fetch friendships
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

      // 2. Fetch friend requests
      const { data: requests, error: rError } = await supabase
        .from('friend_requests')
        .select(`
          id,
          status,
          sender:sender_id(id, username, full_name, avatar_url),
          receiver:receiver_id(id, username, full_name, avatar_url)
        `)
        .eq('status', 'pending')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)

      if (rError) throw rError

      const incoming = requests.filter(r => r.receiver.id === user.id)
      const outgoing = requests.filter(r => r.sender.id === user.id)

      setIncomingRequests(incoming)
      setOutgoingRequests(outgoing)

    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to fetch friends data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFriendsData()
  }, [])

  // Search Users
  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    try {
      setSearching(true)
      setError(null)

      const { data: users, error: sError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .neq('id', user.id)
        .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
        .limit(10)

      if (sError) throw sError

      setSearchResults(users || [])
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to search users')
    } finally {
      setSearching(false)
    }
  }

  // Send Friend Request
  const sendFriendRequest = async (receiverId, receiverName) => {
    try {
      setLoading(true)
      setError(null)

      const { error: reqError } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          status: 'pending'
        })

      if (reqError) {
        if (reqError.code === '23505') {
          throw new Error('A friend request is already pending between you two!')
        }
        throw reqError
      }

      setSuccess(`Friend request sent to ${receiverName}!`)
      await fetchFriendsData()
      setSearchResults(prev => prev.filter(u => u.id !== receiverId))
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to send request')
    } finally {
      setLoading(false)
    }
  }

  // Accept Friend Request
  const acceptRequest = async (requestId, senderId, senderName) => {
    try {
      setLoading(true)
      setError(null)

      const { error: uError } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId)

      if (uError) throw uError

      const orderedIds = [user.id, senderId].sort()
      const { error: fError } = await supabase
        .from('friendships')
        .insert({
          user_id_1: orderedIds[0],
          user_id_2: orderedIds[1]
        })

      if (fError) throw fError

      setSuccess(`You are now friends with ${senderName}!`)
      await fetchFriendsData()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to accept request')
    } finally {
      setLoading(false)
    }
  }

  // Reject Friend Request
  const rejectRequest = async (requestId, senderName) => {
    try {
      setLoading(true)
      setError(null)

      const { error: dError } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', requestId)

      if (dError) throw dError

      setSuccess(`Friend request from ${senderName} declined`)
      await fetchFriendsData()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to reject request')
    } finally {
      setLoading(false)
    }
  }

  // Remove Friend
  const removeFriend = async (friendId, friendName) => {
    if (!window.confirm(`Are you sure you want to remove ${friendName} from your friends list?`)) return

    try {
      setLoading(true)
      setError(null)

      const { error: fError } = await supabase
        .from('friendships')
        .delete()
        .or(`and(user_id_1.eq.${user.id},user_id_2.eq.${friendId}),and(user_id_1.eq.${friendId},user_id_2.eq.${user.id})`)

      if (fError) throw fError

      await supabase
        .from('friend_requests')
        .delete()
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)

      setSuccess(`${friendName} removed from friends.`)
      await fetchFriendsData()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to remove friend')
    } finally {
      setLoading(false)
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
      
      if (walletDetails?.bank_account_number) {
        setTransferType('bank')
      } else {
        setTransferType('wallet')
      }
    } catch (err) {
      console.error(err)
      setError('Failed to fetch friend\'s payment methods')
    } finally {
      setLoading(false)
    }
  }

  // Change selected friend inside settle modal
  const fetchFriendWallet = async (friendId) => {
    try {
      const { data: walletDetails, error: wError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', friendId)
        .maybeSingle()

      if (wError) throw wError
      setPayWallet(walletDetails || {})
      
      if (walletDetails?.bank_account_number) {
        setTransferType('bank')
      } else {
        setTransferType('wallet')
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Settle Balances
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
      await fetchFriendsData()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to settle balance')
    } finally {
      setSettlingDirect(false)
    }
  }

  return (
    <>
      <Toast show={!!error} message={error} type="error" onClose={() => setError(null)} duration={3500} />
      <Toast show={!!success} message={success} type="success" onClose={() => setSuccess(null)} duration={3500} />

      {loading && <LoadingPulseOverlay />}

      <div className="min-h-screen bg-bg-app text-text-primary px-4 py-8 pb-28 font-figtree transition-colors duration-300">
        <div className="max-w-md mx-auto space-y-6">
          
          {/* Title */}
          <div>
            <h1 className="text-2xl font-black text-text-primary grad">Friends</h1>
            <p className="text-xs text-text-secondary">Add friends to start tracking shared expenses</p>
          </div>

          {/* Grid Layout */}
          <div className="space-y-6">
            
            {/* Friends List Card */}
            <div className="bg-bg-card border border-border-primary rounded-3xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-text-secondary" /> Active Friends ({friends.length})
              </h3>

              <div className="flex flex-col gap-3">
                {friends.length === 0 ? (
                  <div className="bg-bg-card border border-dashed border-border-primary rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                    <Users className="w-8 h-8 text-text-secondary/60 mb-2" />
                    <p className="text-xs font-medium text-text-secondary">No friends added yet</p>
                    <p className="text-xs text-text-secondary/60 mt-1 max-w-[200px] mx-auto">
                      Use the search panel below to find friends and send requests!
                    </p>
                  </div>
                ) : (
                  friends.map(friend => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between p-3.5 bg-bg-card-inner border border-border-primary rounded-2xl hover:border-accent/40 transition-all duration-205"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{friend.avatar_url || '👤'}</span>
                        <div>
                          <p className="text-xs font-bold text-text-primary">{friend.full_name}</p>
                          <p className="text-xs text-text-secondary font-medium">@{friend.username}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openPaymentModal(friend)}
                          className="bg-accent/15 border border-accent/20 text-accent px-3 py-2 rounded-xl text-xs font-bold hover:bg-accent/25 transition cursor-pointer"
                        >
                          Settle
                        </button>
                        <button
                          onClick={() => removeFriend(friend.id, friend.full_name)}
                          className="p-2 bg-red-500/10 border border-red-500/10 text-red-400/80 rounded-xl hover:bg-red-500/20 hover:text-red-400 transition cursor-pointer"
                          title="Remove Friend"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Find Friends Search Box */}
            <div className="bg-bg-card border border-border-primary rounded-3xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-text-primary mb-4">Find Friends</h3>
              
              <form onSubmit={handleSearch} className="relative mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Username or full name..."
                  className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary pl-10 pr-4 py-3 rounded-2xl text-sm outline-none transition-all duration-200"
                  required
                />
                <Search className="absolute left-3.5 top-3.5 text-text-secondary w-3.5 h-3.5" />
                <button
                  type="submit"
                  disabled={searching}
                  className="absolute right-2 top-2 bg-accent text-white px-2.5 py-1.5 rounded-xl text-xs font-bold hover:opacity-95 transition cursor-pointer"
                >
                  {searching ? '...' : 'Search'}
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-text-secondary mb-2 ml-1">Search Results</h4>
                  <div className="flex flex-col gap-2">
                    {searchResults.map(sUser => {
                      const isFriend = friends.some(f => f.id === sUser.id)
                      const isSentPending = outgoingRequests.some(r => r.receiver.id === sUser.id)
                      const isRecvPending = incomingRequests.some(r => r.sender.id === sUser.id)

                      return (
                        <div key={sUser.id} className="flex items-center justify-between py-2 border-b border-border-inner last:border-b-0">
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <span className="text-xl">{sUser.avatar_url || '👤'}</span>
                            <div className="overflow-hidden">
                              <p className="text-xs font-bold truncate text-text-primary leading-tight">{sUser.full_name}</p>
                              <p className="text-xs text-text-secondary truncate">@{sUser.username}</p>
                            </div>
                          </div>

                          <div className="flex-shrink-0">
                            {isFriend ? (
                              <span className="text-xs font-bold text-green-400 flex items-center gap-1">
                                <UserCheck className="w-3 h-3" /> Friends
                              </span>
                            ) : isSentPending ? (
                              <span className="text-xs font-bold text-text-secondary flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Sent
                              </span>
                            ) : isRecvPending ? (
                              <span className="text-xs font-bold text-accent">Pending</span>
                            ) : (
                              <button
                                  onClick={() => sendFriendRequest(sUser.id, sUser.full_name)}
                                  className="bg-accent/10 border border-accent/20 text-accent px-2 py-1 rounded-xl text-xs font-bold hover:bg-accent/20 transition cursor-pointer flex items-center gap-0.5"
                                >
                                  <UserPlus className="w-3 h-3" /> Add
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

            {/* Incoming requests */}
            {incomingRequests.length > 0 && (
              <div className="bg-bg-card border border-border-primary rounded-3xl p-5 shadow-sm">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent" /> Incoming Requests ({incomingRequests.length})
                </h3>
                <div className="flex flex-col gap-3">
                  {incomingRequests.map(req => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-3.5 bg-accent/5 border border-accent/20 rounded-2xl animate-pulse"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <span className="text-2xl">{req.sender.avatar_url || '👤'}</span>
                        <div className="overflow-hidden">
                           <p className="text-xs font-bold truncate text-text-primary leading-tight">{req.sender.full_name}</p>
                           <p className="text-xs text-accent truncate font-semibold">@{req.sender.username}</p>
                        </div>
                      </div>

                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => acceptRequest(req.id, req.sender.id, req.sender.full_name)}
                          className="bg-green-500/10 border border-green-500/20 text-green-400 p-1.5 rounded-xl hover:bg-green-500/20 transition cursor-pointer"
                          title="Accept"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => rejectRequest(req.id, req.sender.full_name)}
                          className="bg-red-500/10 border border-red-500/20 text-red-400 p-1.5 rounded-xl hover:bg-red-500/20 transition cursor-pointer"
                          title="Decline"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ========================================================
         TRANSFER / SETTLEMENT MODAL (Redesigned Settle Modal)
         ======================================================== */}
      {isPayModalOpen && payFriend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-bg-card border border-border-primary rounded-[2.5rem] p-6 shadow-2xl space-y-6">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setIsPayModalOpen(false)
                  setPayFriend(null)
                  setPayWallet(null)
                }}
                className="w-8 h-8 rounded-full bg-bg-card-inner border border-border-primary text-text-secondary flex items-center justify-center hover:text-text-primary transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="text-base font-black text-text-primary">Transfer</h2>
              <div className="w-8"></div> {/* Spacer */}
            </div>

            {/* Transfer Type Tabs (Inspired by mockup) */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTransferType('bank')}
                className={`flex items-center justify-center gap-2 py-3 rounded-2xl border text-xs font-black transition cursor-pointer ${
                  transferType === 'bank'
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                    : 'bg-bg-card-inner border-border-primary text-text-secondary'
                }`}
              >
                🏦 Transfer to Bank
              </button>
              <button
                type="button"
                onClick={() => setTransferType('wallet')}
                className={`flex items-center justify-center gap-2 py-3 rounded-2xl border text-xs font-black transition cursor-pointer ${
                  transferType === 'wallet'
                    ? 'bg-accent/15 border-accent/30 text-accent'
                    : 'bg-bg-card-inner border-border-primary text-text-secondary'
                }`}
              >
                👥 Transfer to People
              </button>
            </div>

            {/* Dynamic Inputs Form */}
            <div className="space-y-4">
              
              {/* Recipient Name Field */}
              <div>
                 <label className="block text-xs font-semibold text-text-secondary mb-1.5 ml-1">
                  Recipient Name
                </label>
                <input
                  type="text"
                  value={payFriend.full_name}
                  disabled
                  className="w-full bg-bg-card-inner border border-border-input text-text-secondary px-4 py-3 rounded-2xl text-xs font-semibold outline-none opacity-85"
                />
              </div>

              {/* Recipient Account Details Field */}
              {transferType === 'bank' ? (
                /* Bank Transfer Fields */
                <div className="bg-bg-card-inner/50 p-4 rounded-3xl border border-border-primary space-y-3">
                  {payWallet?.bank_account_number ? (
                    <>
                      <div>
                        <span className="text-xs font-semibold text-text-secondary block mb-0.5">Bank Name</span>
                        <p className="text-xs font-black text-text-primary">{payWallet.bank_name || 'N/A'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-xs font-semibold text-text-secondary block mb-0.5">Account Title</span>
                          <p className="text-xs font-black text-text-primary truncate">{payWallet.account_title || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-text-secondary block mb-0.5">Account Number</span>
                          <p className="text-xs font-black text-text-primary">{payWallet.bank_account_number}</p>
                        </div>
                      </div>
                      {payWallet?.iban && (
                        <div>
                          <span className="text-xs font-semibold text-text-secondary block mb-0.5">IBAN</span>
                          <p className="text-xs font-black text-text-primary">{payWallet.iban}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-text-secondary italic text-center py-2">
                      No bank details configured by this friend.
                    </p>
                  )}
                </div>
              ) : (
                /* Mobile Wallet Fields */
                <div className="bg-bg-card-inner/50 p-4 rounded-3xl border border-border-primary space-y-3">
                  {(!payWallet || (!payWallet.easypaisa_number && !payWallet.jazzcash_number && !payWallet.nayapay_number && !payWallet.sadapay_number)) ? (
                    <p className="text-xs text-text-secondary italic text-center py-2">
                      No mobile wallets configured by this friend.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {payWallet.easypaisa_number && (
                        <div className="flex justify-between items-center bg-bg-card px-3 py-2 rounded-xl border border-border-inner">
                          <span className="text-xs font-semibold text-text-primary">🟢 EasyPaisa</span>
                          <span className="text-xs font-black text-text-primary">{payWallet.easypaisa_number}</span>
                        </div>
                      )}
                      {payWallet.jazzcash_number && (
                        <div className="flex justify-between items-center bg-bg-card px-3 py-2 rounded-xl border border-border-inner">
                          <span className="text-xs font-semibold text-text-primary">🔴 JazzCash</span>
                          <span className="text-xs font-black text-text-primary">{payWallet.jazzcash_number}</span>
                        </div>
                      )}
                      {payWallet.sadapay_number && (
                        <div className="flex justify-between items-center bg-bg-card px-3 py-2 rounded-xl border border-border-inner">
                          <span className="text-xs font-semibold text-text-primary">🟢 SadaPay</span>
                          <span className="text-xs font-black text-text-primary">{payWallet.sadapay_number}</span>
                        </div>
                      )}
                      {payWallet.nayapay_number && (
                        <div className="flex justify-between items-center bg-bg-card px-3 py-2 rounded-xl border border-border-inner">
                          <span className="text-xs font-semibold text-text-primary">🍊 NayaPay</span>
                          <span className="text-xs font-black text-text-primary">{payWallet.nayapay_number}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Horizontal contacts selector (Inspired by mockup bottom) */}
            {friends.length > 0 && (
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-text-secondary ml-1">
                  Recent Contacts
                </label>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                  {friends.map(f => {
                    const isSelected = f.id === payFriend.id
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setPayFriend(f)
                          fetchFriendWallet(f.id)
                        }}
                        className="flex flex-col items-center gap-1.5 shrink-0"
                      >
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl transition border ${
                          isSelected
                            ? 'bg-accent/20 border-accent scale-105 shadow-md shadow-accent/20'
                            : 'bg-bg-card-inner border-border-primary hover:border-accent/40'
                        }`}>
                          {f.avatar_url || '👤'}
                        </div>
                         <span className={`text-xs font-bold truncate w-12 text-center ${
                          isSelected ? 'text-accent' : 'text-text-secondary'
                        }`}>
                          {f.full_name.split(' ')[0]}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Continue Settle Button */}
            <div className="pt-2">
               <button
                type="button"
                onClick={handleSettleDirect}
                disabled={settlingDirect}
                className="w-full bg-gradient-to-r from-accent to-[#7c6fd6] hover:opacity-95 text-white py-3.5 rounded-2xl font-bold text-sm transition shadow-md shadow-accent/15 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                {settlingDirect ? 'Settle Up...' : 'Continue Settlement'}
              </button>
            </div>

          </div>
        </div>
      )}

      <Navbar currentPage="friends" />
    </>
  )
}
