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
