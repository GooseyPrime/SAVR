'use client';

import Image from 'next/image';

const OFFICIAL_LOGO =
  'https://res.cloudinary.com/intellme/image/upload/w_1280,c_fit,q_auto,f_png/v1770328403/SAVR_Logo_NO_BG_3_hixen3.png';

/** Homepage hero mark. Video rotation was removed — static official logo only. */
export default function VideoHero() {
  return (
    <div className="relative mb-8 flex justify-center">
      <div className="relative w-full max-w-3xl px-4 sm:px-6">
        <Image
          src={OFFICIAL_LOGO}
          alt="SAVR — Smart Assistant for Virtual Recipes"
          width={1280}
          height={586}
          className="mx-auto w-full h-auto drop-shadow-[0_0_48px_rgba(163,230,53,0.18)]"
          priority
          unoptimized
        />
      </div>
    </div>
  );
}
