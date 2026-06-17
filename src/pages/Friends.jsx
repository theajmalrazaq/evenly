import React, { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../config/supabase'
import Navbar from '../components/Navbar'
import Toast from '../components/Toast'
import LoadingPulseOverlay from '../components/Loading'
import { Search, UserPlus, UserCheck, UserMinus, Clock, Users, Check, X, ShieldAlert } from 'lucide-react'

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

      // Find users matching search query (exclude yourself)
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
      // Update search result status locally if possible
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

      // 1. Update request status to accepted
      const { error: uError } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId)

      if (uError) throw uError

      // 2. Insert friendship record (ordered user_id_1 < user_id_2)
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

      // 1. Delete friendship
      const { error: fError } = await supabase
        .from('friendships')
        .delete()
        .or(`and(user_id_1.eq.${user.id},user_id_2.eq.${friendId}),and(user_id_1.eq.${friendId},user_id_2.eq.${user.id})`)

      if (fError) throw fError

      // 2. Also delete any related friend requests to allow re-sending requests later
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

  return (
    <>
      <Toast show={!!error} message={error} type="error" onClose={() => setError(null)} duration={3500} />
      <Toast show={!!success} message={success} type="success" onClose={() => setSuccess(null)} duration={3500} />

      {loading && <LoadingPulseOverlay />}

      <div className="min-h-screen bg-black text-white px-4 py-8 pb-28 font-figtree">
        <div className="max-w-7xl mx-auto">
          
          {/* Title */}
          <div className="mb-8">
            <h1 className="text-2xl font-black text-white grad">Friends</h1>
            <p className="text-xs text-neutral-400">Add friends to start tracking shared expenses</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left Column: Friends List */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-neutral-900/15 border border-neutral-800/60 rounded-3xl p-5">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-neutral-400" /> Active Friends ({friends.length})
                </h3>

                <div className="flex flex-col gap-3">
                  {friends.length === 0 ? (
                    <div className="bg-neutral-900/20 border border-dashed border-neutral-800 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                      <Users className="w-8 h-8 text-neutral-600 mb-2" />
                      <p className="text-xs font-medium text-neutral-500">No friends added yet</p>
                      <p className="text-[10px] text-neutral-600 mt-1 max-w-[200px] mx-auto">
                        Use the search panel on the right to find friends and send requests!
                      </p>
                    </div>
                  ) : (
                    friends.map(friend => (
                      <div
                        key={friend.id}
                        className="flex items-center justify-between p-4 bg-neutral-900/40 border border-neutral-800/80 rounded-2xl hover:border-neutral-700/60 transition"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{friend.avatar_url || '👤'}</span>
                          <div>
                            <p className="text-xs font-bold text-white">{friend.full_name}</p>
                            <p className="text-[10px] text-neutral-400">@{friend.username}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => removeFriend(friend.id, friend.full_name)}
                          className="p-2 bg-red-500/10 border border-red-500/10 text-red-400/80 rounded-xl hover:bg-red-500/20 hover:text-red-400 transition cursor-pointer"
                          title="Remove Friend"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Search & Friend Requests */}
            <div className="space-y-6">
              
              {/* Search Panel */}
              <div className="bg-neutral-900/15 border border-neutral-800/60 rounded-3xl p-5">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4">Find Friends</h3>
                
                <form onSubmit={handleSearch} className="relative mb-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Username or full name..."
                    className="w-full bg-neutral-900/50 border border-neutral-800 focus:border-accent text-white pl-10 pr-4 py-3 rounded-2xl text-xs outline-none transition-all duration-200"
                    required
                  />
                  <Search className="absolute left-3.5 top-3.5 text-neutral-500 w-3.5 h-3.5" />
                  <button
                    type="submit"
                    disabled={searching}
                    className="absolute right-2 top-2 bg-accent text-white px-2.5 py-1.5 rounded-xl text-[10px] font-bold hover:opacity-95 transition cursor-pointer"
                  >
                    {searching ? '...' : 'Search'}
                  </button>
                </form>

                {searchResults.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider mb-2 ml-1">Search Results</h4>
                    <div className="flex flex-col gap-2">
                      {searchResults.map(sUser => {
                        const isFriend = friends.some(f => f.id === sUser.id)
                        const isSentPending = outgoingRequests.some(r => r.receiver.id === sUser.id)
                        const isRecvPending = incomingRequests.some(r => r.sender.id === sUser.id)

                        return (
                          <div key={sUser.id} className="flex items-center justify-between py-2 border-b border-neutral-850 last:border-b-0">
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <span className="text-xl">{sUser.avatar_url || '👤'}</span>
                              <div className="overflow-hidden">
                                <p className="text-[11px] font-bold truncate text-white leading-tight">{sUser.full_name}</p>
                                <p className="text-[9px] text-neutral-400 truncate">@{sUser.username}</p>
                              </div>
                            </div>

                            <div className="flex-shrink-0">
                              {isFriend ? (
                                <span className="text-[9px] font-bold text-green-400 flex items-center gap-1">
                                  <UserCheck className="w-3 h-3" /> Friends
                                </span>
                              ) : isSentPending ? (
                                <span className="text-[9px] font-bold text-neutral-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Sent
                                </span>
                              ) : isRecvPending ? (
                                <span className="text-[9px] font-bold text-accent">Pending</span>
                              ) : (
                                <button
                                  onClick={() => sendFriendRequest(sUser.id, sUser.full_name)}
                                  className="bg-accent/10 border border-accent/20 text-accent px-2 py-1 rounded-xl text-[10px] font-bold hover:bg-accent/20 transition cursor-pointer flex items-center gap-0.5"
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

              {/* Incoming Friend Requests */}
              {incomingRequests.length > 0 && (
                <div className="bg-neutral-900/15 border border-neutral-800/60 rounded-3xl p-5">
                  <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-accent" /> Incoming Requests ({incomingRequests.length})
                  </h3>
                  <div className="flex flex-col gap-3">
                    {incomingRequests.map(req => (
                      <div
                        key={req.id}
                        className="flex items-center justify-between p-3.5 bg-accent/5 border border-accent/25 rounded-2xl animate-pulse"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <span className="text-2xl">{req.sender.avatar_url || '👤'}</span>
                          <div className="overflow-hidden">
                            <p className="text-xs font-bold truncate text-white leading-tight">{req.sender.full_name}</p>
                            <p className="text-[9px] text-accent truncate">@{req.sender.username}</p>
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
      </div>

      {/* Floating Bottom Nav */}
      <Navbar currentPage="friends" />
    </>
  )
}
