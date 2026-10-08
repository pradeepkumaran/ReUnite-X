import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartHandshake, ShieldCheck, User, Users, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('public');
  const { loginWithRole } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    loginWithRole(selectedRole, email ? email.split('@')[0] : 'Citizen User');
    if (selectedRole === 'authority') {
      navigate('/authority');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="card-white space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center mx-auto shadow-emergency">
            <HeartHandshake className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Sign in to REUNITE-X</h1>
          <p className="text-xs text-slate-500">Access role-authorized disaster response portal</p>
        </div>

        {/* Quick Role Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">Select Your Role:</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'public', label: 'Public / Family', icon: User },
              { id: 'volunteer', label: 'Field Volunteer', icon: Users },
              { id: 'authority', label: 'Authority', icon: ShieldCheck },
            ].map((r) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRole(r.id)}
                  className={`p-2.5 rounded-xl border text-center transition ${
                    selectedRole === r.id
                      ? 'border-brand-600 bg-red-50 text-brand-700 font-bold shadow-sm'
                      : 'border-gray-200 text-slate-600 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4 mx-auto mb-1 text-brand-600" />
                  <span className="text-[11px] block leading-tight">{r.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. officer@reunite-x.org"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 text-sm outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 text-sm outline-none"
            />
          </div>

          <button
            type="submit"
            className="btn-emergency w-full text-sm py-3"
          >
            Sign In as {selectedRole.toUpperCase()}
          </button>
        </form>

        <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-center text-xs text-brand-900">
          💡 For testing: You can sign in immediately using any role without prior registration.
        </div>
      </div>
    </div>
  );
}
