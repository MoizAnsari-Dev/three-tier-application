'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createTask } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { useEffect } from 'react';

const OPERATIONS = [
  { id: 'uppercase',   icon: '🔠', name: 'UPPERCASE',   desc: 'Convert all text to uppercase' },
  { id: 'lowercase',   icon: '🔡', name: 'lowercase',   desc: 'Convert all text to lowercase' },
  { id: 'reverse',     icon: '🔄', name: 'Reverse',     desc: 'Reverse the entire string' },
  { id: 'word_count',  icon: '🔢', name: 'Word Count',  desc: 'Count total number of words' },
];

export default function NewTaskPage() {
  const router = useRouter();
  const [form, setForm] = useState({ title: '', inputText: '', operation: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isAuthenticated()) router.push('/login');
  }, [router]);

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.inputText.trim()) e.inputText = 'Input text is required';
    if (!form.operation) e.operation = 'Please select an operation';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      const res = await createTask(form);
      toast.success('Task created and queued! 🚀');
      router.push(`/tasks/${res.data.task._id}`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create task';
      toast.error(msg);
      setErrors({ global: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-inner">
          <Link href="/dashboard" className="navbar-brand">⚡ TaskFlow</Link>
          <div className="navbar-nav">
            <Link href="/dashboard" className="btn btn-ghost btn-sm">← Dashboard</Link>
          </div>
        </div>
      </nav>

      <div className="container">
        <div className="create-task-wrapper">
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Create New Task</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              Submit a text operation to be processed asynchronously
            </p>
          </div>

          <form onSubmit={handleSubmit} id="create-task-form">
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Title */}
              <div className="form-group">
                <label className="form-label" htmlFor="task-title">Task Title</label>
                <input
                  id="task-title"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Process customer feedback"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  maxLength={100}
                />
                {errors.title && <span className="form-error">{errors.title}</span>}
              </div>

              {/* Operation selector */}
              <div className="form-group">
                <label className="form-label">Operation</label>
                <div className="operation-grid">
                  {OPERATIONS.map((op) => (
                    <div
                      key={op.id}
                      id={`op-${op.id}`}
                      className={`operation-card ${form.operation === op.id ? 'selected' : ''}`}
                      onClick={() => setForm({ ...form, operation: op.id })}
                    >
                      <span className="op-icon">{op.icon}</span>
                      <div className="op-name">{op.name}</div>
                      <div className="op-desc">{op.desc}</div>
                    </div>
                  ))}
                </div>
                {errors.operation && <span className="form-error">{errors.operation}</span>}
              </div>

              {/* Input Text */}
              <div className="form-group">
                <label className="form-label" htmlFor="task-input">
                  Input Text
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.5rem' }}>
                    ({form.inputText.length} / 10,000)
                  </span>
                </label>
                <textarea
                  id="task-input"
                  className="form-textarea"
                  placeholder="Enter the text you want to process..."
                  value={form.inputText}
                  onChange={(e) => setForm({ ...form, inputText: e.target.value })}
                  maxLength={10000}
                  rows={6}
                />
                {errors.inputText && <span className="form-error">{errors.inputText}</span>}
              </div>

              {errors.global && <p className="form-error">⚠ {errors.global}</p>}

              {/* Preview */}
              {form.operation && form.inputText && (
                <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius-sm)', padding: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-light)', fontWeight: 600, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    Preview (client-side)
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {form.operation === 'uppercase' && form.inputText.toUpperCase()}
                    {form.operation === 'lowercase' && form.inputText.toLowerCase()}
                    {form.operation === 'reverse' && form.inputText.split('').reverse().join('')}
                    {form.operation === 'word_count' && `Word count: ${form.inputText.split(/\s+/).filter(Boolean).length}`}
                  </div>
                </div>
              )}

              {/* Submit */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  id="create-task-submit"
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: 'center', padding: '0.85rem' }}
                  disabled={loading}
                >
                  {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Queuing Task...</> : '🚀 Run Task'}
                </button>
                <Link href="/dashboard" className="btn btn-secondary" style={{ padding: '0.85rem 1.5rem' }}>
                  Cancel
                </Link>
              </div>

            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
