'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { getTasks, getMe, deleteTask } from '@/lib/api';
import { removeToken, isAuthenticated } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';

const STATUS_COLORS = {
  pending: 'badge-pending', running: 'badge-running',
  success: 'badge-success', failed: 'badge-failed',
};
const OP_LABELS = {
  uppercase: '🔠 UPPERCASE', lowercase: '🔡 lowercase',
  reverse: '🔄 Reverse', word_count: '🔢 Word Count',
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, pending: 0, running: 0, success: 0, failed: 0 });

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return; }
    getMe().then(r => setUser(r.data.user)).catch(() => { removeToken(); router.push('/login'); });
  }, [router]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (filter !== 'all') params.status = filter;
      const res = await getTasks(params);
      setTasks(res.data.data);
      setTotalPages(res.data.pagination.pages);
      if (filter === 'all') {
        const all = res.data.pagination.total;
        // Get stats counts
        const [p, r, s, f] = await Promise.all([
          getTasks({ status: 'pending', limit: 1 }),
          getTasks({ status: 'running', limit: 1 }),
          getTasks({ status: 'success', limit: 1 }),
          getTasks({ status: 'failed', limit: 1 }),
        ]);
        setStats({
          total: all,
          pending: p.data.pagination.total,
          running: r.data.pagination.total,
          success: s.data.pagination.total,
          failed:  f.data.pagination.total,
        });
      }
    } catch (e) { toast.error('Failed to load tasks'); }
    setLoading(false);
  }, [filter, page]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Auto-refresh every 5s if any task is running/pending
  useEffect(() => {
    const hasPendingOrRunning = tasks.some(t => t.status === 'pending' || t.status === 'running');
    if (!hasPendingOrRunning) return;
    const id = setInterval(fetchTasks, 5000);
    return () => clearInterval(id);
  }, [tasks, fetchTasks]);

  const handleDelete = async (e, id) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm('Delete this task?')) return;
    try {
      await deleteTask(id);
      toast.success('Task deleted');
      fetchTasks();
    } catch { toast.error('Failed to delete task'); }
  };

  const handleLogout = () => { removeToken(); router.push('/'); };

  return (
    <div className="page-wrapper">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-inner">
          <Link href="/dashboard" className="navbar-brand">⚡ TaskFlow</Link>
          <div className="navbar-nav">
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginRight: '0.5rem' }}>
              {user?.name}
            </span>
            <Link href="/tasks/new" className="btn btn-primary btn-sm">+ New Task</Link>
            <button onClick={handleLogout} className="btn btn-ghost btn-sm" id="logout-btn">Sign Out</button>
          </div>
        </div>
      </nav>

      <div className="container">
        {/* Header */}
        <div className="dashboard-header">
          <h1>Task Dashboard</h1>
          <p>Monitor and manage your AI processing tasks</p>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          {[
            { label: 'Total Tasks', value: stats.total, icon: '📋', color: 'var(--accent-light)' },
            { label: 'Pending', value: stats.pending, icon: '⏳', color: 'var(--status-pending)' },
            { label: 'Running', value: stats.running, icon: '⚙️', color: 'var(--status-running)' },
            { label: 'Success', value: stats.success, icon: '✅', color: 'var(--status-success)' },
            { label: 'Failed', value: stats.failed, icon: '❌', color: 'var(--status-failed)' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-card-icon">{s.icon}</div>
              <div className="stat-card-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-card-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Task list */}
        <div className="tasks-header">
          <div className="filter-tabs">
            {['all', 'pending', 'running', 'success', 'failed'].map(f => (
              <button key={f} id={`filter-${f}`} className={`filter-tab ${filter === f ? 'active' : ''}`}
                onClick={() => { setFilter(f); setPage(1); }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={fetchTasks} className="btn btn-secondary btn-sm" id="refresh-btn">↻ Refresh</button>
        </div>

        {loading ? (
          <div className="loading-page"><div className="spinner" style={{ width: 40, height: 40 }} /></div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <h3>No tasks found</h3>
            <p>{filter === 'all' ? 'Create your first task to get started.' : `No ${filter} tasks.`}</p>
            <Link href="/tasks/new" className="btn btn-primary">+ Create Task</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {tasks.map(task => (
              <Link href={`/tasks/${task._id}`} key={task._id} className="task-card" id={`task-${task._id}`}>
                <div className="task-card-info">
                  <div className="task-card-title">{task.title}</div>
                  <div className="task-card-meta">
                    <span className="task-card-op">{OP_LABELS[task.operation]}</span>
                    <span>{formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className={`badge ${STATUS_COLORS[task.status]}`}>
                    <span className={`badge-dot dot-${task.status}`} />
                    {task.status}
                  </span>
                  <button onClick={(e) => handleDelete(e, task._id)} className="btn btn-danger btn-sm" style={{ padding: '0.3rem 0.6rem' }}>
                    🗑
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', paddingBottom: '2rem' }}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn btn-secondary btn-sm">← Prev</button>
            <span style={{ padding: '0.4rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Page {page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="btn btn-secondary btn-sm">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
