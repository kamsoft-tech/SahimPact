import React, { useState } from 'react';

const CSVUpload = ({ token, onUploadSuccess }) => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setMessage(null);
            setError(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        setMessage(null);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/ingest/bank-statement', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || 'Failed to upload CSV');
            }

            const data = await res.json();
            setMessage(data.message);
            setFile(null);
            
            // Reset file input
            const fileInput = document.getElementById('csv-upload-input');
            if(fileInput) fileInput.value = '';

            if (onUploadSuccess) {
                onUploadSuccess();
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="animate-fade-in glass-card" style={{ border: '1px solid var(--primary)', marginBottom: '2.5rem' }}>
            <div className="flex-between mb-4">
                <div>
                    <h2 className="text-primary mb-2">Automated Bank Statement Import</h2>
                    <p className="text-muted text-sm">Upload a CSV bank statement to automatically build your ledger. Incoming payments become Sales; outgoing become Expenses.</p>
                </div>
            </div>

            <div className="flex gap-4" style={{ alignItems: 'center' }}>
                <input 
                    id="csv-upload-input"
                    type="file" 
                    accept=".csv" 
                    onChange={handleFileChange}
                    style={{
                        padding: '0.75rem',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px dashed rgba(255,255,255,0.2)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'white',
                        flex: 1,
                        cursor: 'pointer'
                    }}
                />
                <button 
                    className="btn btn-primary" 
                    onClick={handleUpload} 
                    disabled={!file || loading}
                    style={{ whiteSpace: 'nowrap', padding: '0.75rem 1.5rem' }}
                >
                    {loading ? 'Processing...' : 'Upload & Import'}
                </button>
            </div>

            <div className="mt-4 text-sm text-muted">
                <strong>Supported Formats:</strong> Compatible with standard CSVs as well as native <strong>Mettle</strong>, <strong>Tide</strong>, and <strong>Wise</strong> exports.
            </div>

            {message && (
                <div className="mt-4 p-3 rounded" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981' }}>
                    {message}
                </div>
            )}
            {error && (
                <div className="mt-4 p-3 rounded" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
                    {error}
                </div>
            )}
        </section>
    );
};

export default CSVUpload;
