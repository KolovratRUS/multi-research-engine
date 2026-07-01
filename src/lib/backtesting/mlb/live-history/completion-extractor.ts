export type CompletionProxyFailureReason =
  | 'missing_last_completed_play_end'
  | 'invalid_last_completed_play_end'
  | 'last_play_not_complete';

export type CompletionProxyExtraction =
  | {
      readonly ok: true;
      readonly completedAt: Date;
      readonly source: 'LAST_COMPLETED_PLAY_END';
    }
  | {
      readonly ok: false;
      readonly reason: CompletionProxyFailureReason;
    };

export function extractLastCompletedPlayEnd(
  allPlays: readonly { readonly about?: { readonly isComplete?: boolean; readonly endTime?: string } }[] | null | undefined,
): CompletionProxyExtraction {
  if (!allPlays || allPlays.length === 0) {
    return { ok: false, reason: 'missing_last_completed_play_end' };
  }

  const last = allPlays[allPlays.length - 1];
  const about = last?.about;
  if (!about) {
    return { ok: false, reason: 'missing_last_completed_play_end' };
  }
  if (!about.isComplete) {
    return { ok: false, reason: 'last_play_not_complete' };
  }

  const endTime = about.endTime;
  if (!endTime) {
    return { ok: false, reason: 'missing_last_completed_play_end' };
  }

  const completedAt = new Date(endTime);
  if (Number.isNaN(completedAt.getTime())) {
    return { ok: false, reason: 'invalid_last_completed_play_end' };
  }

  return { ok: true, completedAt, source: 'LAST_COMPLETED_PLAY_END' };
}
