// Writes synthetic listings for extra cities into ../../DataSet as CSVs in the
// same column layout as Mumbai_property_details.csv. Deterministic (seeded
// PRNG), so reruns produce identical files.
//
// Usage: node scripts/seedData/generateCityDatasets.js
const fs = require('fs');
const path = require('path');

const DATASET_DIR = path.resolve(__dirname, '../../../DataSet');
const ROWS_PER_CITY = 600;

const HEADER = [
  'Title', 'Price', 'Area', 'BHK', 'Bathrooms', 'Furnished', 'Balconies', 'Floor', 'Ownership', 'Facing',
  'Amenities', 'Transaction Type', 'Property Type', 'Location', 'Year of Construction', 'Is Luxury',
  'Description', 'Property Image',
];

// ratePerSqft mirrors frontend/src/lib/cityRates.js.
const CITIES = [
  { name: 'Delhi NCR', file: 'Delhi_NCR_property_details.csv', ratePerSqft: 9500,
    localities: ['Dwarka', 'Rohini', 'Vasant Kunj', 'Saket', 'Noida Sector 62', 'Gurgaon Sector 56', 'Greater Noida West', 'Indirapuram', 'Janakpuri', 'Lajpat Nagar'] },
  { name: 'Bengaluru', file: 'Bengaluru_property_details.csv', ratePerSqft: 11000,
    localities: ['Whitefield', 'Koramangala', 'Indiranagar', 'HSR Layout', 'Electronic City', 'Sarjapur Road', 'Hebbal', 'JP Nagar', 'Marathahalli', 'Yelahanka'] },
  { name: 'Pune', file: 'Pune_property_details.csv', ratePerSqft: 8500,
    localities: ['Hinjewadi', 'Kharadi', 'Baner', 'Wakad', 'Viman Nagar', 'Hadapsar', 'Kothrud', 'Pimple Saudagar', 'Aundh', 'Magarpatta'] },
  { name: 'Hyderabad', file: 'Hyderabad_property_details.csv', ratePerSqft: 7500,
    localities: ['Gachibowli', 'Madhapur', 'Kondapur', 'Kukatpally', 'Banjara Hills', 'Jubilee Hills', 'Miyapur', 'Manikonda', 'Financial District', 'Tellapur'] },
  { name: 'Chennai', file: 'Chennai_property_details.csv', ratePerSqft: 7000,
    localities: ['Adyar', 'Velachery', 'OMR', 'Anna Nagar', 'T Nagar', 'Porur', 'Tambaram', 'Perungudi', 'Sholinganallur', 'Medavakkam'] },
  { name: 'Kolkata', file: 'Kolkata_property_details.csv', ratePerSqft: 6000,
    localities: ['Salt Lake', 'New Town', 'Ballygunge', 'Behala', 'Garia', 'Dum Dum', 'Tollygunge', 'Rajarhat', 'Howrah', 'Jadavpur'] },
  { name: 'Ahmedabad', file: 'Ahmedabad_property_details.csv', ratePerSqft: 5500,
    localities: ['Satellite', 'Bopal', 'Prahlad Nagar', 'Thaltej', 'Gota', 'Maninagar', 'Vastrapur', 'Chandkheda', 'Sarkhej', 'Navrangpura'] },
  { name: 'Kochi', file: 'Kochi_property_details.csv', ratePerSqft: 5000,
    localities: ['Kakkanad', 'Edappally', 'Vyttila', 'Marine Drive', 'Panampilly Nagar', 'Aluva', 'Thrippunithura', 'Palarivattom', 'Kaloor', 'Fort Kochi'] },
  { name: 'Coimbatore', file: 'Coimbatore_property_details.csv', ratePerSqft: 4500,
    localities: ['RS Puram', 'Saibaba Colony', 'Peelamedu', 'Singanallur', 'Saravanampatti', 'Vadavalli', 'Race Course', 'Ganapathy', 'Kuniyamuthur', 'Thudiyalur'] },
  { name: 'Nagpur', file: 'Nagpur_property_details.csv', ratePerSqft: 4000,
    localities: ['Dharampeth', 'Manish Nagar', 'Wardha Road', 'Besa', 'Sitabuldi', 'Mihan', 'Pratap Nagar', 'Hingna', 'Trimurti Nagar', 'Civil Lines'] },
  { name: 'Jaipur', file: 'Jaipur_property_details.csv', ratePerSqft: 5200,
    localities: ['Malviya Nagar', 'Vaishali Nagar', 'Mansarovar', 'C Scheme', 'Jagatpura', 'Tonk Road', 'Ajmer Road', 'Sirsi Road', 'Bani Park', 'Sodala'] },
  { name: 'Chandigarh', file: 'Chandigarh_property_details.csv', ratePerSqft: 7800,
    localities: ['Sector 17', 'Sector 22', 'Sector 35', 'Manimajra', 'Zirakpur', 'Mohali Phase 7', 'Panchkula Sector 5', 'Sector 44', 'Kharar', 'Sector 8'] },
];

