'use client';

import { useState } from 'react';
import { PANTRY_ACCURACY_TIPS, SNAPSHOT_CAMERA_TIPS } from '@/lib/pantryTips';

export default function PantryTipsCard({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(!compact);

  return (
    <div className="rounded-xl px-5 py-4 mb-6 text-sm bg-primary/5 border border-primary/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <p className="font-semibold text-primary mb-1">How to store and shoot for accuracy</p>
          <p className="text-foreground-muted">
            Face labels out. One shelf per photo. Review before you save.
          </p>
        </div>
        <span className="text-primary text-xs font-semibold ml-4 shrink-0">
          {open ? 'Hide' : 'Show tips'}
        </span>
      </button>

      {open && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {PANTRY_ACCURACY_TIPS.map((tip) => (
            <div key={tip.title} className="rounded-lg border border-border/60 bg-background/40 p-3">
              <p className="font-semibold text-foreground mb-1">{tip.title}</p>
              <p className="text-foreground-muted text-xs leading-relaxed">{tip.body}</p>
            </div>
          ))}
          <div className="md:col-span-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="font-semibold text-foreground mb-2">While you take the photo</p>
            <ul className="text-foreground-muted text-xs space-y-1 list-disc list-inside">
              {SNAPSHOT_CAMERA_TIPS.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
