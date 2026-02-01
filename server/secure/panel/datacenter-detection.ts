// Détection de datacenter
// Vérifie si une IP provient d'un datacenter

export interface DatacenterResult {
  isDatacenter: boolean;
  org?: string;
  isp?: string;
  asn?: string;
  confidence: number;
}

// IPs connues comme datacenter (détectées par beta2 ou manuellement). Toujours bloquées même si les APIs échouent.
const KNOWN_DATACENTER_IPS = new Set<string>([
  "121.127.43.194", // DataCamp Limited (MX) - détecté comme datacenter dans beta2
]);

// Organisations / ISP à bloquer (datacenters, hébergeurs). Comparaison insensible à la casse sur org/isp.
const DATACENTER_ORGS = [
  "datacamp limited", "datacamp",
  "amazon", "aws", "ec2", "amazon web services",
  "google cloud", "google llc", "google",
  "cloudflare", "microsoft", "azure",
  "digitalocean", "digital ocean", "linode", "akamai",
  "vultr", "choopa", "ovh", "ovhcloud", "hetzner",
  "alibaba", "aliyun", "oracle", "ibm", "softlayer", "rackspace",
  "scaleway", "upcloud", "kamatera", "contabo", "hostinger",
  "hostgator", "godaddy", "bluehost", "dreamhost", "namecheap",
  "ionos", "1&1", "leaseweb", "serverius", "quadranet", "colocrossing",
  "psychz", "serverroom", "buyvm", "frantech",
  "ramnode", "nocix", "hostwinds", "interserver",
  "censys", "shodan", "binaryedge", "shadowserver", "rapid7",
  "qualys", "tenable", "nessus", "securitytrails", "riskiq",
  "palo alto", "cortex", "recorded future", "greynoise",
  "ipip.net", "internet measurement", "zscaler", "forcepoint",
  "netcraft", "spamhaus", "tencent", "huawei",
  "aruba", "arubacloud", "netcup", "strato", "1blu", "eweka", "transip",
  "inmotion", "a2hosting", "siteground", "wp engine", "kinsta", "cloudways",
  "liquid web", "servercentral", "coreweave", "runpod", "vast.ai", "paperspace",
  "lambda labs", "fluidstack", "flexential", "cyxtera", "equinix",
  "digital realty", "qts", "core site", "stream data", "bulk internet",
  "bulk network", "host royale", "web hosting", "dedicated hosting",
  "reseller hosting", "vps provider", "cloud provider",
];

// ASN connus pour les datacenters (cloud, VPS, hébergeurs). Blocage si match.
const DATACENTER_ASNS = [
  "AS13335", "AS15169", "AS16509", "AS8075", "AS32934",
  "AS20940", "AS16625", "AS20057", "AS14061", "AS16276",
  "AS24940", "AS20473", "AS63949", "AS14618", "AS45102",
  "AS37963", "AS36352", "AS46562", "AS40676", "AS29802",
  "AS62567", "AS396982", "AS398324", "AS398722", "AS395747",
  "AS174", "AS398101", "AS50613", "AS202425", "AS6939",
  "AS53667", "AS35916", "AS32097", "AS30633", "AS60729",
  "AS51167", "AS212238", "AS9009", "AS60068", "AS213035", "AS19905",
  "AS31898", "AS7979", "AS8100", "AS13739", "AS6724", "AS8972",
  "AS13213", "AS9370", "AS7506", "AS12876", "AS46606", "AS204428",
];

/** Normalise l'ASN depuis ip-api.com ("AS12345 Org") ou chaîne directe */
function normalizeAsn(as: string): string {
  if (!as || typeof as !== "string") return "";
  const trimmed = as.trim();
  return trimmed.startsWith("AS") ? trimmed.split(" ")[0] ?? trimmed : trimmed;
}

/**
 * Vérifie si une IP provient d'un datacenter.
 * Comme beta2 : ip-api.com en premier avec champs hosting/proxy, puis ipapi.co en fallback.
 */
