// Script to populate the Supabase database with admin users
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

// Supabase configuration
const supabaseUrl = 'https://vihcjaebkbcdfbwjxqbd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpaGNqYWVia2JjZGZid2p4cWJkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTM3ODkxNywiZXhwIjoyMDc2OTU0OTE3fQ.ji2sV8U-lCYVBhaU_BZzGoLfUivYz9aCV6y4DfhIeDw'; // Service role key to bypass RLS

const supabase = createClient(supabaseUrl, supabaseKey);

async function populateDatabase() {
  try {
    console.log('🔗 Connecting to Supabase...');
    
    // Generate password hash for 'admin123'
    const password = 'admin123';
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    console.log('🔐 Generated password hash for admin123');
    
    // 1. Create salons and get actual IDs from database
    console.log('🏢 Creating salons...');
    const salonTemplates = [
      {
        name: 'Les Temples - Paris',
        slug: 'temple-paris',
        address: '123 Rue de la Paix, 75001 Paris',
        city: 'Paris',
        phone: '+33 1 42 86 87 88',
        email: 'paris@lestemples.fr',
        opening_hours: {
          monday: { open: '10:00', close: '20:00' },
          tuesday: { open: '10:00', close: '20:00' },
          wednesday: { open: '10:00', close: '20:00' },
          thursday: { open: '10:00', close: '20:00' },
          friday: { open: '10:00', close: '21:00' },
          saturday: { open: '09:00', close: '21:00' },
          sunday: { open: '10:00', close: '19:00' }
        }
      },
      {
        name: 'Les Temples - Lyon',
        slug: 'temple-lyon',
        address: '456 Avenue de la République, 69000 Lyon',
        city: 'Lyon',
        phone: '+33 4 72 34 56 78',
        email: 'lyon@lestemples.fr',
        opening_hours: {
          monday: { open: '10:00', close: '20:00' },
          tuesday: { open: '10:00', close: '20:00' },
          wednesday: { open: '10:00', close: '20:00' },
          thursday: { open: '10:00', close: '20:00' },
          friday: { open: '10:00', close: '21:00' },
          saturday: { open: '09:00', close: '21:00' },
          sunday: { open: '10:00', close: '19:00' }
        }
      },
      {
        name: 'Les Temples - Marseille',
        slug: 'temple-marseille',
        address: '789 Boulevard de la Corniche, 13000 Marseille',
        city: 'Marseille',
        phone: '+33 4 91 23 45 67',
        email: 'marseille@lestemples.fr',
        opening_hours: {
          monday: { open: '10:00', close: '20:00' },
          tuesday: { open: '10:00', close: '20:00' },
          wednesday: { open: '10:00', close: '20:00' },
          thursday: { open: '10:00', close: '20:00' },
          friday: { open: '10:00', close: '21:00' },
          saturday: { open: '09:00', close: '21:00' },
          sunday: { open: '10:00', close: '19:00' }
        }
      }
    ];

    // Create or get existing salons
    const salons = [];
    for (const salonTemplate of salonTemplates) {
      const { data: existing } = await supabase
        .from('salons')
        .select('*')
        .eq('slug', salonTemplate.slug)
        .single();

      if (!existing) {
        const { data: newSalon, error } = await supabase
          .from('salons')
          .insert({
            ...salonTemplate,
            is_active: true
          })
          .select()
          .single();
        
        if (error) {
          console.error(`❌ Error creating salon ${salonTemplate.name}:`, error);
        } else {
          console.log(`✅ Created salon: ${salonTemplate.name}`);
          salons.push(newSalon);
        }
      } else {
        console.log(`✅ Salon already exists: ${existing.name}`);
        salons.push(existing);
      }
    }

    // Get the Paris salon ID for admin users
    const parisSalon = salons.find(s => s.slug === 'temple-paris');
    const salonId = parisSalon?.id;
    
    // 2. Create admin users
    console.log('👥 Creating admin users...');
    const adminUsers = [
      {
        email: 'admin@lestemples.fr',
        first_name: 'Admin',
        last_name: 'Les Temples'
      },
      {
        email: 'test@lestemples.fr',
        first_name: 'Test',
        last_name: 'Admin'
      },
      {
        email: 'amine@lestemples.fr',
        first_name: 'Amine',
        last_name: 'Admin'
      }
    ];
    
    for (const user of adminUsers) {
      console.log(`📝 Creating user: ${user.email}`);
      
      // Check if user exists
      const { data: existingUser } = await supabase
        .from('staff')
        .select('id')
        .eq('email', user.email)
        .single();
      
      if (existingUser) {
        // Update existing user
        const { error: updateError } = await supabase
          .from('staff')
          .update({
            password_hash: passwordHash,
            first_name: user.first_name,
            last_name: user.last_name,
            role: 'admin',
            is_active: true
          })
          .eq('email', user.email);
        
        if (updateError) {
          console.error(`❌ Error updating user ${user.email}:`, updateError);
        } else {
          console.log(`✅ Updated user: ${user.email}`);
        }
      } else {
        // Create new user
        const { error: insertError } = await supabase
          .from('staff')
          .insert({
            salon_id: salonId,
            email: user.email,
            password_hash: passwordHash,
            first_name: user.first_name,
            last_name: user.last_name,
            role: 'admin',
            is_active: true
          });
        
        if (insertError) {
          console.error(`❌ Error creating user ${user.email}:`, insertError);
        } else {
          console.log(`✅ Created user: ${user.email}`);
        }
      }
    }

    // 3. Create services for each salon
    console.log('\n💆 Creating services...');
    const services = [
      {
        name: 'Massage Relaxant',
        description: 'Massage complet du corps apaisant pour relâcher les tensions',
        duration_minutes: 60,
        price_cents: 8900,
        category: 'Détente'
      },
      {
        name: 'Massage aux Pierres Chaudes',
        description: 'Massage thérapeutique avec pierres chauffées',
        duration_minutes: 75,
        price_cents: 10900,
        category: 'Thérapeutique'
      },
      {
        name: 'Massage Sportif',
        description: 'Massage des tissus profonds pour athlètes',
        duration_minutes: 60,
        price_cents: 9900,
        category: 'Sportif'
      },
      {
        name: 'Soin du Visage Premium',
        description: 'Soin du visage luxueux avec produits biologiques',
        duration_minutes: 45,
        price_cents: 7900,
        category: 'Détente'
      },
      {
        name: 'Massage en Duo',
        description: 'Expérience de massage pour couples',
        duration_minutes: 60,
        price_cents: 17900,
        category: 'Détente'
      }
    ];

    for (const salon of salons) {
      for (const service of services) {
        const { data: existing } = await supabase
          .from('services')
          .select('id')
          .eq('salon_id', salon.id)
          .eq('name', service.name)
          .single();

        if (!existing) {
          const { error } = await supabase.from('services').insert({
            ...service,
            salon_id: salon.id,
            is_active: true
          });
          if (error) {
            console.error(`❌ Error creating service ${service.name} for ${salon.name}:`, error);
          } else {
            console.log(`✅ Created service: ${service.name} for ${salon.name}`);
          }
        }
      }
    }

    // 4. Create therapists for each salon
    console.log('\n👨‍⚕️ Creating therapists...');
    const therapists = [
      {
        salon_slug: 'temple-paris',
        first_name: 'Sophie',
        last_name: 'Martin',
        email: 'sophie.martin@lestemples.fr',
        phone: '+33 6 11 22 33 44',
        specialties: []
      },
      {
        salon_slug: 'temple-paris',
        first_name: 'Jean',
        last_name: 'Dupont',
        email: 'jean.dupont@lestemples.fr',
        phone: '+33 6 22 33 44 55',
        specialties: []
      },
      {
        salon_slug: 'temple-lyon',
        first_name: 'Marie',
        last_name: 'Leclerc',
        email: 'marie.leclerc@lestemples.fr',
        phone: '+33 6 33 44 55 66',
        specialties: []
      },
      {
        salon_slug: 'temple-marseille',
        first_name: 'Pierre',
        last_name: 'Rousseau',
        email: 'pierre.rousseau@lestemples.fr',
        phone: '+33 6 44 55 66 77',
        specialties: []
      }
    ];

    for (const therapist of therapists) {
      const salonForTherapist = salons.find(s => s.slug === therapist.salon_slug);
      
      if (!salonForTherapist) {
        console.error(`❌ Salon not found for slug: ${therapist.salon_slug}`);
        continue;
      }

      const { data: existing } = await supabase
        .from('staff')
        .select('id')
        .eq('email', therapist.email)
        .single();

      if (!existing) {
        const { error } = await supabase.from('staff').insert({
          salon_id: salonForTherapist.id,
          email: therapist.email,
          password_hash: passwordHash,
          first_name: therapist.first_name,
          last_name: therapist.last_name,
          phone: therapist.phone,
          role: 'therapist',
          specialties: therapist.specialties,
          is_active: true
        });
        if (error) {
          console.error(`❌ Error creating therapist ${therapist.first_name} ${therapist.last_name}:`, error);
        } else {
          console.log(`✅ Created therapist: ${therapist.first_name} ${therapist.last_name} at ${salonForTherapist.name}`);
        }
      } else {
        console.log(`✅ Therapist already exists: ${therapist.first_name} ${therapist.last_name}`);
      }
    }

    // 5. Verify the data
    console.log('\n🔍 Verifying database...');
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('*');

    if (staffError) {
      console.error('❌ Error fetching staff:', staffError);
    } else {
      console.log(`✅ Total staff members: ${staffData.length}`);
      staffData.forEach(staff => {
        console.log(`   - ${staff.email} (${staff.first_name} ${staff.last_name}) - Role: ${staff.role}`);
      });
    }

    const { data: servicesData } = await supabase.from('services').select('*');
    console.log(`✅ Total services: ${servicesData?.length || 0}`);

    const { data: salonsData } = await supabase.from('salons').select('*');
    console.log(`✅ Total salons: ${salonsData?.length || 0}`);

    console.log('\n🎉 Database population complete!');
    console.log('📋 Login credentials:');
    console.log('   Email: admin@lestemples.fr, test@lestemples.fr, or amine@lestemples.fr');
    console.log('   Password: admin123');
    
  } catch (error) {
    console.error('💥 Error populating database:', error);
  }
}

populateDatabase();