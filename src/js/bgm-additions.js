/* BGM 增量草稿（已并入 bgm.js）：
   setBgmVolume / fadeTo 的平滑变参实现以 bgm.js 的 setBgmVolume + fadeControl 为准。
   保留本文件作演进记录，不再重复定义，避免覆盖生产实现。 */
if(typeof setBgmVolume!=='function'&&typeof _bgmVolume!=='undefined'){
 console.warn('[BGM] bgm-additions loaded but bgm.js missing setBgmVolume');
}
