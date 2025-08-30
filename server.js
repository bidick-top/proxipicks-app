// server.js (Corrected version with 'types' field)

const express = require('express');
const { Client } = require('@googlemaps/google-maps-services-js');
const dotenv = require('dotenv');
const cors = require('cors');
const admin = require('firebase-admin');

dotenv.config();
const serviceAccount = require('./serviceAccountKey.json');

const app = express();
const port = 3000;
const mapsClient = new Client({});

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const CACHE_DURATION_HOURS = 24;

app.use(cors({
    origin: 'https://jovial-babka-29d3b0.netlify.app' // <-- 請換成您自己的 Netlify 網址
}));
app.use(express.json());

app.get('/api/places', async (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    
    const type = req.query.type || 'all';
    const opennow = req.query.opennow === 'true';

    if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: 'Invalid parameters' });
    }

    const cacheKey = `places_${lat.toFixed(2)}_${lng.toFixed(2)}_${type}_${opennow}`;
    const cacheRef = db.collection('placesCache').doc(cacheKey);

    try {
        const doc = await cacheRef.get();
        if (doc.exists) {
            const cacheData = doc.data();
            const cacheAgeHours = (new Date() - cacheData.timestamp.toDate()) / (1000 * 60 * 60);
            if (cacheAgeHours < CACHE_DURATION_HOURS) {
                console.log(`✅ Cache HIT for key: ${cacheKey}`);
                return res.status(200).json(cacheData.data);
            }
        }

        console.log(`❌ Cache MISS for key: ${cacheKey}. Fetching from Google...`);
        
        const requestParams = {
            location: { lat, lng },
            radius: 5000,
            key: process.env.GOOGLE_MAPS_API_KEY,
            language: 'zh-TW',
        };

        if (type !== 'all') {
            requestParams.type = type;
        } else {
            requestParams.query = 'tourist attraction OR restaurant';
        }
        
        if (opennow) {
            requestParams.opennow = true;
        }
        
        const searchResponse = await mapsClient.textSearch({ params: requestParams });
        
        const initialResults = searchResponse.data.results;
        
        const detailPromises = initialResults.map(place => {
            return mapsClient.placeDetails({
                params: {
                    place_id: place.place_id,
                    // MODIFIED LINE: Added 'types' to the array
                    fields: ['name', 'rating', 'user_ratings_total', 'formatted_address', 'geometry', 'photos', 'url', 'types'],
                    key: process.env.GOOGLE_MAPS_API_KEY,
                    language: 'zh-TW',
                }
            }).then(response => response.data.result);
        });

        const detailedResults = await Promise.all(detailPromises);
        
        const filteredResults = detailedResults.filter(place =>
            place && place.rating >= 4.2 && place.user_ratings_total >= 5000
        );

        await cacheRef.set({
            timestamp: new Date(),
            data: filteredResults
        });
        console.log(`📝 Cache WRITE for key: ${cacheKey}`);
        
        res.status(200).json(filteredResults);

    } catch (error) {
        console.error('Error in /api/places:', error);
        res.status(500).json({ error: 'An internal server error occurred' });
    }
});

app.listen(port, () => {
    console.log(`ProxiPicks backend server listening on http://localhost:${port}`);
});