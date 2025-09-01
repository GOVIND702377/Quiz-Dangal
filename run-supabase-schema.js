const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function runSchema() {
  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY // Use service role key for admin operations
    );

    console.log('🔄 Connecting to Supabase...');

    // Read the schema file
    const schemaSQL = fs.readFileSync('supabase-enhanced-schema.sql', 'utf8');
    
    console.log('📄 Schema file loaded, executing SQL...');

    // Execute the schema
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: schemaSQL 
    });

    if (error) {
      console.error('❌ Error executing schema:', error);
      return;
    }

    console.log('✅ Schema executed successfully!');
    console.log('📊 Result:', data);

    // Verify tables exist
    console.log('🔍 Verifying tables...');
    
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name, table_type')
      .eq('table_schema', 'public')
      .in('table_name', [
        'profiles', 
        'transactions', 
        'leaderboard_weekly', 
        'leaderboard_monthly', 
        'all_time_leaderboard',
        'daily_streaks',
        'coins_transactions',
        'referrals'
      ]);

    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError);
    } else {
      console.log('📋 Tables/Views found:');
      tables.forEach(table => {
        console.log(`  ✓ ${table.table_name} (${table.table_type})`);
      });
    }

    console.log('🎉 Database setup completed successfully!');

  } catch (error) {
    console.error('💥 Fatal error:', error);
  }
}

// Alternative method using direct SQL execution
async function runSchemaAlternative() {
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('🔄 Using alternative method...');

    // Split schema into individual statements
    const schemaSQL = fs.readFileSync('supabase-enhanced-schema.sql', 'utf8');
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📄 Found ${statements.length} SQL statements to execute`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.includes('SELECT ') && statement.includes('status')) {
        // Skip verification statements
        continue;
      }

      console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { 
          sql_query: statement + ';'
        });

        if (error) {
          console.warn(`⚠️  Warning on statement ${i + 1}:`, error.message);
        } else {
          console.log(`✅ Statement ${i + 1} completed`);
        }
      } catch (err) {
        console.warn(`⚠️  Error on statement ${i + 1}:`, err.message);
      }
    }

    console.log('🎉 Schema execution completed!');

  } catch (error) {
    console.error('💥 Fatal error:', error);
  }
}

// Run the schema
console.log('🚀 Starting Supabase schema setup...');
runSchema().catch(() => {
  console.log('🔄 Trying alternative method...');
  runSchemaAlternative();
});