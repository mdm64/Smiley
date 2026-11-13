'use client';

import { useState } from 'react';

export default function Gallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);

  return (
    <div className="gallery">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="hero" src={images[active]} alt={title} />
      {images.length > 1 && (
        <div className="strip">
          {images.map((src, i) => (
            <button
              key={src}
              data-on={i === active}
              onClick={() => setActive(i)}
              aria-label={`Photo ${i + 1} of ${images.length}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
