"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Layers, Heart, ListChecks, Link as LinkIcon } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export default function LoginPage() {
  const { isAuthenticated, loading, login, apiUnreachable, retryAuth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, loading, router]);

  // Pre-warm API before redirecting to reduce cold-start hiccups
  const prewarmAndLogin = async () => {
    try {
      await Promise.race([
        fetch(`${API_BASE}/health`, { credentials: "include" }),
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ]);
    } catch {
      // Ignore errors
    }
    try {
      // one retry if it was asleep
      await Promise.race([
        fetch(`${API_BASE}/health`, { credentials: "include" }),
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ]);
    } catch {
      // Ignore errors
    }
    login();
  };

  const features = [
    {
      icon: Layers,
      title: "Combine Playlists",
      desc: "Merge and remove duplicates instantly.",
    },
    {
      icon: Heart,
      title: "Likes → Playlist",
      desc: "Turn favorites into organized collections.",
    },
    {
      icon: ListChecks,
      title: "Smart Deduplication",
      desc: "Keep your playlists clean.",
    },
    {
      icon: LinkIcon,
      title: "Link Resolver",
      desc: "Get details from any SoundCloud link.",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-50 to-white">
        <div className="w-8 h-8 border-2 border-[#FF5500] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-orange-50 to-white">
      <div className="w-full max-w-[480px]">
        <div className="bg-white rounded-2xl shadow-xl p-8 relative border border-gray-100">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6 mt-8">
            <Image
              src="/sc toolkit transparent .png"
              alt="SC Toolkit"
              width={180}
              height={60}
              className="w-[140px] sm:w-[180px] object-contain"
              priority
            />
          </div>

          {/* Headline */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold text-[#333333]">
              Smarter SoundCloud Playlists
            </h1>
            <p className="mt-1 text-sm text-[#666666]">
              Organize, merge, and clean your SoundCloud music in ways the
              native app can&apos;t.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4 mb-8">
            {features.map((f, index) => (
              <div
                key={index}
                className="flex items-start gap-3 py-3 animate-fadeIn"
                style={{
                  animationDelay: `${0.15 + index * 0.07}s`,
                }}
              >
                <div className="w-10 h-10 rounded flex items-center justify-center bg-[#FF5500]">
                  <f.icon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-[#333333]">
                    {f.title}
                  </div>
                  <div className="text-base text-[#666666]">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* API unreachable message */}
          {apiUnreachable && (
            <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-center">
              <p className="text-sm text-amber-800 font-medium">
                API server unavailable
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Start the backend with <code className="bg-amber-100 px-1 rounded">npm run dev:full</code> and ensure <code className="bg-amber-100 px-1 rounded">.env</code> has the required variables.
              </p>
              <button
                onClick={retryAuth}
                className="mt-2 text-sm text-[#FF5500] font-semibold hover:underline"
              >
                Retry
              </button>
            </div>
          )}

          {/* Login Button (hidden on mobile; mobile has sticky CTA below) */}
          <div className="hidden sm:flex justify-center">
            <button
              onClick={prewarmAndLogin}
              disabled={apiUnreachable}
              className="w-full sm:w-[280px] mx-auto flex items-center justify-center rounded bg-gradient-to-r from-[#FF5500] to-[#E64A00] hover:brightness-95 hover:shadow-orange-200 text-white py-3 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="whitespace-nowrap">Continue with SoundCloud</span>
            </button>
          </div>
          <p className="text-xs text-center mt-3 text-[#999999]">
            Secure authentication via SoundCloud.
          </p>

          {/* Footer Links */}
          <div className="flex items-center justify-center gap-4 mt-6 text-sm text-gray-500">
            <Link className="hover:text-[#FF5500] transition" href="/about">
              About
            </Link>
            <Link className="hover:text-[#FF5500] transition" href="/privacy">
              Privacy
            </Link>
          </div>
        </div>
      </div>

      {/* Sticky mobile CTA */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur border-t border-gray-200 p-3">
        <button
          onClick={prewarmAndLogin}
          disabled={apiUnreachable}
          className="w-full flex items-center justify-center rounded bg-gradient-to-r from-[#FF5500] to-[#E64A00] hover:brightness-95 hover:shadow-orange-200 text-white py-3 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="whitespace-nowrap">Continue with SoundCloud</span>
        </button>
      </div>

    </div>
  );
}

