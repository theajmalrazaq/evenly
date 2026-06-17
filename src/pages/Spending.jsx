import React, { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../config/supabase'
import Navbar from '../components/Navbar'
import Toast from '../components/Toast'
import LoadingPulseOverlay from '../components/Loading'
import { Plus, PiggyBank, Calendar, Trash2, ShieldAlert, Check, TrendingDown, LayoutGrid } from 'lucide-react'

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

  // Fetch personal expenses
  const fetchExpenses = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error: eError } = await supabase
        .from('personal_expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (eError) throw eError
      setExpenses(data || [])
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpenses()
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
      // Reset
      setAmount('')
      setDescription('')
      setCategory('food')
      
      // Refresh list
      await fetchExpenses()
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
      await fetchExpenses()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to delete expense')
    } finally {
      setLoading(false)
    }
  }

  // --- STATISTICS CALCULATIONS ---
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()

  // Filter current month expenses
  const monthlyExpenses = expenses.filter(e => {
    const eDate = new Date(e.date)
    return eDate.getMonth() === currentMonth && eDate.getFullYear() === currentYear
  })

  // Total monthly spending
  const totalMonthlySpent = monthlyExpenses.reduce((sum, e) => sum + Number(e.amount), 0)

  // Budget calculations
  const budgetLimit = profile?.monthly_budget || 0
  const budgetExceeded = budgetLimit > 0 && totalMonthlySpent > budgetLimit
  const budgetWarning = budgetLimit > 0 && totalMonthlySpent > (budgetLimit * 0.85) && !budgetExceeded
  const percentSpent = budgetLimit > 0 ? Math.min(Math.round((totalMonthlySpent / budgetLimit) * 100), 100) : 0

  // Category breakdown
  const categoryBreakdown = CATEGORIES.map(cat => {
    const catSpent = monthlyExpenses
      .filter(e => e.category === cat.id)
      .reduce((sum, e) => sum + Number(e.amount), 0)

    const percentage = totalMonthlySpent > 0 ? Math.round((catSpent / totalMonthlySpent) * 100) : 0

    return {
      ...cat,
      spent: catSpent,
      percentage
    }
  }).sort((a, b) => b.spent - a.spent)

  return (
    <>
      <Toast show={!!error} message={error} type="error" onClose={() => setError(null)} duration={3500} />
      <Toast show={!!success} message={success} type="success" onClose={() => setSuccess(null)} duration={3500} />

      {loading && <LoadingPulseOverlay />}

      <div className="min-h-screen bg-black text-white px-4 py-8 pb-28 font-figtree">
        <div className="max-w-7xl mx-auto">
          {/* Title */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-black text-white grad">Spending Tracker</h1>
              <p className="text-xs text-neutral-400">Log and monitor your personal monthly spending</p>
            </div>
            <button
              onClick={() => setIsAddOpen(true)}
              className="bg-accent/15 border border-accent/25 text-accent p-2.5 rounded-full hover:bg-accent/20 transition cursor-pointer"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left Column: Monthly Summary Card & Category Breakdown */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Monthly Summary Card */}
              <div className="bg-neutral-900/30 border border-neutral-800/80 rounded-[2rem] p-6 shadow-2xl backdrop-blur-xl">
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Spent This Month</p>
                <h1 className="text-3xl font-black text-white grad mb-4">Rs. {totalMonthlySpent.toLocaleString()}</h1>

                {/* Budget progress */}
                {budgetLimit > 0 ? (
                  <div>
                    <div className="flex justify-between text-xs text-neutral-400 font-bold uppercase tracking-wider mb-2">
                      <span>Budget Progress</span>
                      <span>{percentSpent}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-neutral-900 border border-neutral-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          budgetExceeded ? 'bg-red-500' : budgetWarning ? 'bg-yellow-500' : 'bg-accent'
                        }`}
                        style={{ width: `${percentSpent}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-neutral-500 mt-2 font-semibold">
                      <span>Spent: Rs. {totalMonthlySpent}</span>
                      <span>Limit: Rs. {budgetLimit}</span>
                    </div>

                    {/* Warning flags */}
                    {budgetExceeded && (
                      <div className="mt-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-xs font-semibold">
                        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                        <span>Budget Exceeded! Please review your spending.</span>
                      </div>
                    )}
                    {budgetWarning && (
                      <div className="mt-4 flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-2xl text-xs font-semibold">
                        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                        <span>Approaching Limit! You've used 85%+ of your budget.</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 bg-neutral-850/50 border border-neutral-800 text-neutral-400 rounded-2xl text-xs font-medium text-center">
                    💡 Set a monthly budget on your Profile page to monitor limits!
                  </div>
                )}
              </div>

              {/* Category breakdown progress bars */}
              {totalMonthlySpent > 0 && (
                <div className="bg-neutral-900/15 border border-neutral-800/60 rounded-3xl p-5">
                  <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4 ml-1">Category Breakdown</h3>
                  <div className="space-y-4">
                    {categoryBreakdown.map(cat => {
                      if (cat.spent === 0) return null
                      return (
                        <div key={cat.id} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-bold text-white">
                            <div className="flex items-center gap-2">
                              <span>{cat.emoji}</span>
                              <span>{cat.name}</span>
                            </div>
                            <span className="text-neutral-400">
                              Rs. {cat.spent} ({cat.percentage}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden">
                            <div className="h-full bg-accent rounded-full" style={{ width: `${cat.percentage}%` }}></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Recent Logged Expenses list */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-neutral-900/15 border border-neutral-800/60 rounded-3xl p-5">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4 ml-1">Recent Logged Expenses</h3>
                
                <div className="flex flex-col gap-3">
                  {expenses.length === 0 ? (
                    <div className="bg-neutral-900/20 border border-dashed border-neutral-800 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                      <PiggyBank className="w-8 h-8 text-neutral-600 mb-2" />
                      <p className="text-xs font-medium text-neutral-500">No expenses logged yet</p>
                      <button
                        onClick={() => setIsAddOpen(true)}
                        className="mt-3 text-xs font-bold text-accent hover:underline bg-transparent border-0 cursor-pointer"
                      >
                        Log your first expense
                      </button>
                    </div>
                  ) : (
                    expenses.map(exp => {
                      const catInfo = CATEGORIES.find(c => c.id === exp.category) || CATEGORIES[5]
                      return (
                        <div
                          key={exp.id}
                          className="flex items-center justify-between p-4 bg-neutral-900/40 border border-neutral-800/80 rounded-2xl hover:border-neutral-700/60 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-lg ${catInfo.color}`}>
                              {catInfo.emoji}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white leading-tight">{exp.description}</p>
                              <p className="text-[10px] text-neutral-400 mt-0.5">{catInfo.name}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-xs font-extrabold text-white">Rs. {exp.amount}</p>
                              <p className="text-[9px] text-neutral-500 flex items-center gap-1 justify-end mt-0.5">
                                <Calendar className="w-2.5 h-2.5" />
                                {new Date(exp.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="p-1 text-neutral-600 hover:text-red-400 transition cursor-pointer"
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
        </div>
      </div>

      {/* ========================================================
         ADD EXPENSE MODAL
         ======================================================== */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-[2rem] p-6 shadow-2xl">
            <h2 className="text-xl font-black text-white grad mb-1">Log Expense</h2>
            <p className="text-xs text-neutral-400 mb-5">Record a personal expense to track your spending habits.</p>

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 ml-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Grocery split, Netflix sub, Fuel..."
                  className="w-full bg-black border border-neutral-850 focus:border-accent text-white px-4 py-3 rounded-xl text-sm outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 ml-1">
                    Amount (Rs.)
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="800"
                    min="1"
                    className="w-full bg-black border border-neutral-850 focus:border-accent text-white px-4 py-3 rounded-xl text-sm outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 ml-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-black border border-neutral-850 focus:border-accent text-white px-3 py-3 rounded-xl text-sm outline-none cursor-pointer"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.emoji} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 ml-1">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-black border border-neutral-850 focus:border-accent text-white px-4 py-3 rounded-xl text-sm outline-none"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="flex-1 bg-neutral-850 text-neutral-300 py-3 rounded-xl text-xs font-bold hover:bg-neutral-800 transition cursor-pointer"
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
