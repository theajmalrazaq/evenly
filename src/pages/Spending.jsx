import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../config/supabase'
import Navbar from '../components/Navbar'
import Toast from '../components/Toast'
import LoadingPulseOverlay from '../components/Loading'
import { Plus, PiggyBank, Calendar, Trash2, ShieldAlert, Check, TrendingDown, ArrowLeft, MoreVertical, ArrowDown, ArrowUp } from 'lucide-react'

const CATEGORIES = [
  { id: 'food', name: 'Food & Dining', emoji: '🍔', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  { id: 'transport', name: 'Transport', emoji: '🚗', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { id: 'shopping', name: 'Shopping', emoji: '🛍️', color: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
  { id: 'bills', name: 'Bills & Utilities', emoji: '🧾', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  { id: 'entertainment', name: 'Entertainment', emoji: '🎬', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { id: 'other', name: 'Other', emoji: '📦', color: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20' }
]

export default function Spending() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Expenses data
  const [expenses, setExpenses] = useState([])
  
  // Add Expense Form
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('food')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10))
  const [submitting, setSubmitting] = useState(false)

  // Interactive Chart States
  const [selectedBarIndex, setSelectedBarIndex] = useState(3) // Default to index 3 (Sep in mock, or 4th item)
  const [chartMode, setChartMode] = useState('expense') // expense or income (debt)

  // Owed to Me Balance for stats card
  const [owedToMe, setOwedToMe] = useState(0)

  // Fetch personal expenses and direct balances
  const fetchExpensesAndStats = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // 1. Fetch personal expenses
      const { data, error: eError } = await supabase
        .from('personal_expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (eError) throw eError
      setExpenses(data || [])

      // 2. Fetch Owed to Me to populate stats card
      // Get friends to query direct balances
      const { data: friendships, error: fError } = await supabase
        .from('friendships')
        .select(`
          id,
          user1:user_id_1(id),
          user2:user_id_2(id)
        `)
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)

      if (fError) throw fError

      const friendsList = friendships.map(f => f.user1.id === user.id ? f.user2 : f.user1)
      
      const { data: txs, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('status', 'pending')

      if (!txError && txs) {
        let directOwed = 0
        const friendBalances = {}
        friendsList.forEach(f => { friendBalances[f.id] = 0 })

        txs.forEach(t => {
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
          if (bal > 0) directOwed += bal
        })
        setOwedToMe(directOwed)
      }

    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to load spending stats')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpensesAndStats()
  }, [])

  // Handle Add Expense Submit
  const handleAddExpense = async (e) => {
    e.preventDefault()
    if (!amount || !category || !description) {
      setError('Please fill in all fields')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const { error: insError } = await supabase
        .from('personal_expenses')
        .insert({
          user_id: user.id,
          amount: Number(amount),
          category: category,
          description: description.trim(),
          date: date
        })

      if (insError) throw insError

      setSuccess('Expense logged successfully!')
      setIsAddOpen(false)
      setAmount('')
      setDescription('')
      setCategory('food')
      
      await fetchExpensesAndStats()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to save expense')
    } finally {
      setSubmitting(false)
    }
  }

  // Delete Expense
  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Delete this expense?')) return

    try {
      setLoading(true)
      const { error: dError } = await supabase
        .from('personal_expenses')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (dError) throw dError

      setSuccess('Expense deleted!')
      await fetchExpensesAndStats()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to delete expense')
    } finally {
      setLoading(false)
    }
  }

  // --- CHART CALCULATIONS ---
  const getChartData = () => {
    const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']
    
    // We map static list of months from June to Nov matching mockup
    // Let's dynamically map standard mockup values if there are no expenses,
    // otherwise compute actual historical amounts.
    const mockValues = {
      expense: [12000, 18000, 15000, 20483, 11000, 16000],
      income: [16000, 22000, 19000, 25000, 14000, 21000]
    }

    const currentYear = new Date().getFullYear()
    
    const data = months.map((m, idx) => {
      // Find month index: Jun is 5, Jul is 6, Aug is 7, Sep is 8, Oct is 9, Nov is 10
      const mIdx = [5, 6, 7, 8, 9, 10][idx]
      
      const realSum = expenses
        .filter(e => {
          const eDate = new Date(e.date)
          return eDate.getMonth() === mIdx && eDate.getFullYear() === currentYear
        })
        .reduce((sum, e) => sum + Number(e.amount), 0)

      return {
        label: m,
        amount: realSum > 0 ? realSum : mockValues[chartMode][idx],
        isMock: realSum === 0
      }
    })

    return data
  }

  const chartData = getChartData()
  const activeData = chartData[selectedBarIndex] || chartData[chartData.length - 1]

  // Total monthly spending
  const currentMonthIdx = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  const totalMonthlySpent = expenses
    .filter(e => {
      const eDate = new Date(e.date)
      return eDate.getMonth() === currentMonthIdx && eDate.getFullYear() === currentYear
    })
    .reduce((sum, e) => sum + Number(e.amount), 0)

  // Budget calculations
  const budgetLimit = profile?.monthly_budget || 0
  const budgetExceeded = budgetLimit > 0 && totalMonthlySpent > budgetLimit
  const budgetWarning = budgetLimit > 0 && totalMonthlySpent > (budgetLimit * 0.85) && !budgetExceeded
  const percentSpent = budgetLimit > 0 ? Math.min(Math.round((totalMonthlySpent / budgetLimit) * 100), 100) : 0

  // SVG dimensions
  const svgWidth = 320
  const svgHeight = 160
  const barWidth = 22
  const cornerRadius = 11 // half of barWidth for perfect pills
  const colGap = (svgWidth - barWidth * 6) / 7 // space between columns

  return (
    <>
      <Toast show={!!error} message={error} type="error" onClose={() => setError(null)} duration={3500} />
      <Toast show={!!success} message={success} type="success" onClose={() => setSuccess(null)} duration={3500} />

      {loading && <LoadingPulseOverlay />}

      <div className="min-h-screen bg-bg-app text-text-primary px-4 pt-6 pb-28 font-figtree transition-colors duration-300">
        <div className="max-w-md mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/home')}
              className="w-10 h-10 rounded-full bg-bg-card border border-border-primary text-text-secondary flex items-center justify-center hover:scale-105 active:scale-95 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-lg font-extrabold text-text-primary text-center">Statistics</h1>
            <button
              onClick={() => setIsAddOpen(true)}
              className="w-10 h-10 rounded-full bg-accent/15 border border-accent/25 text-accent flex items-center justify-center hover:scale-105 active:scale-95 transition cursor-pointer"
              title="Log Expense"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Selector Boxes (Inspired by mockup) */}
          <div className="flex justify-between items-center gap-3">
            <div className="relative">
              <select
                value={chartMode}
                onChange={(e) => setChartMode(e.target.value)}
                className="appearance-none bg-bg-card border border-border-primary text-text-primary pl-4 pr-10 py-2.5 rounded-full text-xs font-bold outline-none cursor-pointer hover:border-accent/40 transition shadow-sm"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary w-3 h-3 flex items-center justify-center font-bold">▾</div>
            </div>

            <div className="relative">
              <select
                className="appearance-none bg-bg-card border border-border-primary text-text-primary pl-4 pr-10 py-2.5 rounded-full text-xs font-bold outline-none cursor-pointer hover:border-accent/40 transition shadow-sm"
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary w-3 h-3 flex items-center justify-center font-bold">▾</div>
            </div>
          </div>

          {/* Interactive Graph Box */}
          <div className="bg-bg-card border border-border-primary rounded-[2.5rem] p-5 shadow-sm space-y-6 flex flex-col items-center">
            
            {/* Total Display */}
            <div className="text-center w-full">
              <h2 className="text-3xl font-black grad tracking-tight">
                Rs. {activeData.amount.toLocaleString()}
              </h2>
              <p className="text-xs text-text-secondary font-semibold mt-1">
                {chartMode === 'expense' ? 'Total Expense' : 'Total Income'} ({activeData.label})
              </p>
            </div>

            {/* Custom SVG Bar Chart */}
            <div className="w-full flex justify-center py-2">
              <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="select-none">
                {chartData.map((item, idx) => {
                  const maxVal = Math.max(...chartData.map(d => d.amount)) || 10000
                  const percent = item.amount / maxVal
                  const barHeight = Math.max(percent * (svgHeight - 40), 15) // minimum height
                  
                  const x = colGap + idx * (barWidth + colGap)
                  const y = svgHeight - 30 - barHeight
                  const isSelected = idx === selectedBarIndex

                  return (
                    <g key={idx}>
                      {/* Background highlight bar for clicks */}
                      <rect
                        x={x - colGap/3}
                        y={0}
                        width={barWidth + (colGap * 2)/3}
                        height={svgHeight - 20}
                        fill="transparent"
                        className="cursor-pointer"
                        onClick={() => setSelectedBarIndex(idx)}
                      />
                      
                      {/* Bar rectangle (Pill shape) */}
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        rx={cornerRadius}
                        fill={isSelected ? "var(--color-accent)" : "rgba(160, 160, 180, 0.15)"}
                        className="cursor-pointer transition-all duration-300 hover:opacity-85"
                        onClick={() => setSelectedBarIndex(idx)}
                      />

                      {/* Bar label */}
                      <text
                        x={x + barWidth / 2}
                        y={svgHeight - 10}
                        textAnchor="middle"
                        className={`text-xs font-bold cursor-pointer transition-all duration-200 ${
                          isSelected ? "fill-accent font-black scale-105" : "fill-text-secondary font-medium"
                        }`}
                        onClick={() => setSelectedBarIndex(idx)}
                      >
                        {item.label}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>

          {/* Outlined Stats Cards (Income vs Expense) */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Income Outlined Card */}
            <div className="bg-bg-card border border-accent/30 rounded-3xl p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400">
                  <ArrowDown className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-text-secondary">Income</span>
              </div>
              <div className="mt-4">
                <p className="text-xs text-text-secondary">Owed to Me</p>
                <h3 className="text-lg font-black text-text-primary leading-tight">Rs. {owedToMe.toLocaleString()}</h3>
              </div>
            </div>

            {/* Expense Outlined Card */}
            <div className="bg-bg-card border border-red-500/30 rounded-3xl p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
                  <ArrowUp className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-text-secondary">Expense</span>
              </div>
              <div className="mt-4">
                <p className="text-xs text-text-secondary">This Month</p>
                <h3 className="text-lg font-black text-text-primary leading-tight">Rs. {totalMonthlySpent.toLocaleString()}</h3>
              </div>
            </div>

          </div>

          {/* Budget progress bar overlay if config active */}
          {budgetLimit > 0 && (
            <div className="bg-bg-card border border-border-primary rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex justify-between text-xs text-text-secondary font-semibold">
                <span>Budget Progress</span>
                <span>{percentSpent}%</span>
              </div>
              <div className="w-full h-2 bg-bg-card-inner border border-border-primary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    budgetExceeded ? 'bg-red-500' : budgetWarning ? 'bg-yellow-500' : 'bg-accent'
                  }`}
                  style={{ width: `${percentSpent}%` }}
                ></div>
              </div>
              {budgetExceeded && (
                <div className="flex items-center gap-2 p-2 bg-red-500/10 text-red-405 rounded-xl text-xs font-semibold">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Exceeded Rs. {budgetLimit} limit</span>
                </div>
              )}
            </div>
          )}

          {/* Recent logged expenses list ("Recent Transaction") */}
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-text-primary ml-1">Recent Transactions</h3>
            
            <div className="flex flex-col gap-3">
              {expenses.length === 0 ? (
                <div className="bg-bg-card border border-dashed border-border-primary rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                  <PiggyBank className="w-8 h-8 text-text-secondary/60 mb-2" />
                  <p className="text-xs font-medium text-text-secondary">No expenses logged yet</p>
                </div>
              ) : (
                expenses.slice(0, 4).map(exp => {
                  const catInfo = CATEGORIES.find(c => c.id === exp.category) || CATEGORIES[5]
                  return (
                    <div
                      key={exp.id}
                      className="flex items-center justify-between p-3.5 bg-bg-card border border-border-primary rounded-2xl hover:border-accent/30 transition-all duration-205"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-lg ${catInfo.color}`}>
                          {catInfo.emoji}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-text-primary leading-tight">{exp.description}</p>
                          <p className="text-xs text-text-secondary mt-0.5">{catInfo.name}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs font-extrabold text-text-primary">Rs. {exp.amount}</p>
                          <p className="text-xs text-text-secondary flex items-center gap-1 justify-end mt-0.5 font-semibold">
                            <Calendar className="w-2.5 h-2.5" />
                            {new Date(exp.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="p-1 text-text-secondary/60 hover:text-red-400 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ADD EXPENSE MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-bg-card border border-border-primary rounded-[2rem] p-6 shadow-2xl">
            <h2 className="text-xl font-black text-text-primary grad mb-1">Log Expense</h2>
            <p className="text-xs text-text-secondary mb-5">Record a personal expense to track your spending habits.</p>

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2 ml-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Grocery split, Netflix sub, Fuel..."
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
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="800"
                    min="1"
                    className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary px-4 py-3 rounded-xl text-sm outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-2 ml-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary px-3 py-3 rounded-xl text-sm outline-none cursor-pointer"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id} className="bg-bg-input text-text-primary">
                        {cat.emoji} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2 ml-1">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary px-4 py-3 rounded-xl text-sm outline-none"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="flex-1 bg-bg-card-inner border border-border-primary text-text-secondary py-3 rounded-xl text-xs font-bold hover:text-text-primary transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-gradient-to-r from-accent to-[#7c6fd6] text-white py-3 rounded-xl text-xs font-bold hover:opacity-95 active:scale-[0.98] transition cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Bottom Nav */}
      <Navbar currentPage="spending" />
    </>
  )
}
