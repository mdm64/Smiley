'use client';

import { Share } from '@/components/icons';

/** Opens WhatsApp with a ready-to-send message and a link back to the page.
 *  Campus trade already happens in WhatsApp groups, so we meet people there. */
export default function ShareButton({
  path,
  message,
  label = 'Share on WhatsApp',
  wide = true,
}: {
  path: string;
  message: string;
  label?: string;
  wide?: boolean;
}) {
  const share = () => {
    const url = `${window.location.origin}${path}`;
    const text = `${message}\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <button type="button" className={`btn${wide ? ' wide' : ''}`} onClick={share}>
      <Share /> {label}
    </button>
  );
}
