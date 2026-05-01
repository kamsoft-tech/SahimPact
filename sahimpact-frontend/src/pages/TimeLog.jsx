import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

const TimeLog = () => {
    const [entries, setEntries] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(null); // ID of entry being edited
    const [timeStats, setTimeStats] = useState({ my_total_hours: 0, company_total_hours: 0 });
    const { showNotification } = useNotification();
    const { user, role } = useAuth();
    const currentUserId = user?.id || parseInt(sessionStorage.getItem('user_id'));
    const isAdmin = role === 'COMPANY_ADMIN' || role === 'SUPER_ADMIN';

    // Filters & View State
    const [viewMode, setViewMode] = useState('my'); // 'my' or 'company'
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // Form State
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        fetchEntries();
        fetchStats();
    }, [viewMode, selectedMonth, selectedYear]);

    const fetchStats = async () => {
        try {
            const res = await axios.get('/api/time/stats');
            setTimeStats(res.data || { my_total_hours: 0, company_total_hours: 0 });
        } catch (error) {
            console.error("Failed to fetch time stats", error);
            setTimeStats({ my_total_hours: 0, company_total_hours: 0 });
        }
    };

    const fetchEntries = async () => {
        setIsLoading(true);
        try {
            // If viewMode is 'my', we could use the dedicated endpoint or just filter 'all'
            // To support historical logs for everyone, we use /api/time/all with filters
            const endpoint = viewMode === 'my' ? '/api/time' : '/api/time/all';
            const params = {
                month: selectedMonth,
                year: selectedYear
            };
            const res = await axios.get(endpoint, { params });
            setEntries(res.data);
        } catch (error) {
            console.error("Failed to fetch time entries", error);
            showNotification("Failed to load time entries", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (!description.trim()) {
                showNotification("Description is mandatory", "error");
                return;
            }

            const start = new Date(startTime);
            const end = new Date(endTime);
            
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                showNotification("Please select valid start and end times", "error");
                return;
            }

            if (end <= start) {
                showNotification("End time must be after start time", "error");
                return;
            }

            const hours = (end - start) / (1000 * 60 * 60);

            if (hours > 15) {
                showNotification("Cannot log more than 15 hours in one go", "error");
                return;
            }

            const payload = {
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                description: description.trim()
            };

            if (isEditing) {
                await axios.put(`/api/time/${isEditing}`, payload);
                showNotification("Time entry updated!", "success");
            } else {
                await axios.post('/api/time', payload);
                showNotification("Time entry saved!", "success");
            }

            closeModal();
            fetchEntries();
        } catch (error) {
            showNotification(error.response?.data?.detail || "Failed to save time entry", "error");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this time entry?")) return;
        try {
            await axios.delete(`/api/time/${id}`);
            showNotification("Entry deleted", "success");
            fetchEntries();
        } catch (error) {
            showNotification("Failed to delete entry", "error");
        }
    };

    const openEditModal = (entry) => {
        setIsEditing(entry.id);
        // Convert to local datetime string format YYYY-MM-DDTHH:mm
        const start = new Date(entry.start_time);
        const end = new Date(entry.end_time);
        
        const toLocalISO = (date) => {
            const tzOffset = date.getTimezoneOffset() * 60000;
            return new Date(date - tzOffset).toISOString().slice(0, 16);
        };

        setStartTime(toLocalISO(start));
        setEndTime(toLocalISO(end));
        setDescription(entry.description || '');
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setIsEditing(null);
        setStartTime('');
        setEndTime('');
        setDescription('');
    };

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];

    return (
        <div className="flex flex-col gap-6 md:gap-8 animate-fade-in p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-outline-variant pb-6 gap-6">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">Time Ledger</h1>
                    <p className="text-on-surface-variant mt-2 max-w-xl">
                        Track and audit labour contributions. Logs are locked once month-end distribution is processed.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-surface-container rounded-lg p-1 border border-outline-variant/30">
                        <button 
                            onClick={() => setViewMode('my')}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'my' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                        >
                            My Logs
                        </button>
                        <button 
                            onClick={() => setViewMode('company')}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'company' ? 'bg-secondary text-on-secondary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                        >
                            Partners
                        </button>
                    </div>
                    <button onClick={() => setShowModal(true)} className="btn-primary shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined text-sm">add</span> Log Hours
                    </button>
                </div>
            </div>

            {/* Quick Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card bg-primary/5 border-primary/20 flex flex-col gap-1 p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-6xl">person</span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">My Hours (Current Period)</span>
                    <span className="text-4xl font-black text-primary">{(timeStats?.my_total_hours || 0).toFixed(1)} <small className="text-sm font-bold opacity-60">HRS</small></span>
                    <p className="text-[10px] text-on-surface-variant mt-2 font-bold uppercase tracking-widest">Calculated from unclosed logs</p>
                </div>
                <div className="card bg-secondary/5 border-secondary/20 flex flex-col gap-1 p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-6xl">groups</span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary/70">Total Team Hours</span>
                    <span className="text-4xl font-black text-secondary">{(timeStats?.company_total_hours || 0).toFixed(1)} <small className="text-sm font-bold opacity-60">HRS</small></span>
                    <p className="text-[10px] text-on-surface-variant mt-2 font-bold uppercase tracking-widest">Aggregate across all partners</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-on-surface-variant">calendar_month</span>
                    <select 
                        value={selectedMonth} 
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="bg-transparent border-none text-sm font-bold focus:ring-0 cursor-pointer input-field !py-1 !px-2"
                    >
                        {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                </div>
                <div className="h-4 w-[1px] bg-outline-variant/30 hidden sm:block"></div>
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-on-surface-variant">schedule</span>
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="bg-transparent border-none text-sm font-bold focus:ring-0 cursor-pointer input-field !py-1 !px-2"
                    >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div className="ml-auto text-xs text-on-surface-variant font-medium">
                    Showing {entries.length} entries for {months[selectedMonth-1]} {selectedYear}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <div className="card overflow-hidden p-0 shadow-sm border-outline-variant/20">
                    <div className="overflow-x-auto hidden sm:block">
                        <table className="w-full text-left min-w-[800px]">
                            <thead className="bg-surface-container-highest border-b border-outline-variant">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Partner</th>
                                    <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Start Date & Time</th>
                                    <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Hours</th>
                                    <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Description</th>
                                    <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/30">
                                {entries.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-surface-container-high transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">
                                                    {entry.partner_name?.substring(0, 2).toUpperCase()}
                                                </div>
                                                <span className="text-sm font-bold">{entry.partner_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium">
                                            <div className="flex flex-col">
                                                <span className="font-bold">{new Date(entry.start_time).toLocaleDateString()}</span>
                                                <span className="text-[10px] text-on-surface-variant font-black uppercase tracking-tighter">
                                                    {new Date(entry.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-black text-primary text-right">
                                            {(entry.hours || 0).toFixed(2)} hrs
                                        </td>
                                        <td className="px-6 py-4 text-sm text-on-surface-variant">
                                            {entry.description || 'No description'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${entry.is_closed ? 'bg-secondary' : 'bg-primary animate-pulse'}`}></span>
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${entry.is_closed ? 'text-secondary' : 'text-primary'}`}>
                                                    {entry.is_closed ? 'Locked' : 'Open'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {!entry.is_closed && (isAdmin || entry.user_id === currentUserId) && (
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => openEditModal(entry)} 
                                                        className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                                                        title="Edit Entry"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">edit</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(entry.id)} 
                                                        className="p-1.5 rounded-lg hover:bg-error/10 text-error transition-colors"
                                                        title="Delete Entry"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                    </button>
                                                </div>
                                            )}
                                            {entry.is_closed && (
                                                <span className="material-symbols-outlined text-on-surface-variant/30 text-lg" title="Locked entries cannot be modified">lock</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {entries.length === 0 && !isLoading && (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center text-on-surface-variant">
                                            <div className="flex flex-col items-center gap-2">
                                                <span className="material-symbols-outlined text-4xl opacity-20">history</span>
                                                <p>No time entries found for this period.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {isLoading && (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-8 text-center">
                                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile View Cards */}
                    <div className="flex flex-col divide-y divide-outline-variant/20 sm:hidden">
                        {entries.map((entry) => (
                            <div key={entry.id} className="p-5 flex flex-col gap-4 hover:bg-surface-container-low transition-colors">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-black text-primary">
                                            {entry.partner_name?.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black">{entry.partner_name}</span>
                                            <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                                                {new Date(entry.start_time).toLocaleDateString()} @ {new Date(entry.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-lg font-black text-primary">{(entry.hours || 0).toFixed(2)}</span>
                                        <span className="text-[10px] font-bold text-primary/60 uppercase">Hours</span>
                                    </div>
                                </div>
                                
                                <p className="text-sm text-on-surface-variant bg-surface-container/50 p-3 rounded-xl border border-outline-variant/10 italic">
                                    {entry.description || 'No description'}
                                </p>

                                <div className="flex items-center justify-between mt-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${entry.is_closed ? 'bg-secondary' : 'bg-primary animate-pulse'}`}></span>
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${entry.is_closed ? 'text-secondary' : 'text-primary'}`}>
                                            {entry.is_closed ? 'Locked' : 'Open'}
                                        </span>
                                    </div>
                                    
                                    {!entry.is_closed && (isAdmin || entry.user_id === currentUserId) && (
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => openEditModal(entry)} 
                                                className="p-2 rounded-xl bg-primary/10 text-primary"
                                            >
                                                <span className="material-symbols-outlined text-lg">edit</span>
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(entry.id)} 
                                                className="p-2 rounded-xl bg-error/10 text-error"
                                            >
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </div>
                                    )}
                                    {entry.is_closed && (
                                        <span className="material-symbols-outlined text-on-surface-variant/30 text-lg">lock</span>
                                    )}
                                </div>
                            </div>
                        ))}
                        {entries.length === 0 && !isLoading && (
                            <div className="p-12 text-center text-on-surface-variant">
                                <span className="material-symbols-outlined text-4xl opacity-20">history</span>
                                <p className="mt-2 text-sm font-bold uppercase tracking-widest">No entries found</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Log Hours Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                    <div className="card w-full max-w-md animate-scale-in shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">{isEditing ? 'Edit Time Entry' : 'Log Working Hours'}</h3>
                            <button onClick={closeModal} className="text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-container-high transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Start Time</label>
                                    <input 
                                        type="datetime-local" 
                                        className="input-field w-full" 
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        max={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                                        required 
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">End Time</label>
                                    <input 
                                        type="datetime-local" 
                                        className="input-field w-full" 
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        max={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                                        required 
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Activity Description</label>
                                <textarea 
                                    className="input-field w-full min-h-[120px] py-3 resize-none" 
                                    placeholder="What did you work on today?"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    required
                                ></textarea>
                            </div>
                            <div className="flex gap-3 mt-2">
                                <button type="button" onClick={closeModal} className="btn-ghost flex-1 py-3">Cancel</button>
                                <button type="submit" className="btn-primary flex-1 py-3 shadow-lg shadow-primary/30">
                                    {isEditing ? 'Update Entry' : 'Save Entry'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimeLog;
