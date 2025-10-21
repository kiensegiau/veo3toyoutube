const { Supadata, SupadataError } = require('@supadata/js');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

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
        const { url, lang = 'vi', text = true, mode = 'auto' } = req.body;

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

        // Get transcript from Supadata - Force Vietnamese language
        const transcriptResult = await supadata.transcript({
            url: url,
            lang: 'vi', // Force Vietnamese language
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
            
            // Save transcript to file with proper UTF-8 encoding
            fs.writeFileSync(filePath, transcriptContent, { encoding: 'utf8' });
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
            
            // Save transcript to file with proper UTF-8 encoding
            fs.writeFileSync(filePath, transcriptContent, { encoding: 'utf8' });
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

/**
 * Rewrite transcript content using ChatGPT to avoid copyright issues
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function rewriteTranscript(req, res) {
    try {
        const { filename, openaiApiKey, intensity = 'light' } = req.body;

        if (!filename) {
            return res.status(400).json({
                success: false,
                message: 'Filename is required',
                error: 'Missing required parameter: filename'
            });
        }

        if (!openaiApiKey) {
            return res.status(400).json({
                success: false,
                message: 'OpenAI API key is required',
                error: 'Missing required parameter: openaiApiKey'
            });
        }

        console.log(`🔄 Rewriting transcript: ${filename} with intensity: ${intensity}`);

        // Read the original transcript file
        const transcriptDir = path.join(__dirname, '../../transcripts');
        const filePath = path.join(transcriptDir, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'Transcript file not found',
                error: 'File does not exist'
            });
        }

        const originalContent = fs.readFileSync(filePath, 'utf8');
        
        // Create different prompts based on intensity
        let systemPrompt, userPrompt;
        
        switch (intensity) {
            case 'light':
                systemPrompt = "You are a professional content editor. Your task is to make minimal, subtle changes to the text while preserving the original meaning, tone, and structure. Only change word choices, sentence structure, or phrasing slightly to create a unique version. Keep the same narrative flow and all important details.";
                userPrompt = "Please rewrite this transcript with very light modifications to avoid copyright issues while keeping the exact same meaning and story flow. Only change word choices and minor phrasing, but keep all names, events, and plot points identical:";
                break;
            case 'medium':
                systemPrompt = "You are a professional content editor. Your task is to moderately rewrite the text while preserving the core meaning and story. You can change sentence structures, word choices, and some phrasing, but keep all important details, names, and plot points.";
                userPrompt = "Please rewrite this transcript with moderate modifications to avoid copyright issues. Change sentence structures and word choices while keeping the same story, characters, and plot points:";
                break;
            case 'heavy':
                systemPrompt = "You are a professional content editor. Your task is to significantly rewrite the text while preserving the core story and meaning. You can restructure sentences, change word choices, and modify phrasing, but keep all important story elements and plot points.";
                userPrompt = "Please rewrite this transcript with significant modifications to avoid copyright issues. Restructure sentences and change word choices while keeping the same story, characters, and plot points:";
                break;
            default:
                systemPrompt = "You are a professional content editor. Your task is to make minimal, subtle changes to the text while preserving the original meaning, tone, and structure.";
                userPrompt = "Please rewrite this transcript with very light modifications to avoid copyright issues while keeping the exact same meaning and story flow:";
        }

        // Call OpenAI API
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: `${userPrompt}\n\n${originalContent}`
                    }
                ],
                max_tokens: 4000,
                temperature: 0.7
            })
        });

        if (!openaiResponse.ok) {
            const errorData = await openaiResponse.json();
            throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
        }

        const openaiData = await openaiResponse.json();
        const rewrittenContent = openaiData.choices[0].message.content;

        // Save the rewritten version
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const originalName = filename.replace('.txt', '');
        const rewrittenFilename = `${originalName}_rewritten_${intensity}_${timestamp}.txt`;
        const rewrittenFilePath = path.join(transcriptDir, rewrittenFilename);

        fs.writeFileSync(rewrittenFilePath, rewrittenContent, { encoding: 'utf8' });

        console.log(`✅ Transcript rewritten successfully: ${rewrittenFilename}`);

        return res.json({
            success: true,
            message: 'Transcript rewritten successfully',
            originalFilename: filename,
            rewrittenFilename: rewrittenFilename,
            rewrittenPath: rewrittenFilePath,
            intensity: intensity,
            originalLength: originalContent.length,
            rewrittenLength: rewrittenContent.length,
            changes: {
                original: originalContent.substring(0, 200) + '...',
                rewritten: rewrittenContent.substring(0, 200) + '...'
            }
        });

    } catch (error) {
        console.error('❌ Rewrite transcript error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to rewrite transcript',
            error: error.message
        });
    }
}

/**
 * Compare original and rewritten transcript
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function compareTranscripts(req, res) {
    try {
        const { originalFilename, rewrittenFilename } = req.body;

        if (!originalFilename || !rewrittenFilename) {
            return res.status(400).json({
                success: false,
                message: 'Both filenames are required',
                error: 'Missing required parameters: originalFilename, rewrittenFilename'
            });
        }

        const transcriptDir = path.join(__dirname, '../../transcripts');
        const originalPath = path.join(transcriptDir, originalFilename);
        const rewrittenPath = path.join(transcriptDir, rewrittenFilename);

        if (!fs.existsSync(originalPath) || !fs.existsSync(rewrittenPath)) {
            return res.status(404).json({
                success: false,
                message: 'One or both files not found',
                error: 'Files do not exist'
            });
        }

        const originalContent = fs.readFileSync(originalPath, 'utf8');
        const rewrittenContent = fs.readFileSync(rewrittenPath, 'utf8');

        // Simple comparison metrics
        const originalWords = originalContent.split(/\s+/).length;
        const rewrittenWords = rewrittenContent.split(/\s+/).length;
        const wordDifference = Math.abs(originalWords - rewrittenWords);
        const wordChangePercentage = ((wordDifference / originalWords) * 100).toFixed(2);

        console.log(`📊 Comparing transcripts: ${originalFilename} vs ${rewrittenFilename}`);

        return res.json({
            success: true,
            message: 'Transcript comparison completed',
            comparison: {
                original: {
                    filename: originalFilename,
                    length: originalContent.length,
                    wordCount: originalWords,
                    preview: originalContent.substring(0, 300) + '...'
                },
                rewritten: {
                    filename: rewrittenFilename,
                    length: rewrittenContent.length,
                    wordCount: rewrittenWords,
                    preview: rewrittenContent.substring(0, 300) + '...'
                },
                metrics: {
                    wordDifference: wordDifference,
                    wordChangePercentage: wordChangePercentage + '%',
                    lengthDifference: Math.abs(originalContent.length - rewrittenContent.length),
                    similarity: (100 - parseFloat(wordChangePercentage)).toFixed(2) + '%'
                }
            }
        });

    } catch (error) {
        console.error('❌ Compare transcripts error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to compare transcripts',
            error: error.message
        });
    }
}

/**
 * Replace channel names in transcript
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function replaceChannelNames(req, res) {
    try {
        const { filename, newChannelName = 'KenKen Audio', oldChannelNames = ['Chu Chu Audio', 'ChuChu Audio'] } = req.body;

        if (!filename) {
            return res.status(400).json({
                success: false,
                message: 'Filename is required',
                error: 'Missing required parameter: filename'
            });
        }

        console.log(`🔄 Replacing channel names in: ${filename}`);
        console.log(`📺 Old names: ${oldChannelNames.join(', ')}`);
        console.log(`📺 New name: ${newChannelName}`);

        // Read the original transcript file
        const transcriptDir = path.join(__dirname, '../../transcripts');
        const filePath = path.join(transcriptDir, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'Transcript file not found',
                error: 'File does not exist'
            });
        }

        let originalContent = fs.readFileSync(filePath, 'utf8');
        let modifiedContent = originalContent;
        let replacements = [];

        // Replace each old channel name with new one
        oldChannelNames.forEach(oldName => {
            const regex = new RegExp(oldName, 'gi'); // Case insensitive, global
            const matches = modifiedContent.match(regex);
            
            if (matches) {
                modifiedContent = modifiedContent.replace(regex, newChannelName);
                replacements.push({
                    oldName: oldName,
                    newName: newChannelName,
                    count: matches.length
                });
            }
        });

        // If no replacements were made, try common variations
        if (replacements.length === 0) {
            const commonVariations = [
                'Chu Chu',
                'ChuChu',
                'Chu Chu Audio',
                'ChuChu Audio',
                'Chu Chu audio',
                'ChuChu audio'
            ];

            commonVariations.forEach(variation => {
                const regex = new RegExp(variation, 'gi');
                const matches = modifiedContent.match(regex);
                
                if (matches) {
                    modifiedContent = modifiedContent.replace(regex, newChannelName);
                    replacements.push({
                        oldName: variation,
                        newName: newChannelName,
                        count: matches.length
                    });
                }
            });
        }

        // Save the modified version
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const originalName = filename.replace('.txt', '');
        const modifiedFilename = `${originalName}_channel_replaced_${timestamp}.txt`;
        const modifiedFilePath = path.join(transcriptDir, modifiedFilename);

        fs.writeFileSync(modifiedFilePath, modifiedContent, 'utf8');

        console.log(`✅ Channel names replaced successfully: ${modifiedFilename}`);
        console.log(`📊 Total replacements: ${replacements.reduce((sum, r) => sum + r.count, 0)}`);

        return res.json({
            success: true,
            message: 'Channel names replaced successfully',
            originalFilename: filename,
            modifiedFilename: modifiedFilename,
            modifiedPath: modifiedFilePath,
            newChannelName: newChannelName,
            replacements: replacements,
            totalReplacements: replacements.reduce((sum, r) => sum + r.count, 0),
            changes: {
                original: originalContent.substring(0, 200) + '...',
                modified: modifiedContent.substring(0, 200) + '...'
            }
        });

    } catch (error) {
        console.error('❌ Replace channel names error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to replace channel names',
            error: error.message
        });
    }
}

/**
 * Advanced text replacement with multiple patterns
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function advancedTextReplacement(req, res) {
    try {
        const { filename, replacements = [] } = req.body;

        if (!filename) {
            return res.status(400).json({
                success: false,
                message: 'Filename is required',
                error: 'Missing required parameter: filename'
            });
        }

        if (!replacements || replacements.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Replacements array is required',
                error: 'Missing required parameter: replacements'
            });
        }

        console.log(`🔄 Advanced text replacement in: ${filename}`);
        console.log(`📝 ${replacements.length} replacement patterns`);

        // Read the original transcript file
        const transcriptDir = path.join(__dirname, '../../transcripts');
        const filePath = path.join(transcriptDir, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'Transcript file not found',
                error: 'File does not exist'
            });
        }

        let originalContent = fs.readFileSync(filePath, 'utf8');
        let modifiedContent = originalContent;
        let replacementResults = [];

        // Apply each replacement
        replacements.forEach((replacement, index) => {
            const { from, to, caseSensitive = false, wholeWord = false } = replacement;
            
            if (!from || !to) {
                console.log(`⚠️ Skipping invalid replacement ${index + 1}: missing from/to`);
                return;
            }

            let regex;
            if (wholeWord) {
                regex = new RegExp(`\\b${from}\\b`, caseSensitive ? 'g' : 'gi');
            } else {
                regex = new RegExp(from, caseSensitive ? 'g' : 'gi');
            }

            const matches = modifiedContent.match(regex);
            
            if (matches) {
                modifiedContent = modifiedContent.replace(regex, to);
                replacementResults.push({
                    index: index + 1,
                    from: from,
                    to: to,
                    count: matches.length,
                    caseSensitive: caseSensitive,
                    wholeWord: wholeWord
                });
            } else {
                replacementResults.push({
                    index: index + 1,
                    from: from,
                    to: to,
                    count: 0,
                    caseSensitive: caseSensitive,
                    wholeWord: wholeWord,
                    note: 'No matches found'
                });
            }
        });

        // Save the modified version
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const originalName = filename.replace('.txt', '');
        const modifiedFilename = `${originalName}_advanced_replaced_${timestamp}.txt`;
        const modifiedFilePath = path.join(transcriptDir, modifiedFilename);

        fs.writeFileSync(modifiedFilePath, modifiedContent, 'utf8');

        console.log(`✅ Advanced text replacement completed: ${modifiedFilename}`);
        console.log(`📊 Total successful replacements: ${replacementResults.filter(r => r.count > 0).length}`);

        return res.json({
            success: true,
            message: 'Advanced text replacement completed',
            originalFilename: filename,
            modifiedFilename: modifiedFilename,
            modifiedPath: modifiedFilePath,
            replacementResults: replacementResults,
            totalReplacements: replacementResults.reduce((sum, r) => sum + r.count, 0),
            successfulReplacements: replacementResults.filter(r => r.count > 0).length,
            changes: {
                original: originalContent.substring(0, 200) + '...',
                modified: modifiedContent.substring(0, 200) + '...'
            }
        });

    } catch (error) {
        console.error('❌ Advanced text replacement error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to perform advanced text replacement',
            error: error.message
        });
    }
}

/**
 * Rewrite transcript with ChatGPT to change wording naturally
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function rewriteWithChatGPT(req, res) {
    try {
        const { filename, openaiApiKey } = req.body;

        if (!filename) {
            return res.status(400).json({
                success: false,
                message: 'Filename is required',
                error: 'Missing required parameter: filename'
            });
        }

        if (!openaiApiKey) {
            return res.status(400).json({
                success: false,
                message: 'OpenAI API key is required',
                error: 'Missing required parameter: openaiApiKey'
            });
        }

        console.log(`🤖 Rewriting transcript with ChatGPT: ${filename}`);
        console.log(`🎯 Target: ~15% word changes, maintain original voice`);

        // Read the original transcript file
        const transcriptDir = path.join(__dirname, '../../transcripts');
        const filePath = path.join(transcriptDir, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'Transcript file not found',
                error: 'File does not exist'
            });
        }

        const originalContent = fs.readFileSync(filePath, 'utf8');
        
        // Create different prompts based on style and intensity
        let systemPrompt, userPrompt;
        
        // Optimized single style with 15% change target - FORCE VIETNAMESE
        systemPrompt = "Bạn là một biên tập viên nội dung chuyên nghiệp. Nhiệm vụ của bạn là viết lại văn bản với khoảng 15% thay đổi từ ngữ trong khi giữ nguyên ý nghĩa, câu chuyện, tông cảm xúc và phong cách nói. Thay đổi lựa chọn từ ngữ, cấu trúc câu và cách diễn đạt một cách vừa phải để tạo ra sự đa dạng tự nhiên. Giữ nguyên tất cả sự kiện, điểm cốt truyện, đối thoại và giọng nói gốc. QUAN TRỌNG: Phải viết bằng TIẾNG VIỆT và thay thế mọi đề cập đến kênh hoặc thương hiệu thành 'Ken Ken Audio'. Mục tiêu là làm cho nó nghe tươi mới trong khi duy trì cùng dòng câu chuyện và giọng nhân vật.";
        userPrompt = "Hãy viết lại transcript này với những thay đổi vừa phải (khoảng 15% thay đổi từ ngữ) để tạo ra sự đa dạng tự nhiên trong khi giữ nguyên câu chuyện, nhân vật, điểm cốt truyện và phong cách nói. Làm cho nó nghe tươi mới và tự nhiên nhưng duy trì giọng, tông và NGÔN NGỮ gốc. KHÔNG được dịch sang ngôn ngữ khác. PHẢI VIẾT BẰNG TIẾNG VIỆT. Cũng thay thế mọi đề cập đến kênh/thương hiệu (ví dụ: 'Thỏ Ngọc', 'Thỏ Ngọc Audio', 'Chu Chu', 'ChuChu Audio', v.v.) thành 'Ken Ken' hoặc 'Ken Ken Audio' tương ứng:";

        // Split content into chunks if too long (ChatGPT has token limits)
        const maxChunkSize = 3000; // Conservative limit
        const chunks = [];
        
        if (originalContent.length > maxChunkSize) {
            const sentences = originalContent.split(/[.!?]+/);
            let currentChunk = '';
            
            for (const sentence of sentences) {
                if (currentChunk.length + sentence.length > maxChunkSize) {
                    chunks.push(currentChunk.trim());
                    currentChunk = sentence;
                } else {
                    currentChunk += sentence + '.';
                }
            }
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
            }
        } else {
            chunks.push(originalContent);
        }

        console.log(`📝 Processing ${chunks.length} chunks`);

        let rewrittenContent = '';
        
        // Process each chunk
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            console.log(`🔄 Processing chunk ${i + 1}/${chunks.length}`);

            const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openaiApiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt
                        },
                        {
                            role: 'user',
                            content: `${userPrompt}\n\n${chunk}`
                        },
                        {
                            role: 'assistant',
                            content: 'Tôi hiểu. Tôi sẽ viết lại transcript bằng tiếng Việt với khoảng 15% thay đổi từ ngữ, giữ nguyên câu chuyện và thay thế tên kênh thành "Ken Ken Audio".'
                        },
                        {
                            role: 'user',
                            content: 'Đúng vậy. Hãy bắt đầu viết lại transcript này bằng tiếng Việt:'
                        }
                    ],
                    max_tokens: 4000,
                    temperature: 0.7
                })
            });

            if (!openaiResponse.ok) {
                const errorData = await openaiResponse.json();
                throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
            }

            const openaiData = await openaiResponse.json();
            const chunkRewritten = openaiData.choices[0].message.content;
            
            rewrittenContent += chunkRewritten + ' ';
            
            // Add delay between requests to avoid rate limiting
            if (i < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Clean up the final content
        rewrittenContent = rewrittenContent.trim();

        // Auto-replace channel names to Ken Ken Audio
        console.log(`🔄 Auto-replacing channel names to Ken Ken Audio...`);
        const channelReplacements = [
            { from: /Chu Chu Audio/gi, to: 'Ken Ken Audio' },
            { from: /ChuChu Audio/gi, to: 'Ken Ken Audio' },
            { from: /Chu Chu/gi, to: 'Ken Ken' },
            { from: /ChuChu/gi, to: 'Ken Ken' },
            // Thêm các biến thể Thỏ Ngọc
            { from: /Thỏ Ngọc Audio/gi, to: 'Ken Ken Audio' },
            { from: /Tho Ngoc Audio/gi, to: 'Ken Ken Audio' },
            { from: /Thỏ Ngọc/gi, to: 'Ken Ken' },
            { from: /Tho Ngoc/gi, to: 'Ken Ken' }
        ];

        let replacementCount = 0;
        for (const replacement of channelReplacements) {
            const matches = rewrittenContent.match(replacement.from);
            if (matches) {
                rewrittenContent = rewrittenContent.replace(replacement.from, replacement.to);
                replacementCount += matches.length;
            }
        }

        if (replacementCount > 0) {
            console.log(`✅ Replaced ${replacementCount} channel name references`);
        }

        // Save the rewritten version
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const originalName = filename.replace('.txt', '');
        const rewrittenFilename = `${originalName}_chatgpt_rewritten_${timestamp}.txt`;
        const rewrittenFilePath = path.join(transcriptDir, rewrittenFilename);

        fs.writeFileSync(rewrittenFilePath, rewrittenContent, { encoding: 'utf8' });

        console.log(`✅ ChatGPT rewrite completed: ${rewrittenFilename}`);

        return res.json({
            success: true,
            message: 'Transcript rewritten with ChatGPT successfully',
            originalFilename: filename,
            rewrittenFilename: rewrittenFilename,
            rewrittenPath: rewrittenFilePath,
            rewriteType: 'optimized_15_percent',
            chunksProcessed: chunks.length,
            originalLength: originalContent.length,
            rewrittenLength: rewrittenContent.length,
            channelReplacements: replacementCount,
            changes: {
                original: originalContent.substring(0, 200) + '...',
                rewritten: rewrittenContent.substring(0, 200) + '...'
            }
        });

    } catch (error) {
        console.error('❌ ChatGPT rewrite error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to rewrite transcript with ChatGPT',
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
    getTranscriptFile,
    rewriteTranscript,
    compareTranscripts,
    replaceChannelNames,
    advancedTextReplacement,
    rewriteWithChatGPT
};
