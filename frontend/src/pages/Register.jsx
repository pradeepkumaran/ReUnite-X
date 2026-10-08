import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { HeartHandshake } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('public');
  const { loginWithRole } = useAuth();
  const navigate = useNavigate();

  const handleRegister = (e) => {
    e.preventDefault();
    loginWithRole(role, fullName || 'Citizen User');
    navigate('/');
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="card-white space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center mx-auto shadow-emergency">
            <HeartHandshake className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Create REUNITE-X Account</h1>
          <p className="text-xs text-slate-500">Register as Public Reporter or Relief Volunteer</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Ananya Sharma"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 text-sm outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ananya@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 text-sm outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-500 text-sm outline-none bg-white"
            >
              <option value="public">Public / Family Member</option>
              <option value="volunteer">Field Volunteer (Relief Camp)</option>
              <option value="authority">Disaster Response Authority (NDRF)</option>
            </select>
          </div>

          <button
            type="submit"
            className="btn-emergency w-full text-sm py-3"
          >
            Create Account
          </button>
        </form>

        <div className="text-center text-xs text-slate-500 pt-2">
          Already registered? <Link to="/login" className="font-bold text-brand-600 hover:underline">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
