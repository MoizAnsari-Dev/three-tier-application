'use client';
import Link from 'next/link';
import { isAuthenticated } from '@/lib/auth';
import { useEffect, useState } from 'react';

export default function Home() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => { setAuthed(isAuthenticated()); }, []);

  return (
    <main className="hero">
      <div className="hero-badge">
        <span>⚡</span> Production-Ready Three-Tier Application
      </div>

      <h1 className="hero-title">
        Process Text Tasks<br />
        <span className="gradient-text">at Massive Scale</span>
      </h1>

      <p className="hero-desc">
        A full-stack platform powered by Node.js, Python workers, MongoDB, and Redis.
        Run operations asynchronously with real-time status tracking.
      </p>

      <div className="hero-actions">
        {authed ? (
          <Link href="/dashboard" className="btn btn-primary btn-lg">
            Go to Dashboard →
          </Link>
        ) : (
          <>
            <Link href="/register" className="btn btn-primary btn-lg">
              Get Started Free
            </Link>
            <Link href="/login" className="btn btn-secondary btn-lg">
              Sign In
            </Link>
          </>
        )}
      </div>

      <div className="hero-stats">
        {[
          { value: '4', label: 'Operations' },
          { value: '∞', label: 'Tasks / Day' },
          { value: '<1s', label: 'Avg Latency' },
          { value: '99.9%', label: 'Uptime SLA' },
        ].map((s) => (
          <div key={s.label} className="stat-item">
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Feature cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', maxWidth: 900, width: '100%', marginTop: '4rem' }}>
        {[
          { icon: '🔐', title: 'Secure by Default', desc: 'JWT auth, bcrypt, helmet, rate limiting — production security out of the box.' },
          { icon: '⚡', title: 'Async Processing', desc: 'Redis queue + Python workers process tasks without blocking your API.' },
          { icon: '📊', title: 'Real-time Status', desc: 'Track every task from pending → running → success/failed with full logs.' },
          { icon: '☸️', title: 'Kubernetes-Ready', desc: 'Full K8s manifests, Argo CD GitOps, and auto-scaling worker pods.' },
        ].map((f) => (
          <div key={f.title} className="card card-hover" style={{ textAlign: 'left', animation: 'fadeInUp 0.6s ease both' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{f.icon}</div>
            <h3 style={{ fontWeight: 700, marginBottom: '0.4rem', fontSize: '1rem' }}>{f.title}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
