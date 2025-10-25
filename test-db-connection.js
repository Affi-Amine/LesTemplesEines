// Test script to verify database connection and explore tables
const { createClient } = require('@supabase/supabase-js')

async function testDatabaseConnection() {
  try {
    console.log('Testing database connection...')
    
    const supabaseUrl = 'https://vihcjaebkbcdfbwjxqbd.supabase.co'
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpaGNqYWVia2JjZGZid2p4cWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNzg5MTcsImV4cCI6MjA3Njk1NDkxN30.hdcPmJHN6QJGbEIfG1t33tIFi7u3e_jTckXNhHKosck'
    
    console.log('✅ Environment variables found')
    console.log('Supabase URL:', supabaseUrl)
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Test different possible table names
    const tablesToTest = ['staff', 'users', 'admins', 'employees', 'team_members']
    
    for (const tableName of tablesToTest) {
      console.log(`\n--- Testing table: ${tableName} ---`)
      
      try {
        const { data, error } = await supabase.from(tableName).select('*').limit(5)
        
        if (error) {
          console.log(`❌ Error accessing ${tableName}:`, error.message)
        } else {
          console.log(`✅ ${tableName} table exists with ${data.length} records`)
          if (data.length > 0) {
            console.log('Sample data:', JSON.stringify(data[0], null, 2))
          }
        }
      } catch (err) {
        console.log(`❌ Exception accessing ${tableName}:`, err.message)
      }
    }
    
    // Try to get schema information
    console.log('\n--- Attempting to get table schema ---')
    try {
      const { data: schemaData, error: schemaError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
      
      if (!schemaError && schemaData) {
        console.log('Available tables:', schemaData.map(t => t.table_name))
      } else {
        console.log('Could not retrieve schema information')
      }
    } catch (err) {
      console.log('Schema query not available with current permissions')
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

testDatabaseConnection();