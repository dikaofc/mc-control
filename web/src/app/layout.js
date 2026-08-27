import './globals.css';

export const metadata = {
  title: 'VPS Panel — Web Terminal & File Manager',
  description: 'Full VPS environment in your browser. Terminal, file manager, run anything.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
