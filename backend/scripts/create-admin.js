// Creates (or promotes) an admin user. Run with `npm run admin:create`.
// Required env vars: ADMIN_EMAIL, ADMIN_PASSWORD (min 8 chars, same as
// registration). Optional: ADMIN_NAME. Also needs MONGODB_URI /
// MONGODB_DB_NAME (see backend/.env.example) to reach the database.
require("dotenv").config();
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const User = require('../src/models/User');
const { hashPassword } = require('../src/services/auth.service');

// Matches the minimum enforced by POST /api/auth/register (see auth.controller.js).
const MIN_PASSWORD_LENGTH = 8;

// Returns a short outcome string. A new admin is created verified: the operator
// running this script vouches for the address. An existing account is promoted
// but its verification status is left alone, because an unverified account may
// have been registered by someone who does not own the inbox.
async function createOrPromoteAdmin({ email, password, name }) {
    const existing = await User.findOne({email});

    if(existing){
        if(existing.role !== 'admin'){
            await User.updateOne({_id: existing._id}, {role: 'admin'});
        }
        const status = existing.role === 'admin' ? "Already an admin" : "User promoted to admin";
        return existing.emailVerified
            ? status
            : `${status} (email NOT verified: this admin cannot log in or post until the verification link is used, which is also where the password is set; ADMIN_PASSWORD was not applied)`;
    }

    const passwordHash = await hashPassword(password);
    await User.create({name,email,passwordHash, role:"admin", emailVerified: true});
    return "Admin User created";
}

async function main(){
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME || "Admin";

    if(!email || !password) {
        console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD before running");
        process.exit(1);
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
        console.error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`);
        process.exit(1);
    }
    await connectToDatabase();

    console.log(await createOrPromoteAdmin({ email, password, name }));

    await disconnectFromDatabase();
}

if (require.main === module) {
    main().catch(async (err)=>{
        console.log(err);
        await disconnectFromDatabase();
        process.exit(1);
    });
}

module.exports = { createOrPromoteAdmin };
