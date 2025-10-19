/**
 * Test script for YouTube Transcript API
 * This script demonstrates how to use the new transcript endpoints
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:8888';

// Test data
const testVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Rick Astley - Never Gonna Give You Up
const testVideoId = 'dQw4w9WgXcQ';

async function testTranscriptAPI() {
    console.log('🧪 Testing YouTube Transcript API...\n');

    try {
        // Test 1: Get transcript
        console.log('1️⃣ Testing get transcript...');
        const transcriptResponse = await fetch(`${BASE_URL}/api/get-transcript`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: testVideoUrl,
                lang: 'en',
                text: true,
                mode: 'auto'
            })
        });

        const transcriptResult = await transcriptResponse.json();
        console.log('Transcript Response:', JSON.stringify(transcriptResult, null, 2));

        // Test 2: Get video metadata
        console.log('\n2️⃣ Testing get video metadata...');
        const metadataResponse = await fetch(`${BASE_URL}/api/get-video-metadata`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                videoId: testVideoId
            })
        });

        const metadataResult = await metadataResponse.json();
        console.log('Metadata Response:', JSON.stringify(metadataResult, null, 2));

        // Test 3: Translate transcript (if we have a transcript)
        if (transcriptResult.success && transcriptResult.transcript) {
            console.log('\n3️⃣ Testing translate transcript...');
            const translateResponse = await fetch(`${BASE_URL}/api/translate-transcript`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    videoId: testVideoId,
                    lang: 'es' // Spanish
                })
            });

            const translateResult = await translateResponse.json();
            console.log('Translate Response:', JSON.stringify(translateResult, null, 2));
        }

        // Test 4: Check transcript job (if we got a job ID)
        if (transcriptResult.success && transcriptResult.jobId) {
            console.log('\n4️⃣ Testing check transcript job...');
            const jobResponse = await fetch(`${BASE_URL}/api/check-transcript-job`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    jobId: transcriptResult.jobId
                })
            });

            const jobResult = await jobResponse.json();
            console.log('Job Status Response:', JSON.stringify(jobResult, null, 2));
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
if (require.main === module) {
    testTranscriptAPI();
}

module.exports = { testTranscriptAPI };
