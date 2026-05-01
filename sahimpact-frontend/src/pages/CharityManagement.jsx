import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNotification } from '../context/NotificationContext';

const CharityManagement = () => {
    const { showNotification } = useNotification();
    const [balance, setBalance] = useState(0);
    const [payouts, setPayouts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Form state
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [balRes, payRes] = await Promise.all([
                axios.get(`/api/distribution/charity-balance?t=${Date.now()}`),
                axios.get(`/api/distribution/charity-payouts?t=${Date.now()}`)
            ]);
            setBalance(balRes.data.balance || 0);
            setPayouts(payRes.data || []);
        } catch (error) {
            showNotification('Failed to fetch charity data', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!amount || !description) {
            showNotification('Please fill in all fields', 'warning');
            return;
        }

        if (parseFloat(amount) > balance) {
            showNotification('Insufficient charity funds', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            await axios.post('/api/distribution/charity-payout', {
                amount: parseFloat(amount),
                description,
                date
            });
            showNotification('Charity payout recorded successfully', 'success');
            setAmount('');
            setDescription('');
            fetchData();
        } catch (error) {
            showNotification('Failed to record payout', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading && payouts.length === 0) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 animate-slide-in p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-black tracking-tight text-on-surface">Charity Management</h1>
                <p className="text-on-surface-variant mt-1">Manage outgoing payments from the Global Charity Fund</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Balance & Record Payout */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <div className="card bg-primary text-on-primary shadow-xl shadow-primary/20">
                        <span className="text-sm font-bold uppercase tracking-widest opacity-80">Available Balance</span>
                        <h2 className="text-5xl font-black mt-2">£{balance.toLocaleString()}</h2>
                        <p className="text-xs mt-4 opacity-70 italic">Held in the Global Charity Reserve</p>
                    </div>

                    <div className="card">
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined">volunteer_activism</span>
                            Record New Payout
                        </h3>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-on-surface-variant uppercase ml-1">Recipient / Cause</label>
                                <input 
                                    type="text" 
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="e.g. UNICEF Donation"
                                    className="input-field"
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-on-surface-variant uppercase ml-1">Amount (£)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="input-field"
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-on-surface-variant uppercase ml-1">Date</label>
                                <input 
                                    type="date" 
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="input-field"
                                    required
                                />
                            </div>
                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="btn-primary mt-2 py-4"
                            >
                                {isSubmitting ? 'Recording...' : 'Finalize Payout'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* History */}
                <div className="lg:col-span-2">
                    <div className="card h-full">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined">history</span>
                                Payout History
                            </h3>
                            <button onClick={fetchData} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
                                <span className="material-symbols-outlined text-sm">refresh</span>
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-outline-variant">
                                        <th className="pb-4 font-bold text-sm uppercase text-on-surface-variant tracking-wider">Date</th>
                                        <th className="pb-4 font-bold text-sm uppercase text-on-surface-variant tracking-wider">Recipient / Reason</th>
                                        <th className="pb-4 font-bold text-sm uppercase text-on-surface-variant tracking-wider text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-outline-variant">
                                    {payouts.length === 0 ? (
                                        <tr>
                                            <td colSpan="3" className="py-12 text-center text-on-surface-variant italic">
                                                No historical payouts recorded yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        payouts.map((payout) => (
                                            <tr key={payout.id} className="hover:bg-surface-container-lowest transition-colors group">
                                                <td className="py-4 text-sm font-medium">{payout.date}</td>
                                                <td className="py-4 text-sm font-bold text-on-surface">{payout.description}</td>
                                                <td className="py-4 text-sm font-black text-primary text-right">£{payout.amount.toLocaleString()}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CharityManagement;
