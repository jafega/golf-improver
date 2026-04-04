import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const pinLat = searchParams.get('pinLat');
  const pinLng = searchParams.get('pinLng');
  const hole = searchParams.get('hole') ?? '1';
  const zoom = searchParams.get('zoom') ?? '18';

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey || !lat || !lng) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  // Build center between user and pin for best framing
  const centerLat = pinLat ? (parseFloat(lat) + parseFloat(pinLat)) / 2 : parseFloat(lat);
  const centerLng = pinLng ? (parseFloat(lng) + parseFloat(pinLng)) / 2 : parseFloat(lng);

  const params = new URLSearchParams({
    center: `${centerLat},${centerLng}`,
    zoom,
    size: '600x400',
    scale: '2',
    maptype: 'satellite',
    key: apiKey,
  });

  // User marker (blue)
  params.append('markers', `color:blue|label:T|${lat},${lng}`);

  // Pin marker (red)
  if (pinLat && pinLng) {
    params.append('markers', `color:red|label:${hole}|${pinLat},${pinLng}`);
    // Draw path between user and pin
    params.append('path', `color:0x22c55eff|weight:3|${lat},${lng}|${pinLat},${pinLng}`);
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/staticmap?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json({ error: 'Static Maps API error' }, { status: 500 });
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return NextResponse.json({
      image: `data:image/png;base64,${base64}`,
    });
  } catch (err) {
    console.error('Map screenshot error:', err);
    return NextResponse.json({ error: 'Failed to capture map' }, { status: 500 });
  }
}
