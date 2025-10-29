import './globals.css';

export const metadata = {
  title: 'GitHub Action Control',
  description: 'Trigger GitHub Actions manually.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar">
      <body>{children}</body>
    </html>
  );
}
