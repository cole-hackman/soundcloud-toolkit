import type { ElementType } from "react";
import { Heart, ListMusic, Repeat2, Users } from "lucide-react";
import {
  followingsToCsv,
  followingsToTxt,
  repostsToCsv,
  repostsToTxt,
  repostsToUrls,
  type ExportFollowing,
  type ExportRepost,
} from "@/lib/export";
import type { ListExportFormat } from "@/components/export/ListExportCard";

export interface ExportFeature {
  id: string;
  title: string;
  description: string;
  icon: ElementType;
  path: string;
}

export const EXPORT_FEATURES: ExportFeature[] = [
  {
    id: "likes",
    title: "Export Likes",
    description: "Download all liked tracks as Title - Artist lines, URLs, or CSV",
    icon: Heart,
    path: "/export/likes",
  },
  {
    id: "playlists",
    title: "Export Playlist",
    description: "Pick a playlist and export its tracks in the same formats",
    icon: ListMusic,
    path: "/export/playlists",
  },
  {
    id: "followings",
    title: "Export Followings",
    description: "Export accounts you follow as a text list or spreadsheet",
    icon: Users,
    path: "/export/followings",
  },
  {
    id: "reposts",
    title: "Export Reposts",
    description: "Export reposted tracks and playlists as lines, URLs, or CSV",
    icon: Repeat2,
    path: "/export/reposts",
  },
];

export const FOLLOWING_FORMATS: ListExportFormat[] = [
  {
    id: "txt",
    label: "Display name / @username (.txt)",
    extension: "txt",
    mime: "text/plain;charset=utf-8",
    build: (items) => followingsToTxt(items as ExportFollowing[]),
  },
  {
    id: "csv",
    label: "CSV (username, name, URL, counts)",
    extension: "csv",
    mime: "text/csv;charset=utf-8",
    build: (items) => followingsToCsv(items as ExportFollowing[]),
  },
];

export const REPOST_FORMATS: ListExportFormat[] = [
  {
    id: "txt",
    label: "Title - Artist / Playlist lines (.txt)",
    extension: "txt",
    mime: "text/plain;charset=utf-8",
    build: (items) => repostsToTxt(items as ExportRepost[], false),
  },
  {
    id: "txt-url",
    label: "Lines with URLs (.txt)",
    extension: "txt",
    mime: "text/plain;charset=utf-8",
    build: (items) => repostsToTxt(items as ExportRepost[], true),
  },
  {
    id: "urls",
    label: "URLs only (.txt)",
    extension: "txt",
    mime: "text/plain;charset=utf-8",
    build: (items) => repostsToUrls(items as ExportRepost[]),
  },
  {
    id: "csv",
    label: "CSV (type, title, artist, URL)",
    extension: "csv",
    mime: "text/csv;charset=utf-8",
    build: (items) => repostsToCsv(items as ExportRepost[]),
  },
];
