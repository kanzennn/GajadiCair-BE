export function toGeographyPoint(longitude: number, latitude: number) {
  // POINT(lng lat) + SRID 4326 -> geography
  return `ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography`;
}
