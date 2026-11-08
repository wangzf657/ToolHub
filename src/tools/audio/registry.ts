import type { ToolDef } from '@/types'

/** 音频工具注册表（29 项）—— WebAudio 快路径 + ffmpeg 兜底 */
const tools: ToolDef[] = [
  { slug: 'text-to-speech', title: '文字转语音', category: 'audio', desc: '调用系统内置语音朗读文本，可调语速音调，选中文本试听。', keywords: ['tts', '朗读', '配音'], component: () => import('./components/TextToSpeech.vue') },
  { slug: 'audio-transcribe', title: '音频转文字', category: 'audio', desc: '端侧语音识别模型把录音转成文字（首次需下载模型，之后离线）。', keywords: ['转写', '字幕', 'transcribe'], needModel: true, component: () => import('./components/AudioTranscribe.vue') },
  { slug: 'audio-trimmer', title: '音频裁剪', category: 'audio', desc: '按时间轴选择起点终点裁剪，可加淡入淡出，导出 MP3/WAV。', keywords: ['裁剪', '剪辑', 'trim'], component: () => import('./components/AudioTrimmer.vue') },
  { slug: 'voice-recorder', title: '在线录音机', category: 'audio', desc: '调用麦克风直接录音，回放后下载 WAV/MP3，全程本地。', keywords: ['录音', '麦克风', 'recorder'], component: () => import('./components/VoiceRecorder.vue'), steps: ['授权麦克风', '点击开始录音', '回放并下载'] },
  { slug: 'speech-to-text', title: '语音输入', category: 'audio', desc: '用浏览器自带语音识别把说话变成文字（需浏览器支持）。', keywords: ['语音识别', '听写', 'stt'], component: () => import('./components/SpeechToText.vue') },
  { slug: 'convert-audio', title: '音频格式转换', category: 'audio', desc: 'MP3 / WAV / M4A / FLAC / OGG 互转，可选码率与单声道。', keywords: ['音频', '转换', '格式'], needModel: true, component: () => import('./components/AudioConvert.vue') },
  { slug: 'wav-to-mp3', title: 'WAV 转 MP3', category: 'audio', desc: '把未压缩的 WAV 转成体积小 10 倍的 MP3，可选码率。', keywords: ['wav', 'mp3'], component: () => import('./components/AudioConvert.vue') },
  { slug: 'mp3-to-wav', title: 'MP3 转 WAV', category: 'audio', desc: '转成无损 WAV，剪辑软件与语音识别的通用输入。', keywords: ['mp3', 'wav'], component: () => import('./components/AudioConvert.vue') },
  { slug: 'merge-audio', title: '合并音频', category: 'audio', desc: '多段音频首尾拼接，可加间隔，自动对齐声道与采样率。', keywords: ['合并', '拼接', 'merge'], component: () => import('./components/MergeAudio.vue') },
  { slug: 'vocal-remover', title: '人声消除 / 伴奏提取', category: 'audio', desc: '中置声像抵消提取伴奏，或只留中置人声，无需 AI 即时完成。', keywords: ['伴奏', '卡拉ok', '人声'], component: () => import('./components/VocalRemover.vue') },
  { slug: 'remove-noise-from-audio', title: '音频降噪', category: 'audio', desc: '谱减法降噪：去嘶声、风扇与底噪，再统一响度。', keywords: ['降噪', '底噪', '噪音'], component: () => import('./components/DenoiseAudio.vue') },
  { slug: 'm4a-to-mp3', title: 'M4A 转 MP3', category: 'audio', desc: 'iPhone 语音备忘录 / QuickTime 的 M4A 转通用 MP3。', keywords: ['m4a', 'mp3'], needModel: true, component: () => import('./components/AudioConvert.vue') },
  { slug: 'mp3-to-m4a', title: 'MP3 转 M4A', category: 'audio', desc: '转成苹果友好的 AAC/M4A 容器，同码率音质更优。', keywords: ['mp3', 'm4a'], needModel: true, component: () => import('./components/AudioConvert.vue') },
  { slug: 'm4a-to-wav', title: 'M4A 转 WAV', category: 'audio', desc: 'M4A 解码为 WAV，供后期处理。', keywords: ['m4a', 'wav'], needModel: true, component: () => import('./components/AudioConvert.vue') },
  { slug: 'wav-to-m4a', title: 'WAV 转 M4A', category: 'audio', desc: 'WAV 压缩为 M4A，体积缩小约 10 倍。', keywords: ['wav', 'm4a'], needModel: true, component: () => import('./components/AudioConvert.vue') },
  { slug: 'flac-to-mp3', title: 'FLAC 转 MP3', category: 'audio', desc: '无损 FLAC 转 MP3 便于分发，码率自选。', keywords: ['flac', 'mp3'], needModel: true, component: () => import('./components/AudioConvert.vue') },
  { slug: 'wav-to-flac', title: 'WAV 转 FLAC', category: 'audio', desc: 'WAV 无损压缩为 FLAC，音质不变体积减半。', keywords: ['wav', 'flac'], needModel: true, component: () => import('./components/AudioConvert.vue') },
  { slug: 'flac-to-wav', title: 'FLAC 转 WAV', category: 'audio', desc: 'FLAC 解码为 WAV，两者音质完全一致。', keywords: ['flac', 'wav'], needModel: true, component: () => import('./components/AudioConvert.vue') },
  { slug: 'ogg-to-mp3', title: 'OGG 转 MP3', category: 'audio', desc: '开放格式 OGG 转 MP3，兼容更多设备。', keywords: ['ogg', 'mp3'], needModel: true, component: () => import('./components/AudioConvert.vue') },
  { slug: 'aac-to-mp3', title: 'AAC 转 MP3', category: 'audio', desc: '裸 AAC 文件转 MP3，解决「打不开」的尴尬。', keywords: ['aac', 'mp3'], needModel: true, component: () => import('./components/AudioConvert.vue') },
  { slug: 'opus-to-mp3', title: 'OPUS 转 MP3', category: 'audio', desc: '微信等导出的 OPUS 语音转 MP3。', keywords: ['opus', 'mp3', '微信'], needModel: true, component: () => import('./components/AudioConvert.vue') },
  { slug: 'wma-to-mp3', title: 'WMA 转 MP3', category: 'audio', desc: 'Windows Media 时代的 WMA 转 MP3。', keywords: ['wma', 'mp3'], needModel: true, component: () => import('./components/AudioConvert.vue') },
  { slug: 'compress-audio', title: '压缩音频', category: 'audio', desc: '按质量压缩或压到指定 MB（邮件/表单限制），语音可转单声道再减半。', keywords: ['压缩', '音频', '大小'], needModel: true, component: () => import('./components/AudioCompress.vue') },
  { slug: 'normalize-audio', title: '音量标准化', category: 'audio', desc: '把太轻的录音拉到一致响度（峰值/RMS 两种模式）。', keywords: ['音量', '响度', 'normalize'], component: () => import('./components/NormalizeAudio.vue') },
  { slug: 'change-audio-speed', title: '音频变速', category: 'audio', desc: '加速长视频课程或放慢难句，变速不变调（颗粒拼接）。', keywords: ['变速', '倍速', '音调'], component: () => import('./components/ChangeAudioSpeed.vue') },
  { slug: 'fade-audio', title: '音频淡入淡出', category: 'audio', desc: '开头淡入结尾淡出，线性/指数/S 形三种曲线。', keywords: ['淡入', '淡出', 'fade'], component: () => import('./components/FadeAudio.vue') },
  { slug: 'remove-silence-from-audio', title: '音频去静音', category: 'audio', desc: '裁掉首尾静音或全篇长停顿，录音立刻紧凑。', keywords: ['静音', '停顿', '去空白'], component: () => import('./components/RemoveSilenceAudio.vue') },
  { slug: 'reverse-audio', title: '音频倒放', category: 'audio', desc: '倒放录音并下载——反向镲片、音效设计与好奇心的朋友。', keywords: ['倒放', 'reverse'], component: () => import('./components/ReverseAudio.vue') },
  { slug: 'audio-waveform-generator', title: '音频波形图生成', category: 'audio', desc: '把音频渲染成自定义颜色的波形 PNG，做封面与缩略图。', keywords: ['波形', 'waveform', '封面'], component: () => import('./components/WaveformGenerator.vue') },
]

export default tools
