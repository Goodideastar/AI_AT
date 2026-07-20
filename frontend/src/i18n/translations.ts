// 翻译表：key -> { zh, en }
// 扁平 key，使用 . 分隔命名空间

export type Lang = 'zh' | 'en'

export const translations = {
  // ── Navbar ──
  'nav.about': { zh: '关于', en: 'About' },
  'nav.metrics': { zh: '数据', en: 'Metrics' },
  'nav.download': { zh: '下载', en: 'Download' },
  'nav.login': { zh: '登录', en: 'Log in' },
  'nav.logout': { zh: '退出登录', en: 'Log out' },
  'nav.logoutShort': { zh: '退出', en: 'Exit' },
  'nav.dashboard': { zh: '看板', en: 'Dashboard' },
  'nav.aiAnalysis': { zh: 'AI分析', en: 'AI Analysis' },
  'nav.strategy': { zh: '策略', en: 'Strategy' },
  'nav.backtest': { zh: '回测', en: 'Backtest' },
  'nav.trade': { zh: '交易', en: 'Trade' },
  'nav.market': { zh: '策略市场', en: 'Market' },

  // ── Hero ──
  'hero.brain': { zh: 'Brain', en: 'Brain' },
  'hero.andBody': { zh: 'And Body', en: 'And Body' },
  'hero.one': { zh: 'One', en: 'One' },
  'hero.network': { zh: 'Network', en: 'Network' },
  'hero.desc': {
    zh: '构建于神经科学与人工智能的交汇处。SynapseX 持续将神经通路、认知负荷与生理状态映射为单一的自适应智能层。',
    en: 'Built at the intersection of neuroscience and artificial intelligence. SynapseX continuously maps neural pathways, cognitive load, and physiological states into a single adaptive intelligence layer.',
  },
  'hero.watermark': { zh: 'TRANSCENDENCE', en: 'TRANSCENDENCE' },

  // ── CinematicText ──
  'cinematic.body': {
    zh: '一个基于人类神经系统架构构建的神经-AI 接口。SynapseX 将突触活动转化为可计算的智能。每一个信号都变得可测量、结构化、可见化。它持续将内部状态重建为动态神经地图。生物噪声被过滤为可执行的认知模式。',
    en: 'A neural-AI interface built on the architecture of the human nervous system. SynapseX translates synaptic activity into computational intelligence. Every signal becomes measurable, structured, and visible. It continuously reconstructs internal state as a dynamic neural map. Biological noise is filtered into actionable cognitive patterns.',
  },

  // ── Metrics ──
  'metrics.title': { zh: '性能指标', en: 'Performance Metrics' },
  'metrics.latency': { zh: '突触延迟', en: 'Synaptic Latency' },
  'metrics.accuracy': { zh: '信号精度', en: 'Signal Accuracy' },
  'metrics.params': { zh: '神经参数', en: 'Neural Parameters' },

  // ── Technology ──
  'tech.title1': { zh: '自适应', en: 'Adaptive' },
  'tech.title2': { zh: '智能', en: 'Intelligence' },
  'tech.desc': {
    zh: '系统会在 72 小时内学习你的神经基线。此后，每个认知状态都会被实时映射、预测并优化。',
    en: 'The system learns your neural baseline within 72 hours. From there, every cognitive state is mapped, predicted, and optimized in real time.',
  },
  'tech.cortical.title': { zh: '皮层映射', en: 'Cortical Mapping' },
  'tech.cortical.desc': { zh: '实时空间重建激活的神经区域。', en: 'Real-time spatial reconstruction of active neural regions.' },
  'tech.signal.title': { zh: '信号分离', en: 'Signal Isolation' },
  'tech.signal.desc': { zh: '从生物噪声中分离认知意图。', en: 'Separates cognitive intent from biological noise.' },
  'tech.state.title': { zh: '状态预测', en: 'State Prediction' },
  'tech.state.desc': { zh: '在认知转换发生之前预判。', en: 'Anticipates cognitive transitions before they occur.' },
  'tech.loop.title': { zh: '回路反馈', en: 'Loop Feedback' },
  'tech.loop.desc': { zh: '基于结果相关性的闭环调整。', en: 'Closed-loop adjustment based on outcome correlation.' },

  // ── Architecture ──
  'arch.eyebrow': { zh: '架构', en: 'Architecture' },
  'arch.title': { zh: '三层结构。零摩擦。', en: 'Three layers. Zero friction.' },
  'arch.desc': {
    zh: '传感层捕获原始生物电信号。处理层分离意图。接口层向任何连接的系统交付结构化输出。',
    en: 'Sensor layer captures raw bioelectric signals. Processing layer isolates intent. Interface layer delivers structured output to any connected system.',
  },
  'arch.layer1': { zh: '捕获', en: 'Capture' },
  'arch.layer2': { zh: '处理', en: 'Process' },
  'arch.layer3': { zh: '接口', en: 'Interface' },

  // ── Footer ──
  'footer.desc': {
    zh: '人机交互的下一阶段进化。为那些拒绝被生物体所限制的人而生。',
    en: 'The next evolution of human-machine interaction. Built for those who refuse to be limited by biology alone.',
  },
  'footer.copyright': { zh: '© 2026 SynapseX Labs. 保留所有权利。', en: '© 2026 SynapseX Labs. All rights reserved.' },

  // ── AuthModal ──
  'auth.login.title': { zh: '登录', en: 'Log in' },
  'auth.register.title': { zh: '注册', en: 'Sign up' },
  'auth.login.subtitle': { zh: '接入你的神经智能层', en: 'Access your neural intelligence layer' },
  'auth.register.subtitle': { zh: '加入下一代人机交互', en: 'Join the next generation of human-machine interaction' },
  'auth.username': { zh: '用户名', en: 'Username' },
  'auth.username.ph': { zh: '3-20 个字符', en: '3-20 characters' },
  'auth.email': { zh: '邮箱', en: 'Email' },
  'auth.code': { zh: '验证码', en: 'Verify code' },
  'auth.code.ph': { zh: '6 位验证码', en: '6-digit code' },
  'auth.sendCode': { zh: '发送验证码', en: 'Send code' },
  'auth.sending': { zh: '发送中...', en: 'Sending...' },
  'auth.resend': { zh: 's 后重发', en: 's retry' },
  'auth.password': { zh: '密码', en: 'Password' },
  'auth.password.ph': { zh: '至少 6 位', en: 'At least 6 chars' },
  'auth.confirmPassword': { zh: '确认密码', en: 'Confirm password' },
  'auth.confirmPassword.ph': { zh: '再次输入密码', en: 'Re-enter password' },
  'auth.captcha.ph': { zh: '请输入验证码', en: 'Enter code' },
  'auth.captcha.title': { zh: '点击刷新验证码', en: 'Click to refresh' },
  'auth.captcha.alt': { zh: '验证码', en: 'Captcha' },
  'auth.captcha.loadFail': { zh: '验证码加载失败，请重试', en: 'Failed to load captcha' },
  'auth.codeSent': { zh: '验证码已发送，请查收邮箱（5分钟内有效）', en: 'Code sent. Check your inbox (valid for 5 minutes).' },
  'auth.sendFail': { zh: '发送失败', en: 'Failed to send' },
  'auth.opFail': { zh: '操作失败', en: 'Operation failed' },
  // 表单错误
  'auth.err.username': { zh: '请输入用户名', en: 'Please enter username' },
  'auth.err.email': { zh: '请输入邮箱', en: 'Please enter email' },
  'auth.err.emailFormat': { zh: '邮箱格式错误', en: 'Invalid email format' },
  'auth.err.code': { zh: '请输入验证码', en: 'Please enter code' },
  'auth.err.password': { zh: '请输入密码', en: 'Please enter password' },
  'auth.err.confirmPassword': { zh: '请再次输入密码', en: 'Please re-enter password' },
  'auth.err.confirmMismatch': { zh: '确认密码与密码不一致', en: 'Passwords do not match' },
  'auth.err.agreeRequired': { zh: '请先勾选同意隐私协议和隐私政策', en: 'Please accept the User Agreement and Privacy Policy first' },
  // 隐私勾选
  'auth.privacy.agree': { zh: '用户同意', en: 'I agree to the' },
  'auth.privacy.and': { zh: '和', en: 'and' },
  'auth.privacy.agreement': { zh: '隐私协议', en: 'User Agreement' },
  'auth.privacy.policy': { zh: '隐私政策', en: 'Privacy Policy' },
  // 切换模式
  'auth.switch.noAccount': { zh: '还没有账户？', en: "Don't have an account?" },
  'auth.switch.hasAccount': { zh: '已有账户？', en: 'Already have an account?' },
  'auth.switch.register': { zh: '立即注册', en: 'Sign up' },
  'auth.switch.login': { zh: '去登录', en: 'Log in' },
  'auth.submit.login': { zh: '登录', en: 'Log in' },
  'auth.submit.register': { zh: '注册', en: 'Sign up' },

  // ── SliderCaptcha ──
  'slider.title': { zh: '滑动验证', en: 'Slide to verify' },
  'slider.desc': { zh: '拖动下方滑块完成拼图，验证后发送验证码', en: 'Drag the slider to solve the puzzle and send the code' },
  'slider.success': { zh: '验证通过', en: 'Verified' },
  'slider.fail': { zh: '验证失败，请重试', en: 'Verification failed, please retry' },
  'slider.hint': { zh: '向右拖动滑块', en: 'Drag the slider to the right' },
  'slider.refresh': { zh: '刷新拼图', en: 'Refresh puzzle' },
  'slider.loadFail': { zh: '验证码加载失败', en: 'Failed to load captcha' },
  'slider.verifyFail': { zh: '验证请求失败，请重试', en: 'Verification request failed' },
  'slider.imgLoadFail': { zh: '图片加载失败', en: 'Image load failed' },

  // ── Legal pages ──
  'legal.lastUpdate': { zh: '最后更新日期：2026 年 7 月 18 日', en: 'Last updated: July 18, 2026' },
  'legal.back': { zh: '返回首页', en: 'Back to home' },
  'legal.userAgreement': { zh: '隐私协议', en: 'User Agreement' },
  'legal.privacyPolicy': { zh: '隐私政策', en: 'Privacy Policy' },
  'legal.enNotice': {
    zh: '',
    en: 'Note: This English version is provided for reference only. The Chinese version shall prevail in case of any discrepancy.',
  },

  // ── Language toggle ──
  'lang.toggleToEn': { zh: 'Switch to English', en: 'Switch to English' },
  'lang.toggleToZh': { zh: '切换到中文', en: '切换到中文' },

  // ── NotFound page ──
  'notfound.title': { zh: '哎呀，出错了！', en: 'Oops, something went wrong!' },
  'notfound.back': { zh: '返回首页', en: 'Back to Home' },
  'notfound.menu': { zh: '菜单', en: 'Menu' },
} as const

export type TranslationKey = keyof typeof translations
