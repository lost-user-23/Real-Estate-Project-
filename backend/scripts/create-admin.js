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

    const existing = await User.findOne({email});

    if(existing){
        if(existing.role === 'admin'){
            console.log("Already an admin");
        } else{
            await User.updateOne({_id: existing._id}, {role: 'admin'});
            console.log("User promoted to admin");
        }
    } else {
        const passwordHash = await hashPassword(password);
        await User.create({name,email,passwordHash, role:"admin"});
        console.log("Admin User created");
    }

    await disconnectFromDatabase();
}

main().catch(async (err)=>{
    console.log(err);
    await disconnectFromDatabase();
    process.exit(1);
});
