import type { Metadata } from 'next'
import './globals.css'
import './mobile.css'
import Web3Provider from '@/components/wallet/Web3Provider'
import { ColorThemeProvider } from '@/components/ColorThemeProvider'
import { NormieModeProvider, NORMIE_MODE_STORAGE_KEY } from '@/components/NormieModeProvider'
import NavBar from '@/components/NavBar'
import RescorePromoBannerShell from '@/components/RescorePromoBannerShell'
import { EthUsdProvider } from '@/components/EthUsdProvider'
import { getEthUsdRateCached } from '@/lib/ethUsdRate'
import { COLOR_THEME_STORAGE_KEY, CUSTOM_THEME_STORAGE_KEY } from '@/lib/colorThemes'

const SITE_URL = 'https://the-build-report.vercel.app'
const SITE_TITLE = 'The Build Report'
const SITE_DESCRIPTION = 'A plain English look at the repos, scored and sourced.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F4F6F8',
}

const themeBootScript = `(function(){try{
  var c=localStorage.getItem('${CUSTOM_THEME_STORAGE_KEY}');
  if(c){
    var v=JSON.parse(c);
    var bg=v.bg||'#FAFAFA',ac=v.accent||'#3D9A88',dark=v.base==='dark';
    function hr(h){var n=parseInt(h.replace('#',''),16);return[(n>>16)&255,(n>>8)&255,n&255]}
    function sl(h,d){var rgb=hr(h);return'#'+rgb.map(function(x){var r=Math.round(x+d);return Math.max(0,Math.min(255,r)).toString(16).padStart(2,'0')}).join('')}
    var step=dark?-10:10;
    var rgb=hr(ac);
    var style=[
      '--bg:'+bg,
      '--surface-1:'+sl(bg,step),
      '--surface-2:'+sl(bg,step*0.6),
      '--surface-3:'+sl(bg,step*0.3),
      '--border:'+sl(bg,step*2.2),
      '--border-strong:'+(dark?'rgba(255,255,255,0.18)':'rgba(0,0,0,0.18)'),
      '--text-primary:'+(dark?'#F0F0F0':'#111111'),
      '--text-secondary:'+(dark?'#B0B0B0':'#333333'),
      '--text-muted:'+(dark?'#707070':'#666666'),
      '--accent:'+ac,
      '--accent-dim:rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+',0.12)',
      '--accent-border:rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+',0.3)'
    ].join(';');
    document.documentElement.setAttribute('style',style);
    return;
  }
  var t=localStorage.getItem('${COLOR_THEME_STORAGE_KEY}');
  if(t)document.documentElement.dataset.colorTheme=t;
}catch(e){}
try{
  if(localStorage.getItem('${NORMIE_MODE_STORAGE_KEY}')==='1')document.documentElement.dataset.normie='1';
}catch(e){}})()`

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ethUsdRate = await getEthUsdRateCached()

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <ColorThemeProvider>
          <NormieModeProvider>
          <EthUsdProvider rate={ethUsdRate}>
          <Web3Provider>
            <NavBar />
            <RescorePromoBannerShell />
            <main className="site-main" style={{ maxWidth: 'var(--content-max-width)', margin: '0 auto', padding: '32px var(--content-padding-x) 80px' }}>
              {children}
            </main>
            <footer className="site-footer" style={{
              borderTop: '1px solid var(--border)',
              padding: '20px 24px',
              textAlign: 'center',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}>
              The Build Report is an independent community project. Not affiliated with clawdbotatg, Austin Griffith, or the core team. Not financial advice.
            </footer>
          </Web3Provider>
          </EthUsdProvider>
          </NormieModeProvider>
        </ColorThemeProvider>
      </body>
    </html>
  )
}
