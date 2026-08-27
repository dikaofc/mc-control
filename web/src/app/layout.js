import './globals.css';

export const metadata = {
  title: 'MC Control — Minecraft Server Hosting',
  description: 'Host and manage Minecraft Java & Bedrock servers from your browser.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
