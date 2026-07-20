import SynapseXLogo from '../components/SynapseXLogo'
import { useI18n } from '../i18n/I18nContext'

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_080203_fd7f4f85-3a86-4837-8192-85e7bfe68e75.mp4'

export default function Footer() {
  const { t } = useI18n()
  return (
    <footer className="relative bg-black overflow-hidden">
      <div className="flex flex-col md:flex-row min-h-[400px]">
        {/* Left: video */}
        <div className="w-full md:w-1/2 h-[300px] md:h-auto relative overflow-hidden">
          <video
            src={VIDEO_SRC}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        </div>

        {/* Right: content */}
        <div className="w-full md:w-1/2 flex flex-col justify-between p-10 sm:p-16">
          <div>
            <div className="flex items-center gap-2 mb-8">
              <SynapseXLogo size={18} className="text-white/70" />
              <span className="text-white/70 text-[15px] font-medium tracking-tight">SynapseX</span>
            </div>
            <p className="text-white/40 text-[14px] sm:text-[15px] leading-relaxed max-w-sm">
              {t('footer.desc')}
            </p>
          </div>

          <p className="text-white/25 text-[12px] mt-12">
            {t('footer.copyright')}
          </p>
        </div>
      </div>
    </footer>
  )
}
