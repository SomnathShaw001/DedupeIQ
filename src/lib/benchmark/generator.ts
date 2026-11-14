/**
 * DedupeIQ Synthetic Data Generator for Scientific Benchmarking
 * Generates 2,000 realistic records with ~15% controlled injected duplicates
 * using realistic corruptions (phonetic typos, nickname mappings, word transpositions,
 * email variants, phone formats, address abbreviations) and assigns ground-truth group IDs.
 */

import { getDb } from '../db';
import { ensureMigrated } from '../db/migrate';
import { randomUUID } from 'crypto';

const INDIAN_FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Advaith', 'Aaryan', 'Dhruv', 'Kabir', 'Ritvik', 'Darsh',
  'Ananya', 'Diya', 'Aadhya', 'Pari', 'Saanvi', 'Myra', 'Anvi', 'Prisha', 'Riya', 'Aaradhya',
  'Priya', 'Neha', 'Pooja', 'Shreya', 'Sneha', 'Tanvi', 'Isha', 'Kavya', 'Deepika', 'Divya',
  'Rahul', 'Amit', 'Rohan', 'Vikram', 'Suresh', 'Rajesh', 'Manish', 'Sanjay', 'Alok', 'Deepak',
];

const INDIAN_LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Malhotra', 'Bhatia', 'Saxena', 'Mehta', 'Chopra', 'Joshi', 'Kulkarni',
  'Patel', 'Shah', 'Deshmukh', 'Reddy', 'Rao', 'Nair', 'Menon', 'Pillai', 'Iyer', 'Iyengar',
  'Singh', 'Kaur', 'Das', 'Banerjee', 'Chatterjee', 'Mukherjee', 'Bose', 'Ghosh', 'Sen', 'Dutta',
  'Choudhury', 'Mishra', 'Pandey', 'Tiwari', 'Dubey', 'Shukla', 'Yadav', 'Prasad', 'Thakur', 'Kapoor',
];

const INTL_FIRST_NAMES = [
  'James', 'Robert', 'John', 'Michael', 'David', 'William', 'Richard', 'Joseph', 'Thomas', 'Charles',
  'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua',
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen',
  'Lisa', 'Nancy', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle',
];

const INTL_LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
];

const CITIES = [
  'Mumbai', 'Bengaluru', 'Delhi', 'Hyderabad', 'Pune', 'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur',
  'New York', 'San Francisco', 'Chicago', 'Austin', 'Seattle', 'London', 'Toronto', 'Singapore',
];

const STREET_NAMES = [
  'MG Road', 'Brigade Road', 'Park Street', 'Connaught Place', 'Anna Salai', 'FC Road', 'Banjara Hills',
  'Baker Street', 'Oxford Street', 'Main Street', 'Fifth Avenue', 'Broadway', 'Oak Lane', 'Maple Drive',
];

const SOURCE_SYSTEMS = [
  'CRM-Salesforce',
  'StudentPortal-v2',
  'LegacyERP-2019',
  'OnlineRegistration',
  'MobileApp-Android',
  'ManualBatchUpload',
];

const NICKNAME_SWAPS: Record<string, string> = {
  Robert: 'Bob',
  William: 'Bill',
  Richard: 'Dick',
  James: 'Jim',
  John: 'Jack',
  Alexander: 'Alex',
  Elizabeth: 'Liz',
  Michael: 'Mike',
  David: 'Dave',
  Daniel: 'Dan',
  Thomas: 'Tom',
  Anthony: 'Tony',
  Christopher: 'Chris',
  Samuel: 'Sam',
  Benjamin: 'Ben',
  Edward: 'Ted',
  Katherine: 'Kate',
  Margaret: 'Maggie',
  Rajesh: 'Raju',
};

