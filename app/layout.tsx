import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'CFB Schedule Outlook',description:"Use advanced metrics (SP+) to forecast your team's performance against its schedule."};
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
