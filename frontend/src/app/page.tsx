"use client";

import { useAuth } from '../hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function LoginPage() {
  const { loginWithGoogle, loginWithEmail, signupWithEmail, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (isSignUp) {
      await signupWithEmail(email, password);
    } else {
      await loginWithEmail(email, password);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white font-sans">
      <div className="w-full max-w-[440px] px-4">
        {/* Clean Login Card matching screenshot */}
        <div className="bg-white px-10 py-12 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center">
          
          <h1 className="text-[32px] font-bold text-gray-900 mb-8">Login</h1>

          {/* Google Button */}
          <button
            id="btn-google-login"
            onClick={loginWithGoogle}
            disabled={loading}
            className="flex items-center justify-center w-full py-3 mb-6 bg-[#E8F5E9] text-gray-800 text-sm font-medium rounded-lg hover:bg-[#C8E6C9] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00A83B] transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin mr-3 h-5 w-5 text-gray-500" />
            ) : (
              <svg className="mr-3 h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Login with Google
          </button>

          {/* Divider */}
          <div className="w-full flex items-center justify-between mb-6">
            <div className="flex-1 h-[1px] bg-gray-200"></div>
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="px-3 text-xs text-gray-400 font-medium hover:text-[#00A83B] transition-colors focus:outline-none"
            >
              {isSignUp ? "or login through email" : "or sign up through email"}
            </button>
            <div className="flex-1 h-[1px] bg-gray-200"></div>
          </div>

          {/* Functional Inputs */}
          <form onSubmit={handleEmailSubmit} className="w-full flex flex-col items-center">
            <div className="w-full space-y-4 mb-8">
              <input 
                type="email" 
                placeholder="Email ID" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                className="w-full bg-[#F5F7F6] text-sm text-gray-900 rounded-lg px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#00A83B] placeholder:text-gray-400 disabled:opacity-50"
              />
              <input 
                type="password" 
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)} 
                disabled={loading}
                required
                className="w-full bg-[#F5F7F6] text-sm text-gray-900 rounded-lg px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#00A83B] placeholder:text-gray-400 disabled:opacity-50"
              />
            </div>

            {/* Login/Signup Button */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-[#00A83B] text-white font-medium py-3 rounded-lg hover:bg-[#009635] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00A83B] transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5 text-white" /> : (isSignUp ? "Sign Up" : "Login")}
            </button>
          </form>

        </div>
      </div>
    </main>
  );
}