// Helper: inject typos and phonetic corruptions
function corruptName(name: string): string {
  const roll = Math.random();
  const tokens = name.split(' ');

  // 1. Nickname swap if first name has nickname
  if (tokens.length >= 2 && NICKNAME_SWAPS[tokens[0]]) {
    return `${NICKNAME_SWAPS[tokens[0]]} ${tokens.slice(1).join(' ')}`;
  }

  // 2. Transposed name tokens (e.g. "Sharma Rahul" vs "Rahul Sharma")
  if (roll < 0.25 && tokens.length === 2) {
    return `${tokens[1]} ${tokens[0]}`;
  }

  // 3. Swap adjacent letters in last name
  if (roll < 0.50 && tokens[tokens.length - 1].length > 4) {
    const lastName = tokens[tokens.length - 1];
    const idx = 2;
    const swapped =
      lastName.slice(0, idx) +
      lastName[idx + 1] +
      lastName[idx] +
      lastName.slice(idx + 2);
    tokens[tokens.length - 1] = swapped;
    return tokens.join(' ');
  }

  // 4. Missing vowel
  if (roll < 0.75) {
    const vowelReplaced = name.replace(/[aeiou]/i, '');
    return vowelReplaced;
  }

  // 5. Letter duplication or typo
  return name.replace(/a/i, 'aa');
}

function corruptEmail(email: string): string {
  const [local, domain] = email.split('@');
  const roll = Math.random();

  if (domain === 'gmail.com') {
    if (roll < 0.5) {
      // Add dot or plus tag
      return `${local}+news@gmail.com`;
    } else {
      // Add dot in local part
      const mid = Math.floor(local.length / 2);
      return `${local.slice(0, mid)}.${local.slice(mid)}@gmail.com`;
    }
  }

  return `${local}1@${domain}`;
}

