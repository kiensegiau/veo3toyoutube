const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Monitor và tải video MH370 khi sẵn sàng
 */
async function monitorAndDownloadMH370Videos() {
    try {
        console.log('🔄 [MH370] Monitor và tải video MH370...');
        
        const serverUrl = 'http://localhost:8888';
        const outputDir = './temp/mh370-complete-32s';
        
        // Đọc kết quả từ file
        const resultPath = path.join(outputDir, 'mh370-complete-32s-result.json');
        if (!fs.existsSync(resultPath)) {
            throw new Error('Không tìm thấy file kết quả');
        }
        
        const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
        console.log(`📊 [MH370] Đã đọc kết quả: ${result.veo3OperationsSent} operations`);
        
        const successfulOperations = result.veo3Results.filter(r => r.success);
        console.log(`🎬 [MH370] Có ${successfulOperations.length} video cần monitor`);
        
        // Monitor từng operation
        const downloadPromises = successfulOperations.map(async (veo3Result) => {
            const operationId = veo3Result.operationId;
            console.log(`🔄 [MH370] Monitor operation: ${operationId}`);
            
            // Polling để kiểm tra trạng thái
            let attempts = 0;
            const maxAttempts = 60; // Tối đa 60 lần (5 phút)
            
            while (attempts < maxAttempts) {
                try {
                    const statusResponse = await fetch(`${serverUrl}/api/check-status`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            operationName: operationId
                        })
                    });
                    
                    const statusResult = await statusResponse.json();
                    
                    if (statusResult.success && statusResult.videoStatus === 'COMPLETED' && statusResult.videoUrl) {
                        console.log(`✅ [MH370] Operation ${operationId} đã hoàn thành!`);
                        
                        // Tải video
                        const downloadResponse = await fetch(`${serverUrl}/api/tts/download`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                audioUrl: statusResult.videoUrl,
                                filename: `mh370_segment_${veo3Result.segmentIndex + 1}_${Date.now()}.mp4`
                            })
                        });
                        
                        const downloadResult = await downloadResponse.json();
                        
                        if (downloadResult.success) {
                            console.log(`✅ [MH370] Segment ${veo3Result.segmentIndex + 1} đã tải về: ${downloadResult.outPath}`);
                            return {
                                segmentIndex: veo3Result.segmentIndex,
                                timeRange: veo3Result.timeRange,
                                focus: veo3Result.focus,
                                path: downloadResult.outPath,
                                operationId: operationId,
                                success: true
                            };
                        } else {
                            console.log(`❌ [MH370] Segment ${veo3Result.segmentIndex + 1} tải về thất bại: ${downloadResult.message}`);
                            return {
                                segmentIndex: veo3Result.segmentIndex,
                                error: 'Download failed',
                                success: false
                            };
                        }
                    } else if (statusResult.success && statusResult.videoStatus === 'PENDING') {
                        console.log(`⏳ [MH370] Operation ${operationId} đang xử lý... (attempt ${attempts + 1})`);
                        attempts++;
                        await new Promise(resolve => setTimeout(resolve, 5000)); // Chờ 5 giây
                    } else {
                        console.log(`❌ [MH370] Operation ${operationId} thất bại hoặc không tìm thấy`);
                        return {
                            segmentIndex: veo3Result.segmentIndex,
                            error: 'Operation failed',
                            success: false
                        };
                    }
                } catch (error) {
                    console.warn(`⚠️ [MH370] Lỗi kiểm tra operation ${operationId}:`, error.message);
                    attempts++;
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
            
            console.log(`⏰ [MH370] Operation ${operationId} timeout sau ${maxAttempts} attempts`);
            return {
                segmentIndex: veo3Result.segmentIndex,
                error: 'Timeout',
                success: false
            };
        });
        
        // Chờ tất cả video được tải về
        console.log(`⏳ [MH370] Chờ tất cả video được tải về...`);
        const videoFiles = await Promise.all(downloadPromises);
        const successfulVideos = videoFiles.filter(v => v.success);
        
        console.log(`✅ [MH370] Đã tải ${successfulVideos.length}/${successfulOperations.length} video`);
        
        // Ghép video nếu có ít nhất 1 video
        if (successfulVideos.length > 0) {
            console.log(`🎬 [MH370] Ghép ${successfulVideos.length} video thành 1 video kết quả...`);
            
            // Sắp xếp theo thứ tự
            successfulVideos.sort((a, b) => a.segmentIndex - b.segmentIndex);
            
            // Kiểm tra các file video tồn tại
            const validVideoFiles = successfulVideos.filter(video => {
                if (!video.path || !fs.existsSync(video.path)) {
                    console.warn(`⚠️ [MH370] File video không tồn tại: ${video.path}`);
                    return false;
                }
                return true;
            });
            
            if (validVideoFiles.length === 0) {
                throw new Error('Không có file video hợp lệ để ghép');
            }
            
            console.log(`📝 [MH370] Có ${validVideoFiles.length} file video hợp lệ để ghép`);
            
            // Tạo file list cho ffmpeg
            const listPath = path.join(outputDir, 'mh370_video_list.txt');
            const listContent = validVideoFiles.map(video => {
                const absolutePath = path.resolve(video.path);
                const normalizedPath = absolutePath.replace(/\\/g, '/');
                return `file '${normalizedPath}'`;
            }).join('\n');
            
            console.log(`📝 [MH370] Tạo file list: ${listPath}`);
            fs.writeFileSync(listPath, listContent, 'utf8');
            
            // Ghép video
            const finalVideoPath = path.join(outputDir, `mh370_32s_final_${Date.now()}.mp4`);
            const mergeCmd = `ffmpeg -f concat -safe 0 -i "${listPath}" -c copy "${finalVideoPath}"`;
            
            console.log(`🎬 [MH370] Ghép video với lệnh: ${mergeCmd}`);
            await execAsync(mergeCmd);
            
            console.log(`✅ [MH370] Đã ghép video thành: ${finalVideoPath}`);
            
            // Lưu kết quả cuối cùng
            const finalResult = {
                ...result,
                videosDownloaded: successfulVideos.length,
                finalVideo: finalVideoPath,
                videoFiles: successfulVideos,
                completedAt: new Date().toISOString()
            };
            
            const finalResultPath = path.join(outputDir, 'mh370-final-result.json');
            fs.writeFileSync(finalResultPath, JSON.stringify(finalResult, null, 2));
            
            console.log(`📊 [MH370] Đã lưu kết quả cuối cùng vào: ${finalResultPath}`);
            
            console.log('🎉 [MH370] Hoàn thành tạo video 32s với transcript MH370!');
            console.log(`🎉 [MH370] Video kết quả: ${finalVideoPath}`);
            console.log(`🎉 [MH370] Chủ đề: ${result.overallTheme}`);
            console.log(`🎉 [MH370] Màu sắc: ${result.colorScheme}`);
            
            return {
                success: true,
                result: finalResult
            };
            
        } else {
            throw new Error('Không có video nào được tải về để ghép');
        }
        
    } catch (error) {
        console.error(`❌ [MH370] Lỗi:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

console.log('🚀 [START] Monitor và tải video MH370...');
monitorAndDownloadMH370Videos().then(result => {
    if (result.success) {
        console.log('🎉 [MH370] Hoàn thành thành công!');
        console.log(`🎉 [MH370] Video: ${result.result.finalVideo}`);
    } else {
        console.log(`❌ [MH370] Thất bại: ${result.error}`);
    }
});
