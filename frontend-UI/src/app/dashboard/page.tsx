"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Combine, Heart, Link as LinkIcon, ArrowRight, Shuffle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
}

interface UserStats {
  followers_count: number;
  followings_count: number;
  public_favorites_count: number;
  track_count: number;
  playlist_count: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserStats();
  }, []);

  const fetchUserStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/me`, {
        credentials: "include",
      });
      if (response.ok) {
        const userData = await response.json();
        setStats({
          followers_count: userData.followers_count || 0,
          followings_count: userData.followings_count || 0,
          public_favorites_count: userData.public_favorites_count || 0,
          track_count: userData.track_count || 0,
          playlist_count: userData.playlist_count || 0,
        });
      }
    } catch (error) {
      console.error("Failed to fetch user stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const features: FeatureCard[] = [
    {
      id: "combine",
      title: "Combine Playlists",
      description: "Merge multiple playlists and remove duplicates automatically",
      icon: Combine,
      path: "/combine",
    },
    {
      id: "likes",
      title: "Likes → Playlist",
      description: "Convert your liked tracks into an organized playlist",
      icon: Heart,
      path: "/likes-to-playlist",
    },
    {
      id: "modifier",
      title: "Playlist Modifier",
      description: "Reorder and remove tracks in your playlists",
      icon: Shuffle,
      path: "/playlist-modifier",
    },
    {
      id: "resolver",
      title: "Link Resolver",
      description: "Get detailed info from any SoundCloud link",
      icon: LinkIcon,
      path: "/link-resolver",
    },
  ];

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#F2F2F2]">
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-16 max-w-7xl">
          {/* Welcome Section */}
          <div className="text-center mb-12 sm:mb-16">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-[#333333]">
              Welcome back,{" "}
              <span className="bg-gradient-to-r from-[#FF5500] to-[#E64A00] bg-clip-text text-transparent">
                {user?.display_name}
              </span>
              !
            </h1>
            <p className="text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed px-4 text-[#666666]">
              Choose a tool to enhance your SoundCloud experience
            </p>
          </div>

          {/* Feature Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-12 sm:mb-16">
            {features.map((feature) => (
              <div
                key={feature.id}
                className="group rounded-2xl p-6 sm:p-8 md:p-10 hover:border-[#FF5500] hover:shadow-2xl transition-all duration-300 border-2 bg-white border-gray-200 hover:-translate-y-1"
              >
                <Link href={feature.path} className="block">
                  <div className="flex items-start justify-between mb-4 sm:mb-6">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#FF5500] to-[#E64A00] flex items-center justify-center text-white shadow-lg">
                      <feature.icon className="w-8 h-8 sm:w-10 sm:h-10" />
                    </div>
                    <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 text-[#FF5500] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 group-hover:text-[#FF5500] transition text-[#333333]">
                    {feature.title}
                  </h3>
                  <p className="leading-relaxed text-base sm:text-lg text-[#666666]">
                    {feature.description}
                  </p>
                </Link>
              </div>
            ))}
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {loading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-xl p-4 sm:p-6 text-center border-2 bg-white border-gray-200"
                  >
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg mx-auto mb-2 sm:mb-3 bg-gray-200 animate-pulse" />
                    <div className="w-16 h-4 sm:w-20 sm:h-5 rounded mx-auto bg-gray-200 animate-pulse" />
                  </div>
                ))
              : [
                  {
                    label: "Playlists",
                    value: stats?.playlist_count?.toString() || "0",
                    icon: "📋",
                  },
                  {
                    label: "Liked Tracks",
                    value: stats?.public_favorites_count?.toString() || "0",
                    icon: "❤️",
                  },
                  {
                    label: "Following",
                    value: stats?.followings_count?.toString() || "0",
                    icon: "👥",
                  },
                  {
                    label: "Followers",
                    value: stats?.followers_count?.toString() || "0",
                    icon: "⭐",
                  },
                ].map((stat, index) => (
                  <div
                    key={index}
                    className="rounded-xl p-4 sm:p-6 text-center border-2 hover:border-[#FF5500] hover:shadow-lg transition-all duration-300 bg-white border-gray-200 hover:-translate-y-1"
                  >
                    <div className="text-2xl sm:text-3xl mb-2">{stat.icon}</div>
                    <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 text-[#333333]">
                      {stat.value}
                    </div>
                    <div className="text-xs sm:text-sm font-medium text-[#666666]">
                      {stat.label}
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

