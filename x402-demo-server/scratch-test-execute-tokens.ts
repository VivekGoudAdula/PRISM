import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });

import mongoose from 'mongoose';
import { TokenUsage } from './models/TokenUsage';

async function testTokenUsageDB() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/prism_app';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB Atlas');

  const count = await TokenUsage.countDocuments({});
  console.log(`Total TokenUsage documents in DB: ${count}`);

  const latestUsage = await TokenUsage.findOne({}).sort({ createdAt: -1 });
  if (latestUsage) {
    console.log('=== LATEST MONGODB TOKEN USAGE DOCUMENT ===');
    console.log(JSON.stringify(latestUsage.toObject(), null, 2));
  } else {
    console.log('No TokenUsage documents found yet.');
  }

  await mongoose.disconnect();
}

testTokenUsageDB();
