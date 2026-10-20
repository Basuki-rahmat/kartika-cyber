const kodamSites = [
  { id: 'kodam-iskandar-muda', code: 'IM', name: 'Iskandar Muda', city: 'Banda Aceh', lat: 5.55, lng: 95.32, status: 'online', latency: 118, uptime: '99.98%', checked: '12 dtk lalu' },
  { id: 'kodam-i-bukit-barisan', code: 'I/BB', name: 'I / Bukit Barisan', city: 'Medan', lat: 3.59, lng: 98.67, status: 'online', latency: 142, uptime: '99.91%', checked: '18 dtk lalu' },
  { id: 'kodam-jaya', code: 'JY', name: 'Jaya', city: 'Jakarta', lat: -6.17, lng: 106.82, status: 'warning', latency: 864, uptime: '98.76%', checked: '7 dtk lalu' },
  { id: 'kodam-ii-sriwijaya', code: 'II/SW', name: 'II / Sriwijaya', city: 'Palembang', lat: -2.99, lng: 104.76, status: 'online', latency: 176, uptime: '99.84%', checked: '23 dtk lalu' },
  { id: 'kodam-iii-siliwangi', code: 'III/SLW', name: 'III / Siliwangi', city: 'Bandung', lat: -6.91, lng: 107.61, status: 'online', latency: 121, uptime: '99.96%', checked: '11 dtk lalu' },
  { id: 'kodam-iv-diponegoro', code: 'IV/DIP', name: 'IV / Diponegoro', city: 'Semarang', lat: -6.99, lng: 110.42, status: 'online', latency: 155, uptime: '99.89%', checked: '16 dtk lalu' },
  { id: 'kodam-v-brawijaya', code: 'V/BRW', name: 'V / Brawijaya', city: 'Surabaya', lat: -7.25, lng: 112.75, status: 'online', latency: 198, uptime: '99.73%', checked: '21 dtk lalu' },
  { id: 'kodam-ix-udayana', code: 'IX/UDY', name: 'IX / Udayana', city: 'Denpasar', lat: -8.65, lng: 115.22, status: 'online', latency: 213, uptime: '99.81%', checked: '14 dtk lalu' },
  { id: 'kodam-xii-tanjungpura', code: 'XII/TPR', name: 'XII / Tanjungpura', city: 'Pontianak', lat: -0.02, lng: 109.34, status: 'online', latency: 189, uptime: '99.92%', checked: '28 dtk lalu' },
  { id: 'kodam-xiii-merdeka', code: 'XIII/MDK', name: 'XIII / Merdeka', city: 'Manado', lat: 1.47, lng: 124.84, status: 'warning', latency: 711, uptime: '98.43%', checked: '9 dtk lalu' },
  { id: 'kodam-xiv-hasanuddin', code: 'XIV/HSN', name: 'XIV / Hasanuddin', city: 'Makassar', lat: -5.14, lng: 119.41, status: 'online', latency: 227, uptime: '99.86%', checked: '19 dtk lalu' },
  { id: 'kodam-xv-pattimura', code: 'XV/PTM', name: 'XV / Pattimura', city: 'Ambon', lat: -3.70, lng: 128.18, status: 'online', latency: 294, uptime: '99.69%', checked: '27 dtk lalu' },
  { id: 'kodam-xvii-cenderawasih', code: 'XVII/CEN', name: 'XVII / Cenderawasih', city: 'Jayapura', lat: -2.53, lng: 140.72, status: 'offline', latency: null, uptime: '96.12%', checked: '32 dtk lalu' },
  { id: 'kodam-xviii-kasuari', code: 'XVIII/KSR', name: 'XVIII / Kasuari', city: 'Manokwari', lat: -0.86, lng: 134.08, status: 'online', latency: 308, uptime: '99.37%', checked: '13 dtk lalu' },
  { id: 'kodam-xxiv-mandala-trikora', code: 'XXIV/MT', name: 'XXIV / Mandala Trikora', city: 'Merauke', lat: -8.49, lng: 140.40, status: 'online', latency: 346, uptime: '99.21%', checked: '25 dtk lalu' },
  { id: 'kodam-demo-nusantara', code: 'DEMO', name: 'Nusantara (demo)', city: 'Ibu Kota Nusantara', lat: -0.97, lng: 116.71, status: 'maintenance', latency: 403, uptime: '98.95%', checked: '5 dtk lalu' }
];

module.exports = { kodamSites };