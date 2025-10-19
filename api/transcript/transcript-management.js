const { Supadata, SupadataError } = require('@supadata/js');
const fs = require('fs');
const path = require('path');

// Initialize Supadata client
const supadata = new Supadata({
    apiKey: process.env.SUPADATA_API_KEY || 'sd_82fd27e22d9c5a72b3bda8b9aa61de34', // Your Supadata API key
});

/**
 * Get transcript from YouTube video
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getTranscript(req, res) {
    try {
        const { url, lang = 'en', text = true, mode = 'auto' } = req.body;

        // Validate required parameters
        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'URL is required',
                error: 'Missing required parameter: url'
            });
        }

        // Validate URL format
        const youtubeUrlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;
        if (!youtubeUrlPattern.test(url)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid YouTube URL format',
                error: 'URL must be a valid YouTube video URL'
            });
        }

        console.log(`🎬 Getting transcript for: ${url}`);

        // Get transcript from Supadata
        const transcriptResult = await supadata.transcript({
            url: url,
            lang: lang,
            text: text,
            mode: mode
        });

        // Check if we got a transcript directly or a job ID for async processing
        if ("jobId" in transcriptResult) {
            // For large files, we get a job ID and need to poll for results
            console.log(`⏳ Started transcript job: ${transcriptResult.jobId}`);

            return res.json({
                success: true,
                message: 'Transcript job started',
                jobId: transcriptResult.jobId,
                status: 'processing',
                note: 'This is a large file. Use the job ID to check status later.'
            });
        } else {
            // For smaller files, we get the transcript directly
            console.log(`✅ Transcript retrieved successfully`);

            // Save transcript to file
            const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1] || 'unknown';
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `transcript_${videoId}_${timestamp}.txt`;
            const transcriptDir = path.join(__dirname, '../../transcripts');
            
            // Create transcripts directory if it doesn't exist
            if (!fs.existsSync(transcriptDir)) {
                fs.mkdirSync(transcriptDir, { recursive: true });
            }
            
            const filePath = path.join(transcriptDir, filename);
            const transcriptContent = typeof transcriptResult === 'string' ? transcriptResult : transcriptResult.content;
            
            // Save transcript to file
            fs.writeFileSync(filePath, transcriptContent, 'utf8');
            console.log(`💾 Transcript saved to: ${filePath}`);

            return res.json({
                success: true,
                message: 'Transcript retrieved successfully',
                transcript: transcriptResult,
                status: 'completed',
                savedTo: filePath,
                filename: filename
            });
        }

    } catch (error) {
        console.error('❌ Transcript error:', error);

        if (error instanceof SupadataError) {
            return res.status(400).json({
                success: false,
                message: 'Transcript API error',
                error: error.error,
                details: error.details,
                documentationUrl: error.documentationUrl
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to get transcript',
            error: error.message
        });
    }
}

/**
 * Check transcript job status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function checkTranscriptJob(req, res) {
    try {
        const { jobId } = req.body;

        if (!jobId) {
            return res.status(400).json({
                success: false,
                message: 'Job ID is required',
                error: 'Missing required parameter: jobId'
            });
        }

        console.log(`🔍 Checking transcript job status: ${jobId}`);

        // Get job status from Supadata
        const jobResult = await supadata.transcript.getJobStatus(jobId);

        if (jobResult.status === 'completed') {
            console.log(`✅ Transcript job completed: ${jobId}`);
            
            // Save completed transcript to file
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `transcript_job_${jobId}_${timestamp}.txt`;
            const transcriptDir = path.join(__dirname, '../../transcripts');
            
            // Create transcripts directory if it doesn't exist
            if (!fs.existsSync(transcriptDir)) {
                fs.mkdirSync(transcriptDir, { recursive: true });
            }
            
            const filePath = path.join(transcriptDir, filename);
            const transcriptContent = typeof jobResult.content === 'string' ? jobResult.content : jobResult.content.content;
            
            // Save transcript to file
            fs.writeFileSync(filePath, transcriptContent, 'utf8');
            console.log(`💾 Transcript saved to: ${filePath}`);
            
            return res.json({
                success: true,
                message: 'Transcript job completed',
                status: 'completed',
                transcript: jobResult.content,
                savedTo: filePath,
                filename: filename
            });
        } else if (jobResult.status === 'failed') {
            console.log(`❌ Transcript job failed: ${jobId}`);
            return res.json({
                success: false,
                message: 'Transcript job failed',
                status: 'failed',
                error: jobResult.error
            });
        } else {
            console.log(`⏳ Transcript job status: ${jobResult.status}`);
            return res.json({
                success: true,
                message: 'Transcript job in progress',
                status: jobResult.status,
                note: 'Job is still processing. Check again later.'
            });
        }

    } catch (error) {
        console.error('❌ Check transcript job error:', error);

        if (error instanceof SupadataError) {
            return res.status(400).json({
                success: false,
                message: 'Transcript job check error',
                error: error.error,
                details: error.details
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to check transcript job',
            error: error.message
        });
    }
}

/**
 * Get YouTube video metadata
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getVideoMetadata(req, res) {
    try {
        const { videoId } = req.body;

        if (!videoId) {
            return res.status(400).json({
                success: false,
                message: 'Video ID is required',
                error: 'Missing required parameter: videoId'
            });
        }

        console.log(`📹 Getting video metadata for: ${videoId}`);

        // Get video metadata from Supadata
        const video = await supadata.youtube.video({
            id: videoId
        });

        console.log(`✅ Video metadata retrieved successfully`);

        return res.json({
            success: true,
            message: 'Video metadata retrieved successfully',
            video: video
        });

    } catch (error) {
        console.error('❌ Video metadata error:', error);

        if (error instanceof SupadataError) {
            return res.status(400).json({
                success: false,
                message: 'Video metadata API error',
                error: error.error,
                details: error.details
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to get video metadata',
            error: error.message
        });
    }
}

/**
 * Translate YouTube transcript
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function translateTranscript(req, res) {
    try {
        const { videoId, lang = 'en' } = req.body;

        if (!videoId) {
            return res.status(400).json({
                success: false,
                message: 'Video ID is required',
                error: 'Missing required parameter: videoId'
            });
        }

        console.log(`🌐 Translating transcript for: ${videoId} to ${lang}`);

        // Translate transcript using Supadata
        const translatedTranscript = await supadata.youtube.translate({
            videoId: videoId,
            lang: lang
        });

        console.log(`✅ Transcript translated successfully`);

        return res.json({
            success: true,
            message: 'Transcript translated successfully',
            transcript: translatedTranscript,
            language: lang
        });

    } catch (error) {
        console.error('❌ Translate transcript error:', error);

        if (error instanceof SupadataError) {
            return res.status(400).json({
                success: false,
                message: 'Translate transcript API error',
                error: error.error,
                details: error.details
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to translate transcript',
            error: error.message
        });
    }
}

/**
 * List saved transcript files
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function listTranscriptFiles(req, res) {
    try {
        const transcriptDir = path.join(__dirname, '../../transcripts');
        
        // Check if transcripts directory exists
        if (!fs.existsSync(transcriptDir)) {
            return res.json({
                success: true,
                message: 'No transcript files found',
                files: [],
                count: 0
            });
        }

        // Read directory and get file info
        const files = fs.readdirSync(transcriptDir)
            .filter(file => file.endsWith('.txt'))
            .map(file => {
                const filePath = path.join(transcriptDir, file);
                const stats = fs.statSync(filePath);
                return {
                    filename: file,
                    path: filePath,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime
                };
            })
            .sort((a, b) => b.modified - a.modified); // Sort by newest first

        console.log(`📁 Found ${files.length} transcript files`);

        return res.json({
            success: true,
            message: `Found ${files.length} transcript files`,
            files: files,
            count: files.length
        });

    } catch (error) {
        console.error('❌ List transcript files error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to list transcript files',
            error: error.message
        });
    }
}

/**
 * Get transcript file content
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getTranscriptFile(req, res) {
    try {
        const { filename } = req.params;

        if (!filename) {
            return res.status(400).json({
                success: false,
                message: 'Filename is required',
                error: 'Missing required parameter: filename'
            });
        }

        const transcriptDir = path.join(__dirname, '../../transcripts');
        const filePath = path.join(transcriptDir, filename);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'Transcript file not found',
                error: 'File does not exist'
            });
        }

        // Read file content
        const content = fs.readFileSync(filePath, 'utf8');
        const stats = fs.statSync(filePath);

        console.log(`📖 Reading transcript file: ${filename}`);

        return res.json({
            success: true,
            message: 'Transcript file retrieved successfully',
            filename: filename,
            content: content,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
        });

    } catch (error) {
        console.error('❌ Get transcript file error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get transcript file',
            error: error.message
        });
    }
}

module.exports = {
    getTranscript,
    checkTranscriptJob,
    getVideoMetadata,
    translateTranscript,
    listTranscriptFiles,
    getTranscriptFile
};
