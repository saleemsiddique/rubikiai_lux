/**
 * Firebase Firestore Import Script
 *
 * This script imports data from firestore-backup.json into your Firebase project.
 *
 * USAGE:
 * 1. Make sure you have your NEW Firebase service account JSON file
 * 2. Rename it to 'serviceAccountKey.json' and place it in this folder
 * 3. Make sure 'firestore-backup.json' is in this folder
 * 4. Run: node import-data.js
 */

const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function importData() {
  try {
    // Read the backup file
    const data = JSON.parse(fs.readFileSync('./firestore-backup.json', 'utf8'));

    console.log('='.repeat(50));
    console.log('FIREBASE FIRESTORE IMPORT');
    console.log('='.repeat(50));
    console.log('');

    // Import each collection
    for (const [collectionName, documents] of Object.entries(data)) {
      // Skip metadata
      if (collectionName === '_metadata') continue;

      // Check if this is a subcollection (format: parentCollection_subcollection)
      if (collectionName.includes('_')) {
        const [parentCollection, subcollection] = collectionName.split('_');
        console.log(`Importing subcollection: ${parentCollection}/*/${subcollection}`);

        for (const [parentDocId, subDocs] of Object.entries(documents)) {
          for (const [subDocId, subDocData] of Object.entries(subDocs)) {
            await db.collection(parentCollection)
              .doc(parentDocId)
              .collection(subcollection)
              .doc(subDocId)
              .set(subDocData);
            console.log(`  ✓ ${parentDocId}/${subDocId}`);
          }
        }
      } else {
        // Regular collection
        console.log(`Importing collection: ${collectionName}`);

        for (const [docId, docData] of Object.entries(documents)) {
          await db.collection(collectionName).doc(docId).set(docData);
          console.log(`  ✓ ${docId}`);
        }
      }
    }

    console.log('');
    console.log('='.repeat(50));
    console.log('✅ Import completed successfully!');
    console.log('='.repeat(50));
    process.exit(0);
  } catch (error) {
    console.error('❌ Error importing data:', error);
    process.exit(1);
  }
}

importData();
