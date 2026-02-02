declare module "geoip-lite" {
  export interface Lookup {
    country: string;
    region?: string;
    city?: string;
    ll?: [number, number];
    timezone?: string;
    metro?: number;
    area?: number;
    eu?: string;
    range?: [number, number];
  }
  export function lookup(ip: string): Lookup | null;
}
