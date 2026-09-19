import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Saturday Outlook | College football, one week ahead',description:'Follow your college football team, explore its remaining schedule, and see a ratings-based season outlook.'};
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
