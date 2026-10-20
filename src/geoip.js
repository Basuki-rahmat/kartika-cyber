const PRIVATE_PATTERN = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.)/;

const ORIGIN_TABLE = [
  {
    match: '203.0.113.',
    location: 'Frankfurt, Jerman (exit node)',
    countryCode: 'DE',
    lat: 50.11,
    lng: 8.68,
    asn: 'AS64500',
    provider: 'Jaringan anonim contoh',
    vpn: true,
    tor: false,
    proxy: false,
    confidence: 38
  },
  {
    match: '198.51.100.',
    location: 'Amsterdam, Belanda (relay)',
    countryCode: 'NL',
    lat: 52.37,
    lng: 4.9,
    asn: 'AS64501',
    provider: 'Relay anonim contoh',
    vpn: false,
    tor: true,
    proxy: false,
    confidence: 31
  }
];

function profileFromOverride(ip, override) {
  const lat = Number(override.lat);
  const lng = Number(override.lng);
  return {
    ip,
    kind: PRIVATE_PATTERN.test(ip) ? 'internal' : 'public',
    apparentLocation: override.location || 'Lokasi simulasi tidak dicantumkan',
    countryCode: override.countryCode || null,
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    asn: override.asn || null,
    provider: override.provider || null,
    vpn: Boolean(override.vpn),
    tor: Boolean(override.tor),
    proxy: Boolean(override.proxy),
    confidence: Number.isFinite(Number(override.confidence)) ? Math.max(0, Math.min(100, Math.round(Number(override.confidence)))) : 70,
    note: 'Lokasi berasal dari profil penyerang simulasi pada konsol red-team, bukan penelusuran riil.'
  };
}

function trackSource(ip, override) {
  const address = typeof ip === 'string' ? ip : '';

  if (override && typeof override === 'object' && address) {
    return profileFromOverride(address, override);
  }

  if (!address) {
    return {
      ip: address,
      kind: 'unknown',
      apparentLocation: 'Tidak diketahui',
      countryCode: null,
      asn: null,
      provider: null,
      vpn: false,
      tor: false,
      proxy: false,
      confidence: 0,
      note: 'Metadata alamat sumber tidak tersedia pada insiden ini.'
    };
  }

  if (PRIVATE_PATTERN.test(address)) {
    return {
      ip: address,
      kind: 'internal',
      apparentLocation: 'Jaringan internal (privat)',
      countryCode: 'INT',
      asn: null,
      provider: 'Rentang privat RFC1918',
      vpn: false,
      tor: false,
      proxy: false,
      confidence: 85,
      note: 'Alamat privat: aktivitas berasal dari dalam jaringan terpantau, bukan dari internet publik.'
    };
  }

  const entry = ORIGIN_TABLE.find((item) => address.startsWith(item.match));
  if (entry) {
    return {
      ip: address,
      kind: 'anonymized',
      apparentLocation: entry.location,
      countryCode: entry.countryCode,
      lat: entry.lat,
      lng: entry.lng,
      asn: entry.asn,
      provider: entry.provider,
      vpn: entry.vpn,
      tor: entry.tor,
      proxy: entry.proxy,
      confidence: entry.confidence,
      note: 'Koneksi melewati jaringan anonim (VPN/Tor). Hanya lokasi tampak yang dapat diestimasi; alamat asli tidak dapat dipastikan dari metadata tunggal.'
    };
  }

  return {
    ip: address,
    kind: 'public',
    apparentLocation: 'Lokasi tampak tidak diketahui',
    countryCode: null,
    asn: null,
    provider: null,
    vpn: false,
    tor: false,
    proxy: false,
    confidence: 18,
    note: 'Tidak ada data geolokasi untuk alamat ini pada basis data simulasi.'
  };
}

function trackSources(sources, overrides) {
  const table = overrides && typeof overrides === 'object' && !Array.isArray(overrides) ? overrides : {};
  return (Array.isArray(sources) ? sources : []).map((ip) => trackSource(ip, table[ip]));
}

module.exports = { trackSource, trackSources };