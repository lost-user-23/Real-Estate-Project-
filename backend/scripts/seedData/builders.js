const { normalizeCity } = require('../../src/utils/normalizeCity');

// Well-known developers per city. The builders directory is derived from
// published Projects grouped by `developer` (there is no Builder model), so
// seeding Projects is what makes /builders and the home-page builders
// section show data. Builder names are real; the project names, prices and
// possession dates below are invented demo data, not their actual projects.
const BUILDERS_BY_CITY = {
  Mumbai: { rate: 18000, builders: ['Lodha Group', 'Godrej Properties', 'Oberoi Realty', 'Hiranandani Communities', 'Rustomjee'] },
  'Delhi NCR': { rate: 9500, builders: ['DLF', 'M3M India', 'Godrej Properties', 'Tata Housing', 'Emaar India'] },
  Bengaluru: { rate: 11000, builders: ['Prestige Group', 'Sobha Limited', 'Brigade Group', 'Puravankara', 'Embassy Group'] },
  Pune: { rate: 8500, builders: ['Kolte-Patil Developers', 'Godrej Properties', 'Panchshil Realty', 'Gera Developments', 'Paranjape Schemes'] },
  Hyderabad: { rate: 7500, builders: ['My Home Group', 'Aparna Constructions', 'Prestige Group', 'Rajapushpa Properties', 'Sobha Limited'] },
  Chennai: { rate: 7000, builders: ['Casagrand', 'Appaswamy Real Estates', 'Prestige Group', 'Puravankara', 'Radiance Realty'] },
  Kolkata: { rate: 6000, builders: ['Merlin Group', 'Ambuja Neotia', 'Siddha Group', 'PS Group', 'Godrej Properties'] },
  Ahmedabad: { rate: 5500, builders: ['Adani Realty', 'Goyal & Co', 'Shivalik Group', 'Sun Builders Group', 'Safal Group'] },
  Kochi: { rate: 5000, builders: ['Skyline Builders', 'Asset Homes', 'Prestige Group', 'Tata Housing', 'Puravankara'] },
  Coimbatore: { rate: 4500, builders: ['Casagrand', 'Radiance Realty', 'Appaswamy Real Estates', 'Tata Housing', 'Prestige Group'] },
  Nagpur: { rate: 4000, builders: ['Godrej Properties', 'Tata Housing', 'Mahindra Lifespaces', 'Shapoorji Pallonji', 'Sun Builders Group'] },
  Jaipur: { rate: 5200, builders: ['Mahima Group', 'Omaxe', 'Mahindra Lifespaces', 'Godrej Properties', 'Tata Housing'] },
  Chandigarh: { rate: 7800, builders: ['Omaxe', 'Godrej Properties', 'DLF', 'Emaar India', 'Tata Housing'] },
};

const PROJECTS_PER_BUILDER = 2;
const NAME_SUFFIXES = ['Heights', 'Greens', 'Residency', 'Enclave', 'Towers', 'Park', 'Meadows', 'Skyline', 'Crest', 'Pavilion'];
const POSSESSION = ['Ready to move', 'Dec 2026', 'Jun 2027', 'Dec 2027', 'Mar 2028', 'Dec 2028'];

function brandWord(builder) {
  return builder.split(/[\s-]/)[0].replace(/[^A-Za-z]/g, '');
}

// `localitiesByCity` maps a city name to the localities already seeded for
// it, so each project sits in a locality that exists on the site.
function buildProjects(localitiesByCity, publishedAt = new Date()) {
  const projects = [];
  for (const [city, { rate, builders }] of Object.entries(BUILDERS_BY_CITY)) {
    const localities = localitiesByCity.get(city) || [];
    builders.forEach((developer, builderIndex) => {
      for (let n = 0; n < PROJECTS_PER_BUILDER; n += 1) {
        const pick = builderIndex * PROJECTS_PER_BUILDER + n;
        const name = `${brandWord(developer)} ${NAME_SUFFIXES[(pick + city.length) % NAME_SUFFIXES.length]}`;
        // Earlier builders in each list are the "premium" ones.
        const premium = 1.3 - builderIndex * 0.08;
        const startingPriceInRupees = Math.round((rate * (550 + n * 250) * premium) / 100000) * 100000;
        projects.push({
          name,
          developer,
          city,
          cityLower: normalizeCity(city),
          locality: localities.length > 0 ? localities[pick % localities.length] : null,
          imageUrl: `https://picsum.photos/seed/project-${normalizeCity(city).replace(/\s+/g, '-')}-${pick}/800/600`,
          imageAlt: `${name} by ${developer}`,
          startingPriceInRupees,
          possessionLabel: POSSESSION[pick % POSSESSION.length],
          status: 'published',
        });
      }
    });
  }
  return projects.map((project) => ({ ...project, publishedAt }));
}

module.exports = { BUILDERS_BY_CITY, buildProjects };
