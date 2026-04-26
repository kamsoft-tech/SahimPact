import React from 'react'
import TransactionHistory from './TransactionHistory'

const Dashboard = ({ 
    pulseData, 
    onOverridePulse, 
    partnerNames, 
    capitalShares, 
    laborShares, 
    transactions, 
    charityPercentage, 
    partnershipMode,
    labourShareMode,
    currencySymbol,
    partnerShares, 
    onUpdateTransaction,
    reports,
    setReports,
    token,
    onRefreshTransactions,
    onCloseOut,
    timeEntries,
    onUpdateTimeEntry,
    onDeleteTimeEntry,
    onDeleteAllTimeEntries,
    onDeleteTransaction,
    onDeleteAllTransactions,
    user 
}) => {
    const [editingTimeEntry, setEditingTimeEntry] = React.useState(null);
    const [editStartTime, setEditStartTime] = React.useState('');
    const [editEndTime, setEditEndTime] = React.useState('');
    
    // Dual-Pool Math
    const validNetProfit = Math.max(0, pulseData.netProfit);
    
    // Determine pool sizes based on partnership mode
    let capitalPoolMultiplier = 0.5;
    let labourPoolMultiplier = 0.5;
    if (partnershipMode === 'capital') {
        capitalPoolMultiplier = 1.0;
        labourPoolMultiplier = 0;
    } else if (partnershipMode === 'labour') {
        capitalPoolMultiplier = 0;
        labourPoolMultiplier = 1.0;
    }

    const capitalPoolSize = validNetProfit * capitalPoolMultiplier;
    const labourPoolSize = validNetProfit * labourPoolMultiplier;

    const capitalCharityDeduction = capitalPoolSize * charityPercentage;
    const labourCharityDeduction = labourPoolSize * charityPercentage;

    const capitalDistributable = capitalPoolSize - capitalCharityDeduction;
    const labourDistributable = labourPoolSize - labourCharityDeduction;

    const isAdmin = user && String(user.role).toLowerCase() === 'admin';

    const formatCurrency = (val) => `${currencySymbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const handlePulseInput = (field, val) => {
        const numVal = parseFloat(val);
        onOverridePulse(field, isNaN(numVal) ? 0 : numVal);
    }
    
    const openEditTimeModal = (entry) => {
        setEditingTimeEntry(entry);
        setEditStartTime(entry.start_time ? new Date(entry.start_time).toISOString().slice(0, 16) : '');
        setEditEndTime(entry.end_time ? new Date(entry.end_time).toISOString().slice(0, 16) : '');
    };
    
    const handleSaveTimeEntry = async () => {
        if (!editStartTime || !editEndTime) return alert("Select both times.");
        const start = new Date(editStartTime);
        const end = new Date(editEndTime);
        if (end <= start) return alert("End time must be after start time.");
        
        try {
            await onUpdateTimeEntry(editingTimeEntry.id, {
                start_time: start.toISOString(),
                end_time: end.toISOString()
            });
            setEditingTimeEntry(null);
        } catch (err) {
            console.error(err);
            alert("Failed to update time entry.");
        }
    };

    // Calculate live partner earnings metrics
    const partnersData = partnerNames.map((name, i) => {
        const capPct = capitalShares[i] || 0;
        const labPct = laborShares[i] || 0;

        const earnedCap = capitalDistributable * (capPct / 100);
        const earnedLab = labourDistributable * (labPct / 100);

        const share = partnerShares[i];
        const volPct = share ? share.voluntary_charity_percentage : 0;
        const grossPayout = earnedCap + earnedLab;
        const volDeduction = grossPayout * volPct;
        const netPayout = grossPayout - volDeduction;

        return {
            name,
            capShare: typeof capPct === 'number' ? capPct.toFixed(1) : capPct,
            labShare: labPct,
            earnedCap,
            earnedLab,
            grossPayout,
            volPct: (volPct * 100).toFixed(1),
            volDeduction,
            total: netPayout
        };
    });

    const totalVoluntaryCharity = partnersData.reduce((sum, p) => sum + p.volDeduction, 0);

    const generatePDF = (report) => {
        if (!window.jspdf) {
            alert("PDF library not loaded. Please refresh the page.");
            return;
        }
        const doc = new window.jspdf.jsPDF();
        const data = report.report_data;

        // Title & Logo Area
        doc.setFontSize(22);
        doc.setTextColor(41, 128, 185);
        doc.text("IYI Partner Ledger", 14, 20);
        
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text(`Distribution Report: ${report.period_name}`, 14, 30);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date(report.created_at).toLocaleString()}`, 14, 38);
        doc.line(14, 42, 196, 42);

        // Financial Summary
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Financial Summary", 14, 52);

        const summaryRows = [
            ["Net Profit", formatCurrency(report.net_profit)],
            ["Global Charity Allocation (6%)", formatCurrency(report.global_charity)],
            ["Partner Voluntary Charity", formatCurrency(report.voluntary_charity)],
            ["Total Distributed Charity Pool", formatCurrency(report.global_charity + report.voluntary_charity)]
        ];

        doc.autoTable({
            startY: 55,
            head: [['Metric', `Amount (${currencySymbol})`]],
            body: summaryRows,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] },
            margin: { left: 14 }
        });

        // Partner Distributions
        doc.text("Partner Distribution Details", 14, doc.lastAutoTable.finalY + 15);

        const columns = ['Partner'];
        if (partnershipMode !== 'labour') columns.push('Capital');
        if (partnershipMode !== 'capital') columns.push('Labor');
        columns.push('Gross', 'Vol %', 'Deduction', 'Net Payout');

        const partnerRows = data.partner_payouts.map(p => {
             const row = [p.partner_name || `Partner ${p.partner_user_id}`];
             if (partnershipMode !== 'labour') row.push(formatCurrency(p.capital_payout));
             if (partnershipMode !== 'capital') row.push(formatCurrency(p.labor_payout));
             row.push(
                formatCurrency(p.gross_payout),
                `${(p.voluntary_charity_percentage * 100).toFixed(1)}%`,
                `-${formatCurrency(p.voluntary_charity_deduction)}`,
                formatCurrency(p.net_payout)
             );
             return row;
        });

        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 20,
            head: [columns],
            body: partnerRows,
            theme: 'striped',
            headStyles: { fillColor: [39, 174, 96] },
            margin: { left: 14 }
        });

        // Footer
        const finalY = doc.lastAutoTable.finalY + 30;
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text("This is an automatically generated system report.", 14, finalY);
        doc.text("IYI Management System", 14, finalY + 5);

        doc.save(`IYI_Report_${report.period_name.replace(' ', '_')}.pdf`);
    };

    return (
        <div className="flex-column" style={{ gap: '2.5rem' }}>

            {/* Header: The Pulse */}
            <header className="animate-fade-in glass-card">
                <div className="flex-between mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                             <h2 className="text-muted text-sm tracking-wider uppercase m-0">The Pulse (Real-Time)</h2>
                             {isAdmin && (
                                 <span className="badge badge-success" style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--secondary)', border: '1px solid var(--secondary)' }}>
                                     ADMIN MODE
                                 </span>
                             )}
                        </div>
                        <span className="text-xs text-muted">Base values are editable for simulations</span>
                    </div>
                    <button 
                        onClick={onCloseOut}
                        className="btn btn-danger flex items-center gap-2 shadow-lg shadow-red-900/20"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Generate Report
                    </button>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    <div>
                        <p className="text-muted mb-2">Total Gross Revenue</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span className="text-xl fw-bold text-main">{currencySymbol}</span>
                            <input
                                type="number"
                                value={pulseData.revenue}
                                onChange={(e) => handlePulseInput('revenue', e.target.value)}
                                style={{
                                    width: '100%', padding: '0.25rem', fontSize: '1.25rem', fontWeight: 'bold',
                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 'var(--radius-sm)', color: 'var(--main)'
                                }}
                            />
                        </div>
                    </div>
                    <div>
                        <p className="text-muted mb-2">MTD Expenses</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span className="text-xl fw-bold text-danger">{currencySymbol}</span>
                            <input
                                type="number"
                                value={pulseData.expenses}
                                onChange={(e) => handlePulseInput('expenses', e.target.value)}
                                style={{
                                    width: '100%', padding: '0.25rem', fontSize: '1.25rem', fontWeight: 'bold',
                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 'var(--radius-sm)', color: 'var(--danger)'
                                }}
                            />
                        </div>
                    </div>
                    <div>
                        <p className="text-muted mb-2">Estimated Net Profit</p>
                        <p className="text-xl fw-bold text-secondary">{formatCurrency(pulseData.netProfit)}</p>
                    </div>
                </div>
            </header>

            {/* Section 1: Dual-Pool Visualization */}
            <section className="animate-fade-in delay-100">
                <h2 className="mb-4">Profit Designation</h2>
                <div className="grid md:grid-cols-2">
                    {/* Capital Pool Ring */}
                    {(partnershipMode === 'both' || partnershipMode === 'capital') && (
                    <div className="glass-card flex-column" style={{ alignItems: 'center' }}>
                        <h3 className="mb-6">Capital Pool ({partnershipMode === 'both' ? '50%' : '100%'})</h3>
                        <div className="progress-ring mb-6" style={{ '--percentage': '94%', '--fill-color': 'var(--primary)', '--glow-color': 'var(--primary-glow)' }}>
                            <div className="progress-ring-content">
                                <p className="fw-bold text-lg">{formatCurrency(capitalDistributable)}</p>
                                <p className="text-muted" style={{ fontSize: '0.8rem' }}>Distributable</p>
                            </div>
                        </div>
                        <div className="w-full mt-4">
                            <div className="flex-between mb-2">
                                <span className="text-muted">Gross Amount</span>
                                <span>{formatCurrency(capitalPoolSize)}</span>
                            </div>
                            <div className="flex-between">
                                <span className="text-muted text-danger">Charity ({(charityPercentage * 100).toFixed(1)}%)</span>
                                <span className="text-danger">-{formatCurrency(capitalCharityDeduction)}</span>
                            </div>
                        </div>
                    </div>
                    )}

                    {/* Labor Pool Ring */}
                    {(partnershipMode === 'both' || partnershipMode === 'labour') && (
                    <div className="glass-card flex-column" style={{ alignItems: 'center' }}>
                        <h3 className="mb-6">Labor Pool ({partnershipMode === 'both' ? '50%' : '100%'})</h3>
                        <div className="progress-ring mb-6" style={{ '--percentage': '94%', '--fill-color': 'var(--secondary)', '--glow-color': 'rgba(16, 185, 129, 0.4)' }}>
                            <div className="progress-ring-content">
                                <p className="fw-bold text-lg">{formatCurrency(labourDistributable)}</p>
                                <p className="text-muted" style={{ fontSize: '0.8rem' }}>Distributable</p>
                            </div>
                        </div>
                        <div className="w-full mt-4">
                            <div className="flex-between mb-2">
                                <span className="text-muted">Gross Amount</span>
                                <span>{formatCurrency(labourPoolSize)}</span>
                            </div>
                            <div className="flex-between">
                                <span className="text-muted text-danger">Charity ({(charityPercentage * 100).toFixed(1)}%)</span>
                                <span className="text-danger">-{formatCurrency(labourCharityDeduction)}</span>
                            </div>
                        </div>
                    </div>
                    )}
                </div>
            </section>

            {/* Section 1.5: Admin Time Management (MOVED UP FOR VISIBILITY) */}
            {isAdmin && labourShareMode === 'time' && (
            <section className="animate-fade-in delay-150 glass-card" style={{ overflowX: 'auto', border: '1px solid var(--accent)' }}>
                <div className="flex-between mb-4">
                    <h2 className="m-0 text-accent">Admin Time Management</h2>
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-muted">Manage partner shifts & recalculate shares</span>
                        <button 
                            className="btn btn-danger text-xs" 
                            style={{ padding: '0.2rem 0.6rem', height: 'auto', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                            onClick={onDeleteAllTimeEntries}
                        >
                            Clear All Entries
                        </button>
                    </div>
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Partner</th>
                            <th>Start</th>
                            <th>End</th>
                            <th>Hours</th>
                            <th>Description</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {timeEntries?.map((entry) => (
                            <tr key={entry.id}>
                                <td className="fw-bold">{entry.partner_name || `User ${entry.user_id}`}</td>
                                <td className="text-xs">{entry.start_time ? new Date(entry.start_time).toLocaleString() : 'N/A'}</td>
                                <td className="text-xs">{entry.end_time ? new Date(entry.end_time).toLocaleString() : 'N/A'}</td>
                                <td className="text-secondary fw-bold">{entry.hours.toFixed(2)}</td>
                                <td className="text-muted text-xs">{entry.description || '-'}</td>
                                <td>
                                    <div className="flex gap-2">
                                        <button 
                                            className="btn btn-sm" 
                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                            onClick={() => openEditTimeModal(entry)}
                                        >
                                            Edit
                                        </button>
                                        <button 
                                            className="btn btn-sm" 
                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                                            onClick={() => onDeleteTimeEntry(entry.id)}
                                            title="Delete Entry"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {(!timeEntries || timeEntries.length === 0) && (
                            <tr>
                                <td colSpan="6" className="text-center text-muted py-4">No active time entries in this period.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </section>
            )}

            {/* Section 2: 3-Partner Payout Table */}
            <section className="animate-fade-in delay-200 glass-card" style={{ overflowX: 'auto' }}>
                <h2 className="mb-4">Partner Payout Accrual</h2>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Partner</th>
                            {partnershipMode !== 'labour' && <th>Cap Share %</th>}
                            {partnershipMode !== 'labour' && <th>Cap Amount</th>}
                            {partnershipMode !== 'capital' && <th>Lab Share %</th>}
                            {partnershipMode !== 'capital' && <th>Lab Amount</th>}
                            <th>Gross Payout</th>
                            <th>Voluntary Charity</th>
                            <th>Net Accrued</th>
                        </tr>
                    </thead>
                    <tbody>
                        {partnersData.map((p, i) => (
                            <tr key={i}>
                                <td className="fw-bold">{p.name}</td>
                                {partnershipMode !== 'labour' && <td className="text-primary">{p.capShare}%</td>}
                                {partnershipMode !== 'labour' && <td className="text-primary fw-bold" style={{ whiteSpace: 'nowrap' }}>{formatCurrency(p.earnedCap)}</td>}
                                {partnershipMode !== 'capital' && <td className="text-secondary">{p.labShare}%</td>}
                                {partnershipMode !== 'capital' && <td className="text-secondary fw-bold" style={{ whiteSpace: 'nowrap' }}>{formatCurrency(p.earnedLab)}</td>}
                                <td className="fw-bold">{formatCurrency(p.grossPayout)}</td>
                                <td className="text-accent">{p.volPct}% (-{formatCurrency(p.volDeduction)})</td>
                                <td className="fw-bold text-main">{formatCurrency(p.total)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            {/* Section 3: Sake of Allah Ledger */}
            <section className="animate-fade-in delay-300 glass-card border-accent" style={{ borderColor: 'var(--accent)' }}>
                <div className="flex-between">
                    <div>
                        <h2 className="text-accent mb-2">The "Sake of Allah" Ledger</h2>
                        <p className="text-muted">Combined global & voluntary partner deductions.</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xl fw-bold">{formatCurrency(capitalCharityDeduction + labourCharityDeduction + totalVoluntaryCharity)}</p>
                        <p className="text-muted text-sm mb-4">Total Accrued Pool</p>
                        <button className="btn">Transfer to Charity</button>
                    </div>
                </div>
            </section>

            {/* Section 4: Historical Reports */}
            <section className="animate-fade-in delay-400 glass-card">
                <h2 className="mb-4">Generated Distribution Reports</h2>
                {reports.length === 0 ? (
                    <p className="text-muted text-center py-8">No formal reports generated yet.</p>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Period</th>
                                <th>Net Profit</th>
                                <th>Global Charity</th>
                                <th>Partner Charity</th>
                                <th>Generated At</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map((report) => (
                                <tr key={report.id}>
                                    <td className="fw-bold text-main">{report.period_name}</td>
                                    <td>{formatCurrency(report.net_profit)}</td>
                                    <td className="text-danger">{formatCurrency(report.global_charity)}</td>
                                    <td className="text-accent">{formatCurrency(report.voluntary_charity)}</td>
                                    <td className="text-xs text-muted">{new Date(report.created_at).toLocaleString()}</td>
                                    <td>
                                        <button 
                                            className="btn text-xs flex items-center gap-1" 
                                            style={{ padding: '0.25rem 0.5rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}
                                            onClick={() => generatePDF(report)}
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Download PDF
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            {/* Section 5: Transaction Ledger History */}
            <TransactionHistory 
                transactions={transactions} 
                onUpdateTransaction={onUpdateTransaction} 
                onDeleteTransaction={onDeleteTransaction}
                onDeleteAllTransactions={onDeleteAllTransactions}
                currencySymbol={currencySymbol}
                user={user}
            />

            {/* Edit Time Entry Modal */}
            {editingTimeEntry && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-card)' }}>
                        <div className="flex-between mb-4">
                            <h3>Edit Time Entry</h3>
                            <button onClick={() => setEditingTimeEntry(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
                        </div>

                        <div className="flex-column" style={{ gap: '1rem' }}>
                            <div>
                                <label className="text-sm text-muted block mb-1">Start Time</label>
                                <input
                                    type="datetime-local"
                                    value={editStartTime}
                                    onChange={(e) => setEditStartTime(e.target.value)}
                                    style={{
                                        width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'white'
                                    }}
                                />
                            </div>
                            <div>
                                <label className="text-sm text-muted block mb-1">End Time</label>
                                <input
                                    type="datetime-local"
                                    value={editEndTime}
                                    onChange={(e) => setEditEndTime(e.target.value)}
                                    style={{
                                        width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'white'
                                    }}
                                />
                            </div>
                            <button className="btn btn-primary w-full mt-2" onClick={handleSaveTimeEntry}>Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}

export default Dashboard
