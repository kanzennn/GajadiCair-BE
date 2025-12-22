export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function timeOnly(date = new Date()) {
  // TIME but Prisma still wants Date object
  const t = new Date(date);
  t.setFullYear(1970, 0, 1); // biar konsisten, tanggal dummy
  return t;
}

export function timeToMinutesFromDb(t: Date) {
  // t biasanya 1970-01-01Txx:yy:00.000Z (UTC dummy)
  // Ambil jam/menit dari UTC supaya stabil
  return t.getUTCHours() * 60 + t.getUTCMinutes();
}

export function nowMinutesJakarta(now = new Date()) {
  // ambil jam/menit Jakarta tanpa library:
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hh * 60 + mm;
}