function corruptPhone(phone: string): string {
  const roll = Math.random();
  const digits = phone.replace(/\D/g, '');

  if (roll < 0.35) {
    // Add international +91 prefix
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  } else if (roll < 0.7) {
    // Add hyphens
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else {
    // Swap last two digits (realistic user typo)
    return digits.slice(0, -2) + digits.slice(-1) + digits.slice(-2, -1);
  }
}

function corruptAddress(addr: string): string {
  return addr
    .replace(/\bStreet\b/g, 'St.')
    .replace(/\bRoad\b/g, 'Rd.')
    .replace(/\bAvenue\b/g, 'Ave.')
    .replace(/\bSuite\b/g, 'Ste.')
    .replace(/\bApartment\b/g, 'Apt.');
}

export interface SeedBenchmarkResult {
  totalRecords: number;
  cleanEntities: number;
  injectedDuplicates: number;
  duplicatePercentage: number;
}

export async function seedBenchmarkDataset(targetTotal = 2000, duplicateRate = 0.15): Promise<SeedBenchmarkResult> {
  await ensureMigrated();
  const db = getDb();

  const numDuplicates = Math.round(targetTotal * duplicateRate);
  const numClean = targetTotal - numDuplicates;

  interface GeneratedRecord {
    id: string;
    entity_type: 'customer' | 'student' | 'product';
    full_name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    dob: string;
    source_system: string;
    true_group_id: string;
  }

  const generatedRecords: GeneratedRecord[] = [];

  // 1. Generate clean base records
  for (let i = 0; i < numClean; i++) {
    const isIndian = Math.random() < 0.55;
    const firstName = isIndian
      ? INDIAN_FIRST_NAMES[Math.floor(Math.random() * INDIAN_FIRST_NAMES.length)]
      : INTL_FIRST_NAMES[Math.floor(Math.random() * INTL_FIRST_NAMES.length)];
    const lastName = isIndian
      ? INDIAN_LAST_NAMES[Math.floor(Math.random() * INDIAN_LAST_NAMES.length)]
      : INTL_LAST_NAMES[Math.floor(Math.random() * INTL_LAST_NAMES.length)];

    const fullName = `${firstName} ${lastName}`;
    const cleanLocal = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`.replace(/[^a-z0-9.]/g, '');
    const emailDomain = Math.random() < 0.6 ? 'gmail.com' : 'outlook.com';
    const email = `${cleanLocal}${Math.floor(Math.random() * 90 + 10)}@${emailDomain}`;

    const phone = `98${Math.floor(Math.random() * 89999999 + 10000000)}`;
    const street = STREET_NAMES[Math.floor(Math.random() * STREET_NAMES.length)];
    const streetNum = Math.floor(Math.random() * 900 + 10);
    const address = `${streetNum} ${street}, Suite ${Math.floor(Math.random() * 40 + 1)}`;
    const city = CITIES[Math.floor(Math.random() * CITIES.length)];

    // Birth year between 1980 and 2004
    const birthYear = Math.floor(Math.random() * 24 + 1980);
    const birthMonth = String(Math.floor(Math.random() * 12 + 1)).padStart(2, '0');
    const birthDay = String(Math.floor(Math.random() * 28 + 1)).padStart(2, '0');
    const dob = `${birthYear}-${birthMonth}-${birthDay}`;

    const entityType: 'customer' | 'student' | 'product' =
      i % 5 === 0 ? 'student' : i % 7 === 0 ? 'product' : 'customer';

    const sourceSystem = SOURCE_SYSTEMS[Math.floor(Math.random() * SOURCE_SYSTEMS.length)];
    const trueGroupId = randomUUID();

    generatedRecords.push({
      id: randomUUID(),
      entity_type: entityType,
      full_name: fullName,
      email,
      phone,
      address,
      city,
      dob,
      source_system: sourceSystem,
      true_group_id: trueGroupId,
    });
  }

  // 2. Injected realistic duplicates with controlled corruptions
  for (let j = 0; j < numDuplicates; j++) {
    const parent = generatedRecords[Math.floor(Math.random() * numClean)];

    const corruptNameVal = corruptName(parent.full_name);
    const corruptEmailVal = corruptEmail(parent.email);
    const corruptPhoneVal = corruptPhone(parent.phone);
    const corruptAddressVal = corruptAddress(parent.address);

    // Pick a disparate source system
    const alternateSources = SOURCE_SYSTEMS.filter((s) => s !== parent.source_system);
    const sourceSystem = alternateSources[Math.floor(Math.random() * alternateSources.length)] || 'ManualBatchUpload';

    generatedRecords.push({
      id: randomUUID(),
      entity_type: parent.entity_type,
      full_name: corruptNameVal,
      email: corruptEmailVal,
      phone: corruptPhoneVal,
      address: corruptAddressVal,
      city: parent.city,
      dob: parent.dob,
      source_system: sourceSystem,
      true_group_id: parent.true_group_id, // Link to same ground-truth cluster!
    });
  }

  // 3. Clear existing benchmark data and insert new dataset
  await db.transaction(async (tx) => {
    await tx.query(`DELETE FROM benchmark_ground_truth;`);
    await tx.query(`DELETE FROM match_candidates;`);
    await tx.query(`DELETE FROM merge_log;`);
    await tx.query(`DELETE FROM clusters;`);
    await tx.query(`DELETE FROM records;`);

    const BATCH_SIZE = 250;
    for (let k = 0; k < generatedRecords.length; k += BATCH_SIZE) {
      const chunk = generatedRecords.slice(k, k + BATCH_SIZE);

      for (const rec of chunk) {
        // Insert record (trigger will populate normalized_name, etc.)
        await tx.query(
          `
          INSERT INTO records (
            id, entity_type, full_name, email, phone, address, city, dob, source_system, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
          `,
          [
            rec.id,
            rec.entity_type,
            rec.full_name,
            rec.email,
            rec.phone,
            rec.address,
            rec.city,
            rec.dob,
            rec.source_system,
          ]
        );

        // Insert benchmark ground truth
        await tx.query(
          `
          INSERT INTO benchmark_ground_truth (record_id, true_group_id)
          VALUES ($1, $2)
          `,
          [rec.id, rec.true_group_id]
        );
      }
    }
  });

  return {
    totalRecords: generatedRecords.length,
    cleanEntities: numClean,
    injectedDuplicates: numDuplicates,
    duplicatePercentage: Number(((numDuplicates / generatedRecords.length) * 100).toFixed(1)),
  };
}
