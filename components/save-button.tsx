'use client';

import { useOptimistic, useTransition } from 'react';
import { toggleSave } from '@/app/(app)/actions';
import { Heart } from '@/components/icons';

export default function SaveButton({
  listingId,
  saved,
  title,
}: {
  listingId: string;
  saved: boolean;
  title: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [, start] = useTransition();

  return (
    <button
      className="heart"
      data-on={optimistic}
      aria-pressed={optimistic}
      aria-label={`${optimistic ? 'Remove' : 'Save'} ${title}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(async () => {
          setOptimistic(!optimistic);
          await toggleSave(listingId, optimistic);
        });
      }}
    >
      <Heart size={16} filled={optimistic} />
    </button>
  );
}
