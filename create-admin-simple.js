// Simple script to generate SQL for creating admin users
const bcrypt = require('bcryptjs');

async function generateAdminSQL() {
  try {
    console.log('🔐 Generating admin user SQL...\n');
    
    // Generate password hash for 'admin123'
    const password = 'admin123';
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    console.log('Password:', password);
    console.log('Hash:', passwordHash);
    console.log('\n📋 Copy and paste this SQL into your Supabase SQL Editor:\n');
    console.log('-- ============================================================================');
    console.log('-- CREATE ADMIN USERS FOR LES TEMPLES');
    console.log('-- ============================================================================\n');
    
    // First, create a salon if it doesn't exist
    console.log('-- 1. Create salon (if not exists)');
    console.log(`INSERT INTO salons (id, name, slug, address, city, phone, email, is_active)
VALUES (
  'd290f1ee-6c54-4b01-90e6-d701748f0851',
  'Les Temples Paris',
  'temple-paris',
  '123 Rue de la Paix, 75001 Paris',
  'Paris',
  '+33 1 42 86 87 88',
  'contact@lestemples.fr',
  true
)
ON CONFLICT (id) DO NOTHING;
`);
    
    // Create admin users
    console.log('-- 2. Create admin users');
    const adminUsers = [
      {
        email: 'admin@lestemples.fr',
        firstName: 'Admin',
        lastName: 'Les Temples'
      },
      {
        email: 'test@lestemples.fr',
        firstName: 'Test',
        lastName: 'Admin'
      },
      {
        email: 'amine@lestemples.fr',
        firstName: 'Amine',
        lastName: 'Admin'
      }
    ];
    
    adminUsers.forEach(user => {
      console.log(`INSERT INTO staff (salon_id, email, password_hash, first_name, last_name, role, is_active)
VALUES (
  'd290f1ee-6c54-4b01-90e6-d701748f0851',
  '${user.email}',
  '${passwordHash}',
  '${user.firstName}',
  '${user.lastName}',
  'admin',
  true
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name;
`);
    });
    
    console.log('\n-- ============================================================================');
    console.log('-- After running this SQL, you can login with:');
    console.log('-- Email: admin@lestemples.fr (or test@lestemples.fr, or amine@lestemples.fr)');
    console.log('-- Password: admin123');
    console.log('-- ============================================================================\n');
    
  } catch (error) {
    console.error('Error generating admin SQL:', error);
  }
}

generateAdminSQL();