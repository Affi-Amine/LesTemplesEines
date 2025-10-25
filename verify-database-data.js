// Comprehensive script to verify all database data retrieval
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration with service role key
const supabaseUrl = 'https://vihcjaebkbcdfbwjxqbd.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpaGNqYWVia2JjZGZid2p4cWJkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTM3ODkxNywiZXhwIjoyMDc2OTU0OTE3fQ.ji2sV8U-lCYVBhaU_BZzGoLfUivYz9aCV6y4DfhIeDw';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyDatabaseData() {
  try {
    console.log('🔍 Verifying database data retrieval...\n');
    
    // Test 1: Retrieve all staff data
    console.log('📋 1. STAFF DATA VERIFICATION');
    console.log('=' .repeat(50));
    
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (staffError) {
      console.error('❌ Error fetching staff data:', staffError);
    } else {
      console.log(`✅ Successfully retrieved ${staffData.length} staff members:`);
      staffData.forEach((staff, index) => {
        console.log(`\n${index + 1}. Staff Member:`);
        console.log(`   ID: ${staff.id}`);
        console.log(`   Email: ${staff.email}`);
        console.log(`   Name: ${staff.first_name} ${staff.last_name}`);
        console.log(`   Role: ${staff.role}`);
        console.log(`   Salon ID: ${staff.salon_id}`);
        console.log(`   Password Hash: ${staff.password_hash.substring(0, 20)}...`);
        console.log(`   Active: ${staff.is_active}`);
        console.log(`   Created: ${staff.created_at}`);
      });
    }
    
    // Test 2: Retrieve all salon data
    console.log('\n\n🏢 2. SALON DATA VERIFICATION');
    console.log('=' .repeat(50));
    
    const { data: salonData, error: salonError } = await supabase
      .from('salons')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (salonError) {
      console.error('❌ Error fetching salon data:', salonError);
    } else {
      console.log(`✅ Successfully retrieved ${salonData.length} salons:`);
      salonData.forEach((salon, index) => {
        console.log(`\n${index + 1}. Salon:`);
        console.log(`   ID: ${salon.id}`);
        console.log(`   Name: ${salon.name}`);
        console.log(`   Slug: ${salon.slug}`);
        console.log(`   City: ${salon.city}`);
        console.log(`   Address: ${salon.address}`);
        console.log(`   Phone: ${salon.phone}`);
        console.log(`   Email: ${salon.email}`);
        console.log(`   Active: ${salon.is_active}`);
        console.log(`   Opening Hours:`, JSON.stringify(salon.opening_hours, null, 2));
        console.log(`   Created: ${salon.created_at}`);
      });
    }
    
    // Test 3: Test specific queries that the application might use
    console.log('\n\n🔧 3. APPLICATION QUERY TESTS');
    console.log('=' .repeat(50));
    
    // Test login query for specific user
    console.log('\n🔐 Testing login query for test@lestemples.fr:');
    const { data: loginTestData, error: loginTestError } = await supabase
      .from('staff')
      .select('*')
      .eq('email', 'test@lestemples.fr');
    
    if (loginTestError) {
      console.error('❌ Login query error:', loginTestError);
    } else {
      console.log(`✅ Login query successful: Found ${loginTestData.length} user(s)`);
      if (loginTestData.length > 0) {
        const user = loginTestData[0];
        console.log(`   User: ${user.first_name} ${user.last_name} (${user.email})`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Has password hash: ${!!user.password_hash}`);
      }
    }
    
    // Test salon query by slug
    console.log('\n🏢 Testing salon query by slug (temple-paris):');
    const { data: salonBySlugData, error: salonBySlugError } = await supabase
      .from('salons')
      .select('*')
      .eq('slug', 'temple-paris')
      .single();
    
    if (salonBySlugError) {
      console.error('❌ Salon by slug query error:', salonBySlugError);
    } else {
      console.log('✅ Salon by slug query successful:');
      console.log(`   Salon: ${salonBySlugData.name}`);
      console.log(`   City: ${salonBySlugData.city}`);
      console.log(`   Active: ${salonBySlugData.is_active}`);
    }
    
    // Test 4: Check other important tables
    console.log('\n\n📊 4. OTHER TABLES VERIFICATION');
    console.log('=' .repeat(50));
    
    const tablesToCheck = ['services', 'clients', 'appointments', 'staff_availability'];
    
    for (const tableName of tablesToCheck) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          console.log(`❌ Table '${tableName}': Error - ${error.message}`);
        } else {
          console.log(`✅ Table '${tableName}': Accessible (${data?.length || 0} records)`);
        }
      } catch (err) {
        console.log(`❌ Table '${tableName}': Exception - ${err.message}`);
      }
    }
    
    // Test 5: Raw JSON output for comparison
    console.log('\n\n📄 5. RAW JSON DATA FOR COMPARISON');
    console.log('=' .repeat(50));
    
    console.log('\n🔹 Staff Data (JSON):');
    console.log(JSON.stringify(staffData, null, 2));
    
    console.log('\n🔹 Salon Data (JSON):');
    console.log(JSON.stringify(salonData, null, 2));
    
    console.log('\n\n🎉 Database verification complete!');
    
  } catch (error) {
    console.error('💥 Unexpected error during verification:', error);
  }
}

verifyDatabaseData();