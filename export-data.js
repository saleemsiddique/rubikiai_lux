/**
 * Firebase Firestore Export Script
 *
 * This script exports all data from your Firebase Firestore database
 * to a JSON file that can be imported into another Firebase project.
 *
 * USAGE:
 * 1. Make sure you have your Firebase service account JSON file
 * 2. Rename it to 'serviceAccountKey.json' and place it in this folder
 * 3. Run: node export-data.js
 * 4. The exported data will be saved to 'firestore-backup.json'
 */

const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin with your service account
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Collections to export (add more if needed)
const COLLECTIONS_TO_EXPORT = [
  'houses',
  'reservations',
  'coupons',
  'percentage_discounts',
  'coupon_orders',
  'stripe_customer_by_email',
  'checkout_intents',
  'admins'
];

// Subcollections to export (format: 'parentCollection/movements')
const SUBCOLLECTIONS_TO_EXPORT = [
  { parent: 'coupons', subcollection: 'movements' },
  { parent: 'percentage_discounts', subcollection: 'movements' }
];

async function exportCollection(collectionName) {
  console.log(`Exporting collection: ${collectionName}`);
  const snapshot = await db.collection(collectionName).get();
  const data = {};

  snapshot.forEach(doc => {
    data[doc.id] = doc.data();
  });

  console.log(`  - Found ${Object.keys(data).length} documents`);
  return data;
}

async function exportSubcollections(parentCollection, subcollectionName) {
  console.log(`Exporting subcollections: ${parentCollection}/*/${subcollectionName}`);
  const parentSnapshot = await db.collection(parentCollection).get();
  const allSubcollectionData = {};

  for (const parentDoc of parentSnapshot.docs) {
    const subcollectionRef = db.collection(parentCollection)
      .doc(parentDoc.id)
      .collection(subcollectionName);

    const subcollectionSnapshot = await subcollectionRef.get();

    if (!subcollectionSnapshot.empty) {
      allSubcollectionData[parentDoc.id] = {};

      subcollectionSnapshot.forEach(subDoc => {
        allSubcollectionData[parentDoc.id][subDoc.id] = subDoc.data();
      });

      console.log(`  - ${parentDoc.id}: ${subcollectionSnapshot.size} documents`);
    }
  }

  return allSubcollectionData;
}

async function exportAllData() {
  console.log('='.repeat(50));
  console.log('FIREBASE FIRESTORE EXPORT');
  console.log('='.repeat(50));
  console.log('');

  const exportData = {
    _metadata: {
      exportedAt: new Date().toISOString(),
      projectId: serviceAccount.project_id,
      collections: COLLECTIONS_TO_EXPORT
    }
  };

  // Export main collections
  for (const collectionName of COLLECTIONS_TO_EXPORT) {
    try {
      exportData[collectionName] = await exportCollection(collectionName);
    } catch (error) {
      console.error(`  Error exporting ${collectionName}:`, error.message);
      exportData[collectionName] = {};
    }
  }

  // Export subcollections
  console.log('');
  console.log('Exporting subcollections...');

  for (const { parent, subcollection } of SUBCOLLECTIONS_TO_EXPORT) {
    try {
      const key = `${parent}_${subcollection}`;
      exportData[key] = await exportSubcollections(parent, subcollection);
    } catch (error) {
      console.error(`  Error exporting ${parent}/${subcollection}:`, error.message);
    }
  }

  // Write to file
  const outputFile = 'firestore-backup.json';
  fs.writeFileSync(outputFile, JSON.stringify(exportData, null, 2));

  console.log('');
  console.log('='.repeat(50));
  console.log(`✅ Export completed successfully!`);
  console.log(`   Output file: ${outputFile}`);
  console.log('='.repeat(50));

  // Summary
  console.log('');
  console.log('SUMMARY:');
  for (const [key, value] of Object.entries(exportData)) {
    if (key !== '_metadata' && typeof value === 'object') {
      console.log(`  - ${key}: ${Object.keys(value).length} items`);
    }
  }

  process.exit(0);
}

// Run the export
exportAllData().catch(error => {
  console.error('Export failed:', error);
  process.exit(1);
});
