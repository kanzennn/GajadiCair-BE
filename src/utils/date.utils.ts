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

export function ceilDaysLeft(expiresAt: Date, now: Date) {
  const ms = expiresAt.getTime() - now.getTime();
  return Math.ceil(ms / 86400000);
}

export function addMonthsSafe(date: Date, months: number) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

export function monthsRemainingCeil(now: Date, expiresAt: Date) {
  if (expiresAt <= now) return 0;

  // hitung selisih bulan kalender (kasar tapi konsisten untuk billing monthly)
  const y = expiresAt.getUTCFullYear() - now.getUTCFullYear();
  const m = expiresAt.getUTCMonth() - now.getUTCMonth();
  let months = y * 12 + m;

  // kalau masih ada sisa hari/jam, anggap 1 bulan lagi
  const anchor = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + months,
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
    ),
  );
  if (anchor < expiresAt) months += 1;

  return Math.max(1, months);
}

export function daysLeftCeil(expiresAt: Date, now: Date) {
  const ms = expiresAt.getTime() - now.getTime();
  return Math.ceil(ms / 86400000);
}
