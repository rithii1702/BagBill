import mongoose from 'mongoose';
import dns from 'dns';

// Use 8.8.8.8 for reliable MongoDB Atlas SRV DNS resolution
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
  try {
    const connUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bagbill';
    const conn = await mongoose.connect(connUri);
    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
