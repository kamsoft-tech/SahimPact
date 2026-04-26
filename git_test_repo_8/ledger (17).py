import React, { useState } from 'react'

const TransactionHistory = ({ 
    transactions, 
    onUpdateTransaction, 
    onDeleteTransaction, 
    onDeleteAllTransactions, 
    currencySymbol,
    user 
}) => {
    const isAdmin = user && String(user.role).toLowerCase() === 'admin';
    const [editingId, setEditingId] = useState(null)
    const [editForm, setEditForm] = useState({})

    const formatCurrency = (val) => `${currencySymbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const handleEditClick = (tx) => {
        setEditingId(tx.id)
        setEditForm(tx)
    }

    const handleSave = () => {
        const numVal = parseFloat(editForm.amount)
        if (!isNaN(numVal) && numVal > 0) {
            onUpdateTransaction({ ...editForm, amount: numVal })
            setEditingId(null)
        }
    }

    if (transactions.length === 0) {
        return (
            <section className="animate-fade-in delay-300 glass-card">
                <h2 className="mb-4">Ledger History</h2>
                <div className="text-center text-muted p-4 border" style={{ border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 'var(--radius-sm)' }}>
                    No transactions added yet. Use the "+ Add Transaction" button to begin.
                </div>
            </section>
        )
    }

    return (
        <section className="animate-fade-in delay-300 glass-card" style={{ overflowX: 'auto' }}>
            <div className="flex-between mb-4">
                <h2 className="m-0">Ledger History</h2>
                {isAdmin && (
                    <button 
                        className="btn btn-danger text-xs" 
                        style={{ padding: '0.2rem 0.6rem', height: 'auto', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                        onClick={onDeleteAllTransactions}
                    >
                        Clear All Transactions
                    </button>
                )}
            </div>
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.map((tx) => (
                        <tr key={tx.id}>
                            {editingId === tx.id ? (
                                <>
                                    <td>{tx.date}</td>
                                    <td>
                                        <select
                                            value={editForm.type}
                                            onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                                            style={{
                                                padding: '0.25rem', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px'
                                            }}
                                        >
                                            <option value="sales">Sales (Income)</option>
                                            <option value="expense">Purchase (Expense)</option>
                                            <option value="salary">Salary (Expense)</option>
                                        </select>
                                    </td>
                                    <td>
                                        <input
                                            type="text"
                                            value={editForm.description}
                                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                            style={{
                                                padding: '0.25rem', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px', width: '100%'
                                            }}
                                        />
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <span>{currencySymbol}</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={editForm.amount}
                                                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                                                style={{
                                                    padding: '0.25rem', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px', width: '80px'
                                                }}
                                            />
                                        </div>
                                    </td>
                                    <td>
                                        <button onClick={handleSave} className="text-secondary" style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', marginRight: '0.5rem' }}>Save</button>
                                        <button onClick={() => setEditingId(null)} className="text-muted" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                                    </td>
                                </>
                            ) : (
                                <>
                                    <td className="text-muted">{tx.date}</td>
                                    <td>
                                        <span className={`badge ${tx.type === 'sales' ? 'bg-secondary text-black' : 'bg-danger text-white'}`} style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                            {tx.type.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="flex items-center gap-2">
                                        {tx.description}
                                        {tx.is_closed && (
                                            <span title="This transaction is locked due to month-end close-out">
                                                <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                                </svg>
                                            </span>
                                        )}
                                    </td>
                                    <td className="fw-bold">{formatCurrency(tx.amount)}</td>
                                    <td className="flex items-center gap-2">
                                        {!tx.is_closed ? (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleEditClick(tx)} className="text-main" style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Edit</button>
                                                {isAdmin && (
                                                    <button 
                                                        onClick={() => onDeleteTransaction(tx.id)} 
                                                        className="text-danger" 
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                        title="Delete Transaction"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted italic">Locked</span>
                                        )}
                                    </td>
                                </>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    )
}

export default TransactionHistory
