'use client';

import { useEffect, useState } from 'react';
import { hud } from '@/lib/mark/hud';

/**
 * The slow field of colour every glass panel floats over. It brightens while
 * the assistant is speaking — the room reacting to the voice — and is otherwise
 * left alone: four radial gradients and a grain layer, moved only by transforms.
 */
export default function Backdrop() {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => hud.subscribe(() => setSpeaking(hud.state === 'SPEAKING')), []);
  return (
    <div className={`backdrop${speaking ? ' speaking' : ''}`} aria-hidden>
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      <div className="blob b4" />
      <div className="grain" />
    </div>
  );
}