export async function isDatacenterIP(ip: string): Promise<DatacenterResult> {
  const result: DatacenterResult = {
    isDatacenter: false,
    confidence: 0,
  };

  // Liste d’IPs connues (comme beta2) : toujours datacenter même si les APIs ne répondent pas
  if (KNOWN_DATACENTER_IPS.has(ip)) {
    result.isDatacenter = true;
    result.confidence = 100;
    result.org = "Known datacenter IP (list)";
    return result;
  }

  const opts = { headers: { "User-Agent": "Mozilla/5.0" } };
  const ipApiComFields = "status,org,isp,as,hosting,proxy";

  // 1) ip-api.com : essayer HTTP (gratuit) puis HTTPS en cas d'échec
  const ipApiComUrls = [
    `http://ip-api.com/json/${ip}?fields=${ipApiComFields}`,
    `https://ip-api.com/json/${ip}?fields=${ipApiComFields}`,
  ];
  for (const url of ipApiComUrls) {
    try {
      const res = await fetch(url, opts);
      if (res.ok) {
        const data = (await res.json()) as {
          status?: string;
          org?: string;
          isp?: string;
          as?: string;
          hosting?: boolean;
          proxy?: boolean;
        };
        if (data.status === "success") {
          const rawOrg = (data.org ?? "") as string;
          const rawIsp = (data.isp ?? rawOrg) as string;
          const asn = normalizeAsn((data.as ?? "") as string);
          result.org = rawOrg || undefined;
          result.isp = rawIsp || undefined;
          result.asn = asn || undefined;
          if (data.hosting === true) {
            result.isDatacenter = true;
            result.confidence = 95;
            return result;
          }
          if (data.proxy === true) {
            result.isDatacenter = true;
            result.confidence = 85;
            return result;
          }
          applyDatacenterRules(result, rawOrg, rawIsp, asn);
          if (result.isDatacenter) return result;
          return result;
        }
      }
    } catch (error) {
      // Essayer l'autre schéma (HTTP ou HTTPS)
      continue;
    }
  }

  // 2) Fallback ipapi.co
  try {
    const response = await fetch(`https://ipapi.co/${ip}/json/`, opts);
    if (response.ok) {
      const data = (await response.json()) as Record<string, unknown>;
      if ((data as { error?: boolean }).error !== true) {
        const rawOrg =
          (data.org ?? data.organisation ?? data.organization ?? "") as string;
        const rawIsp = (data.isp ?? data.isp_name ?? rawOrg) as string;
        const asn =
          typeof data.asn === "string"
            ? data.asn
            : String((data.asn as { asn?: string; number?: string })?.asn ?? (data.asn as { asn?: string; number?: string })?.number ?? "");
        applyDatacenterRules(result, rawOrg, rawIsp, asn);
      }
    }
  } catch (error) {
    console.error("[Datacenter Detection] ipapi.co error:", error);
  }

  return result;
}

/**
 * Applique les règles datacenter sur org/isp/asn et remplit result.
 * Utilisé par isDatacenterIP et datacenterFromApiData.
 */
function applyDatacenterRules(
  result: DatacenterResult,
  rawOrg: string,
  rawIsp: string,
  asn: string
): void {
  const org = rawOrg.toLowerCase();
  const isp = rawIsp.toLowerCase();
  result.org = rawOrg || undefined;
  result.isp = rawIsp || undefined;
  result.asn = asn || undefined;

  if (DATACENTER_ORGS.some((dc) => org.includes(dc) || isp.includes(dc))) {
    result.isDatacenter = true;
    result.confidence = 90;
    return;
  }
  if (DATACENTER_ASNS.some((dcAsn) => asn.includes(dcAsn))) {
    result.isDatacenter = true;
    result.confidence = 95;
    return;
  }
  const datacenterKeywords = [
    "hosting",
    "datacenter",
    "data center",
    "server",
    "cloud",
    "colo",
    "colocation",
    "vps",
    "dedicated server",
    "host ",
    " host",
    "hosting provider",
    "cloud provider",
    "network services",
    "backbone",
    "transit",
    "noc ",
    " noc",
    "bulk ",
    "reseller",
    "web host",
    "hosting ltd",
    "hosting limited",
    "hosting llc",
    "hosting gmbh",
    "hosting b.v",
    "asn ",
    "hosting inc",
    "hosting corp",
  ];
  const combined = `${org} ${isp}`;
  if (datacenterKeywords.some((k) => combined.includes(k))) {
    result.isDatacenter = true;
    result.confidence = 70;
  }
}

/**
 * Calcule le résultat datacenter à partir des données brutes (ipapi.co ou ip-api.com).
 * Supporte hosting/proxy (ip-api.com) et champ "as" pour l'ASN.
 */
export function datacenterFromApiData(data: Record<string, unknown>): DatacenterResult {
  const result: DatacenterResult = {
    isDatacenter: false,
    confidence: 0,
  };
  if ((data as { error?: boolean }).error === true) return result;

  const rawOrg =
    (data.org ?? data.organisation ?? data.organization ?? "") as string;
  const rawIsp = (data.isp ?? data.isp_name ?? rawOrg) as string;
  const asnFromAsn =
    typeof data.asn === "string"
      ? data.asn
      : String((data.asn as { asn?: string; number?: string })?.asn ?? (data.asn as { asn?: string; number?: string })?.number ?? "");
  const asnFromAs = normalizeAsn((data.as ?? "") as string);
  const asn = asnFromAsn || asnFromAs;

  result.org = rawOrg || undefined;
  result.isp = rawIsp || undefined;
  result.asn = asn || undefined;

  if ((data as { hosting?: boolean }).hosting === true) {
    result.isDatacenter = true;
    result.confidence = 95;
    return result;
  }
  if ((data as { proxy?: boolean }).proxy === true) {
    result.isDatacenter = true;
    result.confidence = 85;
    return result;
  }

  applyDatacenterRules(result, rawOrg, rawIsp, asn);
  return result;
}
