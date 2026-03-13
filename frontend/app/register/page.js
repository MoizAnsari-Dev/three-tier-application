'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { register } from '@/lib/api';
import { setToken } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.name || form.name.length < 2) e.name = 'Name must be at least 2 characters';
    if (!form.email.match(/^\S+@\S+\.\S+$/)) e.email = 'Invalid email address';
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      const res = await register(form);
      setToken(res.data.token);
      toast.success('Account created! Welcome aboard 🎉');
      router.push('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed';
      toast.error(msg);
      setErrors({ global: msg });
    } finally {
      setLoading(false);
    }
  };

  const field = (key, label, type, placeholder) => (
    <div className="form-group">
      <label className="form-label" htmlFor={key}>{label}</label>
      <input
        id={key}
        type={type}
        className="form-input"
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        required
      />
      {errors[key] && <span className="form-error">{errors[key]}</span>}
    </div>
  );

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>⚡ TaskFlow</h1>
          <p>Create your free account</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} id="register-form">
          {field('name', 'Full Name', 'text', 'John Doe')}
          {field('email', 'Email Address', 'email', 'you@example.com')}
          {field('password', 'Password (min 8 chars)', 'password', '••••••••')}
          {errors.global && <p className="form-error">⚠ {errors.global}</p>}

          <button id="register-submit" type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.85rem' }} disabled={loading}>
            {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Creating Account...</> : 'Create Account →'}
          </button>
        </form>

        <p className="auth-divider" style={{ marginTop: '1.5rem' }}>
          Already have an account?{' '}
          <Link href="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
