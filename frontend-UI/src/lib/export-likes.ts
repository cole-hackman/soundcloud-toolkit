/** @deprecated Import from `@/lib/export` instead */
export {
  type ExportTrack as ExportLikeTrack,
  type ExportUser as ExportLikeUser,
  type NormalizedLike,
  getArtistName,
  formatTitleArtistLine as formatLikeLine,
  normalizeLikesCollection,
  likesToTracks as likesToExportLines,
  buildDatedFilename as buildLikesExportFilename,
  downloadTextFile,
  downloadFile,
} from "./export";
