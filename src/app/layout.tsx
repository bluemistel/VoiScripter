import './globals.css';

export const metadata = {
  title: 'VoiScripter.',
  description: '合成音声ソフトの台本に向いたシンプルなエディタ',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
