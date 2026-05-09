import { NextResponse } from 'next/server';

// Process / DB health probe. Module 0: app-only check. Module 9 hardening
// adds a database round-trip and a small set of dependency checks.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    ok: true,
    name: 'bluecare',
    version: process.env.npm_package_version ?? '0.1.0',
    timestamp: new Date().toISOString(),
  });
}
