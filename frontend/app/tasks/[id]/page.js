'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { getTask } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { format } from 'date-fns';

const STATUS_COLORS = {
  pending: 'badge-pending', running: 'badge-running',
  success: 'badge-success', failed: 'badge-failed',
};

const OP_LABELS = {
  uppercase: '🔠 UPPERCASE', lowercase: '🔡 lowercase',
  reverse: '🔄 Reverse', word_count: '🔢 Word Count',
};

export default function TaskDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return; }
  }, [router]);

  const fetchTask = async () => {
    try {
      const res = await getTask(id);
      setTask(res.data.data);
    } catch (err) {
      toast.error('Task not found');
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTask(); }, [id]);

  // Auto-poll while pending or running
  useEffect(() => {
    if (!task) return;
    if (task.status === 'pending' || task.status === 'running') {
      const id = setInterval(fetchTask, 3000);
      return () => clearInterval(id);
    }
  }, [task?.status]);

  if (loading) return (
    <div className="page-wrapper">
      <nav className="navbar">
        <div className="navbar-inner">
          <Link href="/dashboard" className="navbar-brand">⚡ TaskFlow</Link>
        </div>
      </nav>
      <div className="loading-page"><div className="spinner" style={{ width: 40, height: 40 }} /></div>
    </div>
  );

  return (
    <div className="page-wrapper">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-inner">
          <Link href="/dashboard" className="navbar-brand">⚡ TaskFlow</Link>
          <div className="navbar-nav">
            <Link href="/dashboard" className="btn btn-ghost btn-sm">← Back to Dashboard</Link>
            <Link href="/tasks/new" className="btn btn-primary btn-sm">+ New Task</Link>
          </div>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        {/* Header */}
        <div className="task-detail-header">
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontFamily: 'monospace' }}>
              Task ID: {task._id}
            </div>
            <h1 className="task-detail-title">{task.title}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className={`badge ${STATUS_COLORS[task.status]}`} style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}>
              <span className={`badge-dot dot-${task.status}`} />
              {task.status}
            </span>
            {(task.status === 'pending' || task.status === 'running') && (
              <button onClick={fetchTask} className="btn btn-secondary btn-sm" id="refresh-task-btn">↻ Refresh</button>
            )}
          </div>
        </div>

        {/* Details grid */}
        <div className="detail-grid" style={{ marginBottom: '1rem' }}>
          <div className="detail-block">
            <div className="detail-block-label">Operation</div>
            <div className="detail-block-value" style={{ fontFamily: 'monospace', color: 'var(--accent-light)', fontSize: '1rem', fontWeight: 700 }}>
              {OP_LABELS[task.operation]}
            </div>
          </div>
          <div className="detail-block">
            <div className="detail-block-label">Created</div>
            <div className="detail-block-value">
              {format(new Date(task.createdAt), 'PPP HH:mm:ss')}
            </div>
          </div>
          {task.startedAt && (
            <div className="detail-block">
              <div className="detail-block-label">Started At</div>
              <div className="detail-block-value">{format(new Date(task.startedAt), 'PPP HH:mm:ss')}</div>
            </div>
          )}
          {task.completedAt && (
            <div className="detail-block">
              <div className="detail-block-label">Completed At</div>
              <div className="detail-block-value">{format(new Date(task.completedAt), 'PPP HH:mm:ss')}</div>
            </div>
          )}
        </div>

        {/* Input Text */}
        <div className="detail-block" style={{ marginBottom: '1rem' }}>
          <div className="detail-block-label">Input Text</div>
          <div className="detail-block-value" style={{ marginTop: '0.5rem', fontFamily: 'monospace', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px', maxHeight: 200, overflowY: 'auto' }}>
            {task.inputText}
          </div>
        </div>

        {/* Result */}
        {task.status === 'success' && task.result && (
          <div className="result-block">
            <div className="result-block-label">✅ Result</div>
            <div className="result-block-value">{task.result}</div>
          </div>
        )}

        {/* Error */}
        {task.status === 'failed' && task.errorMessage && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginTop: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--status-failed)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
              ❌ Error
            </div>
            <div style={{ fontFamily: 'monospace', color: '#f87171' }}>{task.errorMessage}</div>
          </div>
        )}

        {/* Logs */}
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📜 Processing Logs
            <span style={{ fontSize: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '0.1rem 0.5rem', borderRadius: '100px' }}>
              {task.logs?.length || 0} entries
            </span>
          </div>
          <div className="logs-container" id="task-logs">
            {!task.logs || task.logs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>No logs yet...</div>
            ) : (
              task.logs.map((log, i) => (
                <div key={i} className="log-entry">
                  <span className="log-ts">[{format(new Date(log.timestamp), 'HH:mm:ss')}]</span>
                  <span className={`log-msg-${log.level || 'info'}`}>{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending animation */}
        {(task.status === 'pending' || task.status === 'running') && (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 0.75rem' }} />
            Task is {task.status}... auto-refreshing every 3 seconds
          </div>
        )}
      </div>
    </div>
  );
}
