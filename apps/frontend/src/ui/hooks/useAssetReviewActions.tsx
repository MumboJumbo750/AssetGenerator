import { useCallback } from "react";

export function useAssetReviewActions(opts: {
  reviewNote: string;
  customTag: string;
  setCustomTag: (value: string) => void;
  onSaveReviewNote: (note: string) => Promise<void>;
  onAddCustomTag: (tag: string, onClear: () => void) => Promise<void>;
}) {
  const handleSaveReviewNote = useCallback(() => {
    return opts.onSaveReviewNote(opts.reviewNote);
  }, [opts]);

  const handleAddCustomTag = useCallback(() => {
    return opts.onAddCustomTag(opts.customTag, () => opts.setCustomTag(""));
  }, [opts]);

  return { handleSaveReviewNote, handleAddCustomTag };
}