const TYPES = [
  { label: 'Apartment', title: 'Multistorey Apartment', weight: 50, multiplier: 1 },
  { label: 'Apartment', title: 'Builder Floor Apartment', weight: 12, multiplier: 0.95 },
  { label: 'Studio Apartment', title: 'Studio Apartment', weight: 8, multiplier: 0.9 },
  { label: 'Residential House', title: 'Independent House', weight: 12, multiplier: 1.05 },
  { label: 'Villa', title: 'Villa', weight: 12, multiplier: 1.15 },
  { label: 'Penthouse', title: 'Penthouse', weight: 6, multiplier: 1.4 },
];

const AMENITIES = ['Main Road', 'Garden/Park', 'Pool', 'Gym', 'Parking', 'Lift', 'Security', 'Club House', 'Power Backup'];
const FACINGS = ['North', 'South', 'East', 'West', 'North - East', 'North - West', 'South - East', 'South - West'];
const FURNISHED = ['Furnished', 'Semi-Furnished', 'Unfurnished'];
const OWNERSHIP = ['Freehold', 'Leasehold', 'Co-operative Society', 'Power Of Attorney'];

// mulberry32
function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function formatPrice(rupees) {
  if (rupees >= 10000000) return `${(rupees / 10000000).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  if (rupees >= 100000) return `${(rupees / 100000).toFixed(2).replace(/\.?0+$/, '')} Lac`;
  return rupees.toLocaleString('en-US');
}

function csvField(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function generateCity(city) {
  const rng = createRng(hashString(city.name));
  const pick = (list) => list[Math.floor(rng() * list.length)];
  const int = (min, max) => min + Math.floor(rng() * (max - min + 1));
  const totalWeight = TYPES.reduce((sum, t) => sum + t.weight, 0);
  const pickType = () => {
    let roll = rng() * totalWeight;
    for (const t of TYPES) {
      roll -= t.weight;
      if (roll <= 0) return t;
    }
    return TYPES[0];
  };

  const rows = [];
  for (let i = 0; i < ROWS_PER_CITY; i += 1) {
    const type = pickType();
    const isStudio = type.label === 'Studio Apartment';
    const bhk = isStudio ? 1 : type.label === 'Villa' || type.label === 'Penthouse' ? int(3, 5) : int(1, 4);
    const area = isStudio ? int(300, 550) : Math.round((bhk * int(380, 520) + int(0, 150)) / 5) * 5;
    const locality = pick(city.localities);
    const sale = rng() < 0.55;
    const localityFactor = 0.8 + rng() * 0.6;
    const salePrice = area * city.ratePerSqft * type.multiplier * localityFactor;
    // Monthly rent is roughly 0.28% of the sale value.
    const rupees = sale ? Math.round(salePrice / 10000) * 10000 : Math.round((salePrice * 0.0028) / 500) * 500;
    const transaction = sale ? 'Sale' : 'Rent';
    const price = formatPrice(rupees);
    const amenities = [...new Set(Array.from({ length: int(1, 4) }, () => pick(AMENITIES)))].join(', ');
    const luxury = type.multiplier >= 1.4 || (rupees > 30000000 && sale);
    const title = `${bhk}BHK ${type.title} for ${transaction === 'Sale' ? 'Sale' : 'Rent'} in ${locality}`;
    rows.push([
      title,
      price,
      `${area} ${int(5000, 15000)}`,
      bhk,
      Math.max(1, Math.min(bhk, int(bhk - 1, bhk + 1))),
      pick(FURNISHED),
      int(0, 3) || '',
      type.label === 'Apartment' || isStudio || type.label === 'Penthouse' ? int(1, 25) : int(0, 2),
      rng() < 0.7 ? pick(OWNERSHIP) : '',
      pick(FACINGS),
      amenities,
      transaction,
      type.label,
      city.name,
      rng() < 0.85 ? int(1995, 2025) : '',
      luxury ? 'T' : 'F',
      `${bhk} BHK, ${type.title} is available for ${transaction} in ${locality}, ${city.name} for ${price}`,
      // The seed turns this into picsum image URLs; the name just has to be unique.
      `${city.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${i + 1}.jpg`,
    ]);
  }
  return rows;
}

for (const city of CITIES) {
  const lines = [HEADER.join(','), ...generateCity(city).map((row) => row.map(csvField).join(','))];
  fs.writeFileSync(path.join(DATASET_DIR, city.file), `${lines.join('\n')}\n`);
  console.log(`wrote ${city.file} (${ROWS_PER_CITY} rows)`);
}
