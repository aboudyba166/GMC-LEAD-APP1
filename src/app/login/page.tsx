"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/components/auth-provider";
import { Shield, Lock, User } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!login(username, password)) {
      setError("Invalid username or password");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-900 p-2 shadow-xl dark:bg-white">
              <Image
                src="/assets/logo.png"
                alt="GMC Logo"
                width={64}
                height={64}
                className="object-contain"
              />
            </div>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Gardenia Medical <span className="text-sky-600 dark:text-sky-400">Centre</span>
            </h2>
            <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              Lead Command Center Login
            </p>
          </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Username</label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-zinc-700 dark:bg-zinc-800"
                  placeholder="Enter username"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Password</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-zinc-700 dark:bg-zinc-800"
                  placeholder="Enter password"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              className="group relative flex w-full justify-center rounded-lg bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
            >
              Sign in
            </button>
          </div>
        </form>
        
        <div className="text-center text-[10px] text-zinc-400">
          &copy; 2026 Gardenia Medical Complex. All rights reserved.
        </div>
      </div>
    </div>
  );
}
