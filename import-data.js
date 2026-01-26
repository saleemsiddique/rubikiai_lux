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

// Function to convert special Firestore types
function convertFirestoreTypes(obj) {
  if (obj === null || obj === undefined) return obj;

  // Check if it's a Firestore Timestamp
  if (obj._seconds !== undefined && obj._nanoseconds !== undefined) {
    return admin.firestore.Timestamp.fromMillis(
      obj._seconds * 1000 + Math.floor(obj._nanoseconds / 1000000)
    );
  }

  // Check if it's an array
  if (Array.isArray(obj)) {
    return obj.map(item => convertFirestoreTypes(item));
  }

  // Check if it's an object
  if (typeof obj === 'object') {
    const converted = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertFirestoreTypes(value);
    }
    return converted;
  }

  return obj;
}

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

      // Detect if this is a subcollection by checking the data structure
      // A subcollection has nested objects: { parentDocId: { subDocId: {...} } }
      // A regular collection has: { docId: {...} }
      const firstKey = Object.keys(documents)[0];
      const firstValue = documents[firstKey];

      let isSubcollection = false;
      if (collectionName.includes('_') && typeof firstValue === 'object' && firstValue !== null) {
        // Check if the first value contains objects (potential subcollection)
        const nestedKeys = Object.keys(firstValue);
        if (nestedKeys.length > 0) {
          const firstNestedValue = firstValue[nestedKeys[0]];
          // If it's an object and not a timestamp, it's likely a subcollection
          if (typeof firstNestedValue === 'object' &&
              firstNestedValue !== null &&
              !Array.isArray(firstNestedValue) &&
              firstNestedValue._seconds === undefined) {
            isSubcollection = true;
          }
        }
      }

      if (isSubcollection) {
        const [parentCollection, subcollection] = collectionName.split('_');
        console.log(`Importing subcollection: ${parentCollection}/*/${subcollection}`);

        for (const [parentDocId, subDocs] of Object.entries(documents)) {
          for (const [subDocId, subDocData] of Object.entries(subDocs)) {
            const convertedData = convertFirestoreTypes(subDocData);
            await db.collection(parentCollection)
              .doc(parentDocId)
              .collection(subcollection)
              .doc(subDocId)
              .set(convertedData);
            console.log(`  ✓ ${parentDocId}/${subDocId}`);
          }
        }
      } else {
        // Regular collection
        console.log(`Importing collection: ${collectionName}`);

        for (const [docId, docData] of Object.entries(documents)) {
          const convertedData = convertFirestoreTypes(docData);
          await db.collection(collectionName).doc(docId).set(convertedData);
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
