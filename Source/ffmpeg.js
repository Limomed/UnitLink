// const ffmpeg = require('fluent-ffmpeg');
// const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

// ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// ffmpeg('video/steamTest.mp4', { timeout: 432000 })
//   .addOptions([
//     '-profile:v baseline',
//     '-level 3.0',
//     '-start_number 0',
//     '-hls_time 10',
//     '-hls_list_size 0',
//     '-f hls',
//   ])
//   .output('video/output.m3u8')
//   .on('end', () => {
//     console.log('end');
//   })
//   .run();
