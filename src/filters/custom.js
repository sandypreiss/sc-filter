window.activeSCFeedFilter = (data) => (item) => {
  const params = window.scFilterParams || {};
  if (!("track" in item)) return false; // always exclude playlists

  // Hard to imagine the 30 min threshold failing to distinguish tracks and mixes,
  // so this is a toggle instead of a flexible input.
  const durationMin = item.track.full_duration / 1000 / 60;
  if (params.trackType === "tracks" && durationMin >= 30) return false;
  if (params.trackType === "mixes" && durationMin < 30) return false;

  if (params.playCount != null && item.track.playback_count != null) {
    const op = params.playCountOp || ">=";
    if (op === ">=" && item.track.playback_count < params.playCount) return false;
    if (op === "<=" && item.track.playback_count > params.playCount) return false;
  }

  return true;
};
