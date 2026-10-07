const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const { Property, PropertyImage } = require('../src/models');

// Usage: node scripts/seed-featured.js
// Upserts a handful of published, featured listings with 5 photos each
// (Unsplash home photos, host allowed in frontend/next.config.js). Safe to rerun.
const photo = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

const LISTINGS = [
  {
    slug: 'featured-luxury-villa-bandra-west',
    title: '4 BHK Luxury Villa in Bandra West',
    intent: 'buy', propertyType: 'villa', bhk: 4, bathrooms: 5, balconies: 3, floor: 0,
    areaSqft: 3800, priceInRupees: 185000000, city: 'Mumbai', locality: 'Bandra West',
    furnished: 'furnished', facing: 'west', yearOfConstruction: 2019, isLuxury: true,
    amenities: ['Swimming Pool', 'Garden/Park', 'Gym', 'Parking', '24x7 Security'],
    photos: ['1613490493576-7fde63acd811', '1600585154340-be6161a56a0c', '1600607687939-ce8a6c25118c', '1560448204-e02f11c3d0e2', '1556912172-45b7abe8b7e1'],
  },
  {
    slug: 'featured-sea-view-apartment-worli',
    title: '3 BHK Sea-View Apartment in Worli',
    intent: 'buy', propertyType: 'apartment', bhk: 3, bathrooms: 3, balconies: 2, floor: 24,
    areaSqft: 1850, priceInRupees: 95000000, city: 'Mumbai', locality: 'Worli',
    furnished: 'semi-furnished', facing: 'west', yearOfConstruction: 2021, isLuxury: true,
    amenities: ['Gym', 'Swimming Pool', 'Lift', 'Parking', 'Clubhouse'],
    photos: ['1512917774080-9991f1c4c750', '1502672260266-1c1ef2d93688', '1493809842364-78817add7ffb', '1484154218962-a197022b5858', '1556909114-f6e7ad7d3136'],
  },
  {
    slug: 'featured-independent-house-koramangala',
    title: '4 BHK Independent House in Koramangala',
    intent: 'buy', propertyType: 'independent-house', bhk: 4, bathrooms: 4, balconies: 2, floor: 0,
    areaSqft: 2800, priceInRupees: 72000000, city: 'Bengaluru', locality: 'Koramangala',
    furnished: 'unfurnished', facing: 'east', yearOfConstruction: 2016, isLuxury: false,
    amenities: ['Garden/Park', 'Parking', 'Power Backup'],
    photos: ['1564013799919-ab600027ffc6', '1570129477492-45c003edd2be', '1522708323590-d24dbb6b0267', '1560448204-e02f11c3d0e2', '1556912172-45b7abe8b7e1'],
  },
  {
    slug: 'featured-modern-apartment-hitech-city',
    title: '3 BHK Modern Apartment near HITEC City',
    intent: 'rent', propertyType: 'apartment', bhk: 3, bathrooms: 3, balconies: 2, floor: 12,
    areaSqft: 1600, priceInRupees: 55000, city: 'Hyderabad', locality: 'HITEC City',
    furnished: 'furnished', facing: 'north', yearOfConstruction: 2020, isLuxury: false,
    amenities: ['Gym', 'Lift', 'Parking', 'Clubhouse', '24x7 Security'],
    photos: ['1568605114967-8130f3a36994', '1502672260266-1c1ef2d93688', '1493809842364-78817add7ffb', '1484154218962-a197022b5858', '1556909114-f6e7ad7d3136'],
  },
  {
    slug: 'featured-family-villa-sector-50-gurugram',
    title: '5 BHK Family Villa in Sector 50, Gurugram',
    intent: 'buy', propertyType: 'villa', bhk: 5, bathrooms: 5, balconies: 3, floor: 0,
    areaSqft: 4500, priceInRupees: 140000000, city: 'Delhi NCR', locality: 'Sector 50, Gurugram',
    furnished: 'semi-furnished', facing: 'north-east', yearOfConstruction: 2018, isLuxury: true,
    amenities: ['Swimming Pool', 'Garden/Park', 'Parking', 'Power Backup', '24x7 Security'],
    photos: ['1600596542815-ffad4c1539a9', '1600566753190-17f0baa2a6c3', '1600047509807-ba8f99d2cdde', '1560448204-e02f11c3d0e2', '1556912172-45b7abe8b7e1'],
  },
  {
    slug: 'featured-garden-home-koregaon-park-pune',
    title: '3 BHK Garden Home in Koregaon Park',
    intent: 'rent', propertyType: 'independent-house', bhk: 3, bathrooms: 3, balconies: 2, floor: 0,
    areaSqft: 2100, priceInRupees: 85000, city: 'Pune', locality: 'Koregaon Park',
    furnished: 'furnished', facing: 'south', yearOfConstruction: 2015, isLuxury: false,
    amenities: ['Garden/Park', 'Parking', 'Power Backup'],
    photos: ['1580587771525-78b9dba3b914', '1599809275671-b5942cabc7a2', '1522708323590-d24dbb6b0267', '1484154218962-a197022b5858', '1556909114-f6e7ad7d3136'],
  },
];

async function main() {
  await connectToDatabase();
  try {
    let rank = 1;
    for (const { photos, ...listing } of LISTINGS) {
      const doc = {
        ...listing,
        cityLower: listing.city.trim().toLowerCase(),
        description: `${listing.title}. Well-maintained home in a sought-after neighbourhood, ready to move in.`,
        contactNumber: '+91 98765 43210',
        ownerId: null, verified: true, featured: true, featuredRank: rank++, status: 'published',
      };
      const property = await Property.findOneAndUpdate(
        { slug: doc.slug },
        { $set: doc, $setOnInsert: { publishedAt: new Date() } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
      await PropertyImage.deleteMany({ propertyId: property._id });
      await PropertyImage.insertMany(
        photos.map((id, i) => ({ propertyId: property._id, url: photo(id), alt: `${doc.title} - photo ${i + 1}`, displayOrder: i }))
      );
      console.log(`[seed-featured] ${doc.slug}`);
    }
  } finally {
    await disconnectFromDatabase();
  }
}

main().catch((error) => {
  console.error(`[seed-featured] ${error.message}`);
  process.exitCode = 1;
});
