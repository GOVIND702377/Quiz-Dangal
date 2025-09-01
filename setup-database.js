// Simple Database Setup Script
// Run this with: node setup-database.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function setupDatabase() {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );

  console.log('🔄 Setting up database...');

  try {
    // Test connection
    const { data: testData, error: testError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);

    if (testError) {
      console.error('❌ Connection failed:', testError.message);
      return;
    }

    console.log('✅ Connected to Supabase successfully!');

    // Check existing tables
    console.log('🔍 Checking existing tables...');
    
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, total_coins, wallet_balance')
      .limit(1);

    console.log('📊 Sample profile data:', profiles);

    // Check if transactions view exists
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .limit(1);

    if (transactions) {
      console.log('✅ Transactions view exists');
    }

    // Check leaderboard views
    const { data: leaderboard } = await supabase
      .from('leaderboard_weekly')
      .select('*')
      .limit(1);

    if (leaderboard) {
      console.log('✅ Leaderboard views exist');
    }

    console.log('🎉 Database check completed!');
    console.log('📝 If you see errors above, please run the SQL schema manually in Supabase dashboard');

  } catch (error) {
    console.error('💥 Error:', error.message);
    console.log('📝 Please run the SQL schema manually in Supabase dashboard');
  }
}

setupDatabase();