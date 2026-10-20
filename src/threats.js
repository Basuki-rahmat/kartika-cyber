const { randomUUID } = require('node:crypto');

function at(minutesAgo) {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function event(overrides) {
  return {
    id: randomUUID(),
    assetId: 'IT-WS-01',
    zone: 'IT',
    source: '10.66.0.1',
    eventType: 'connection_open',
    occurredAt: new Date().toISOString(),
    approved: false,
    inMaintenanceWindow: false,
    ...overrides
  };
}

const threatMethods = [
  {
    id: 'smart-ids',
    code: 'IDS-001',
    name: 'Smart IDS/IPS',
    tagline: 'Korelasi pola pemindaian & pemblokiran otomatis',
    description: 'Menembakkan koneksi beruntun ke gerbang target untuk memicu deteksi IDS/IPS berbasis perilaku.',
    vector: 'Reconnaissance / port scan',
    response: [
      'Blokir alamat sumber pada kebijakan IDS/IPS',
      'Naikkan tingkat perekaman log pada segmen terkait',
      'Kirim notifikasi ke analis SOC'
    ],
    build(site, attackerIp) {
      const assetId = `${site.code}-IT-GW`;
      const source = attackerIp || '10.66.13.9';
      return Array.from({ length: 5 }, (_, index) => event({
        assetId,
        zone: 'IT',
        source,
        eventType: 'connection_open',
        occurredAt: at(4 - index)
      }));
    }
  },
  {
    id: 'tip',
    code: 'TIP-002',
    name: 'Threat Intelligence Platform',
    tagline: 'Pencocokan indikator ancaman yang sudah dikenal',
    description: 'Menghubungkan sumber dengan indikator ancaman yang telah terdaftar pada feed intelijen.',
    vector: 'Known bad infrastructure',
    response: [
      'Cocokkan alamat sumber dengan feed intelijen',
      'Karantina host yang terhubung',
      'Perbarui daftar alamat terblokir'
    ],
    build(site, attackerIp) {
      return [event({
        assetId: `${site.code}-IT-WEB`,
        zone: 'IT',
        source: attackerIp || '203.0.113.66',
        eventType: 'connection_open'
      })];
    }
  },
  {
    id: 'air',
    code: 'AIR-003',
    name: 'Automated Incident Response',
    tagline: 'Korelasi rantai serangan & isolasi otomatis',
    description: 'Membangun rantai serangan bertahap dari zona IT menuju OT untuk memicu playbook respons otomatis.',
    vector: 'Multi-stage intrusion (IT ke OT)',
    response: [
      'Isolasi otomatis segmen OT terdampak',
      'Cabut sesi akun yang terkait',
      'Jalankan playbook pemulihan dan dokumentasi insiden'
    ],
    build(site, attackerIp) {
      const assetId = `${site.code}-HMI-01`;
      const source = attackerIp || '10.66.6.35';
      return [
        event({ assetId, zone: 'OT', source, sourceZone: 'IT', targetZone: 'OT', approved: false, eventType: 'connection_open', account: 'svc-maint', occurredAt: at(3) }),
        event({ assetId, zone: 'OT', source, eventType: 'protocol_write', account: 'svc-maint', inMaintenanceWindow: false, occurredAt: at(2) })
      ];
    }
  },
  {
    id: 'zdd',
    code: 'ZDD-004',
    name: 'Zero-Day Detection',
    tagline: 'Deteksi perilaku menyimpang tanpa signature',
    description: 'Mengirim perintah tulis dari aktor tak dikenal ke perangkat OT untuk menguji deteksi anomali zero-day.',
    vector: 'Unknown actor / anomalous command',
    response: [
      'Isolasi aset OT terdampak',
      'Ambil sampel untuk analisis forensik',
      'Eskalasi ke analis tingkat lanjut'
    ],
    build(site, attackerIp) {
      return [event({
        assetId: `${site.code}-PLC-01`,
        zone: 'OT',
        source: attackerIp || '10.66.6.77',
        eventType: 'protocol_write',
        account: 'svc-ghost',
        inMaintenanceWindow: false
      })];
    }
  },
  {
    id: 'enc',
    code: 'ENC-005',
    name: 'Encryption Tool',
    tagline: 'Deteksi transfer data keluar terenkripsi',
    description: 'Mensimulasikan transfer data keluar dalam jumlah besar melalui kanal terenkripsi untuk menguji deteksi eksfiltrasi.',
    vector: 'Encrypted data exfiltration',
    response: [
      'Putus sesi keluar yang mencurigakan',
      'Periksa kanal terenkripsi dan material kunci',
      'Tinjau kebijakan DLP dan retensi log'
    ],
    build(site, attackerIp) {
      return [event({
        assetId: `${site.code}-SRV-01`,
        zone: 'IT',
        source: attackerIp || '10.66.7.4',
        eventType: 'bulk_transfer',
        account: 'svc-backup'
      })];
    }
  }
];

function listMethods() {
  return threatMethods.map(({ build, ...meta }) => meta);
}

function findMethod(methodId) {
  return threatMethods.find((method) => method.id === methodId);
}

module.exports = { findMethod, listMethods, threatMethods };