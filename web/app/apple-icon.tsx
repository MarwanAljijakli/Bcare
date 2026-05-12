import { ImageResponse } from 'next/og';

/**
 * App-router apple-icon convention: this file replaces a static
 * /apple-icon.* asset with a dynamically-rendered one. Next picks it
 * up at build time and serves it at /apple-icon.png.
 *
 * Module 9 hardening: the previous `apple-icon.svg` worked in modern
 * Safari but iOS prefers PNG for home-screen icons. The PNG is
 * generated via Next's edge-runtime ImageResponse so we don't need
 * to add `sharp` or commit a binary to the repo.
 *
 * Size: 180×180 is the canonical iOS apple-touch-icon dimension.
 */
export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 180, height: 180 };

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: '#2B6CB0',
        borderRadius: 40,
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="120" height="120">
        <path
          fill="#A7F3D0"
          d="M90 50c-9 0-16.8 6-16.8 15 0 7.8 5.1 15.6 13.8 24 8.1 7.8 17.1 14.1 21 16.8 2.4 1.5 6 1.5 8.4 0 3.9-2.7 12.9-9 21-16.8 8.7-8.4 13.8-16.2 13.8-24 0-9-7.8-15-16.8-15-6.9 0-13.2 3.9-16.2 9.6-3-5.7-9.3-9.6-16.2-9.6Z"
        />
      </svg>
    </div>,
    { ...size },
  );
}
